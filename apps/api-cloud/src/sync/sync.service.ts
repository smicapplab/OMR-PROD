import { Injectable, Inject, UnauthorizedException, NotFoundException, BadRequestException } from '@nestjs/common';
import { eq, and, or, inArray, desc, sql, count } from 'drizzle-orm';
import * as schema from '@omr-prod/database';
import { SyncScanDto } from './dto/sync-scan.dto';
import { SyncLogsDto } from './dto/sync-logs.dto';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../auth/auth.service';
import { GradingService } from './grading.service';

@Injectable()
export class SyncService {
    constructor(
        @Inject('DATABASE_CONNECTION') private readonly db: any,
        private readonly authService: AuthService,
        private readonly gradingService: GradingService,
    ) { }

    async registerMachine(body: { machineId: string }) {
        console.log(`🆕 Registration attempt: ${body.machineId}`);

        let [machine] = await this.db.select({ id: schema.machines.id, status: schema.machines.status }).from(schema.machines)
            .where(eq(schema.machines.machineId, body.machineId))
            .limit(1);

        if (machine) {
            return { ok: true, status: machine.status, message: 'Machine already registered' };
        }

        const rawSecret = crypto.randomBytes(32).toString('hex');
        const salt = await bcrypt.genSalt(10);
        const hashedSecret = await bcrypt.hash(rawSecret, salt);

        await this.db.insert(schema.machines).values({
            machineId: body.machineId,
            secret: hashedSecret,
            status: 'pending'
        });

        return { ok: true, status: 'pending', machineSecret: rawSecret };
    }

    async validateMachine(machineId: string, providedSecret: string) {
        if (!providedSecret) throw new UnauthorizedException('Machine secret required');

        const [machine] = await this.db.select().from(schema.machines)
            .where(eq(schema.machines.machineId, machineId))
            .limit(1);

        if (!machine) throw new UnauthorizedException('Machine not authorized or pending approval');
        if (machine.status !== 'active') throw new UnauthorizedException('Machine not authorized or pending approval');

        const isBcrypt = machine.secret?.startsWith('$2');
        const isMatch = isBcrypt
            ? await bcrypt.compare(providedSecret, machine.secret)
            : providedSecret === machine.secret;

        if (!isMatch) throw new UnauthorizedException('Invalid machine secret');

        return machine;
    }

    async syncScanResult(body: SyncScanDto, machineSecret: string) {
        const machine = await this.validateMachine(body.machine_id, machineSecret);

        await this.db.update(schema.machines).set({ lastHeartbeatAt: new Date() }).where(eq(schema.machines.id, machine.id));

        const inputSchoolId = body.school_id;
        let schoolId: string | null = null;
        let syncStatus = 'success';

        if (inputSchoolId) {
            const [resolved] = await this.db.select({ id: schema.schools.id }).from(schema.schools)
                .where(or(
                    inputSchoolId.length === 36 ? eq(schema.schools.id, inputSchoolId) : sql`false`,
                    eq(schema.schools.code, inputSchoolId)
                )).limit(1);
            if (resolved) schoolId = resolved.id;
            else syncStatus = 'orphaned';
        } else {
            syncStatus = 'orphaned';
        }

        const isErrored = body.process_status === 'errored' || body.process_status === 'errored_corrected';
        if (isErrored) {
            syncStatus = 'errored';
        }

        const { totalScore, maxPossibleScore, gradingDetails } = await this.gradingService.gradeScan(body.raw_data, body.version);

        return this.db.transaction(async (tx: any) => {
            const [existing] = await tx.select({
                id: schema.scans.id,
                extracted_data: schema.scans.extracted_data,
                errorOperatorCorrectionRef: schema.scans.errorOperatorCorrectionRef
            }).from(schema.scans)
                .where(eq(schema.scans.originalSha, body.original_sha))
                .limit(1);

            if (existing) {
                if (body.process_status === 'errored_corrected' && !existing.errorOperatorCorrectionRef) {
                    const [log] = await tx.insert(schema.correctionLogs).values({
                        scanId: existing.id,
                        action: 'BUBBLE_CORRECTION',
                        oldData: body.original_raw_data || existing.extracted_data,
                        newData: body.raw_data,
                        reason: 'Errored Sheet Operator Correction',
                        status: 'pending'
                    }).returning();

                    await tx.update(schema.scans).set({
                        errorOperatorCorrectionRef: log.id,
                        recognizedRatio: body.recognized_ratio,
                        reviewRequired: true,
                        pending_data: body.raw_data,
                        updatedAt: new Date()
                    }).where(eq(schema.scans.id, existing.id));

                    return { ok: true, status: 'errored_corrected_synced' };
                }

                if (body.is_manually_edited) {
                    const incomingStr = JSON.stringify(body.raw_data);
                    const existingStr = JSON.stringify(existing.extracted_data);

                    if (incomingStr !== existingStr || body.original_raw_data) {
                        await tx.update(schema.scans).set({
                            extracted_data: body.original_raw_data || existing.extracted_data,
                            pending_data: body.raw_data,
                            reviewRequired: true,
                            updatedAt: new Date()
                        }).where(eq(schema.scans.id, existing.id));

                        await tx.insert(schema.correctionLogs).values({
                            scanId: existing.id,
                            action: 'BUBBLE_CORRECTION',
                            oldData: body.original_raw_data || existing.extracted_data,
                            newData: body.raw_data,
                            reason: 'Field Correction Sync',
                            status: 'pending'
                        });

                        return { ok: true, status: 'updated_pending' };
                    }
                }
                return { ok: true, status: 'duplicate' };
            }

            const [result] = await tx.insert(schema.scans).values({
                machineId: body.machine_id,
                schoolId: schoolId,
                originalSha: body.original_sha,
                fileName: body.file_name,
                fileUrl: body.file_url,
                confidence: body.confidence,
                reviewRequired: syncStatus === 'orphaned' || syncStatus === 'errored' || body.is_manually_edited === true,
                status: syncStatus,
                extracted_data: body.original_raw_data || body.raw_data,
                pending_data: body.original_raw_data ? body.raw_data : null,
                totalScore: totalScore,
                maxScore: maxPossibleScore,
                gradingDetails: gradingDetails,
                errorSyncedAt: isErrored ? new Date() : null,
                errorReviewStatus: body.process_status === 'errored_corrected' ? 'reviewed' : (isErrored ? 'pending' : 'pending'),
                errorReviewAction: body.process_status === 'errored_corrected' ? 'operator_corrected' : null,
                recognizedRatio: body.recognized_ratio,
            }).returning();

            if (body.is_manually_edited || body.process_status === 'errored_corrected') {
                const [log] = await tx.insert(schema.correctionLogs).values({
                    scanId: result.id,
                    action: 'BUBBLE_CORRECTION',
                    oldData: body.original_raw_data,
                    newData: body.raw_data,
                    reason: body.process_status === 'errored_corrected' ? 'Errored Sheet Operator Correction' : 'Initial Field Correction',
                    status: 'pending'
                }).returning();

                if (body.process_status === 'errored_corrected') {
                    await tx.update(schema.scans).set({
                        errorOperatorCorrectionRef: log.id
                    }).where(eq(schema.scans.id, result.id));
                }
            }

            console.log(`✅ Scored & Synced: ${result.id} (${totalScore}/${maxPossibleScore})`);
            return { ok: true, id: result.id, score: totalScore };
        });
    }

    async syncActivityLogs(body: SyncLogsDto, machineSecret: string) {
        await this.validateMachine(body.machine_id, machineSecret);

        if (body.logs.length === 0) return { ok: true };

        const scanCorrections = body.logs.filter(l => l.action === 'SCAN_CORRECTION');
        if (scanCorrections.length === 0) return { ok: true, synced: body.logs.length };

        const shas = [...new Set(scanCorrections.map(l => l.details?.sha))].filter(Boolean);
        const scansFound = await this.db.select({ id: schema.scans.id, originalSha: schema.scans.originalSha })
            .from(schema.scans)
            .where(inArray(schema.scans.originalSha, shas));

        const scanMap = Object.fromEntries(scansFound.map((s: any) => [s.originalSha, s.id]));

        const correctionLogEntries = [];

        for (const log of scanCorrections) {
            const scanId = scanMap[log.details?.sha];
            if (scanId) {
                await this.db.update(schema.scans)
                    .set({
                        pending_data: log.details?.new_data,
                        reviewRequired: true,
                        updatedAt: new Date()
                    })
                    .where(eq(schema.scans.id, scanId));

                correctionLogEntries.push({
                    scanId,
                    action: 'BUBBLE_CORRECTION',
                    oldData: log.details?.old_data,
                    newData: log.details?.new_data,
                    reason: `Field Correction Sync: ${log.details?.reason || 'Manual Correction'}`,
                    status: 'pending',
                    createdAt: new Date(log.created_at)
                });
            }
        }

        if (correctionLogEntries.length > 0) {
            await this.db.insert(schema.correctionLogs).values(correctionLogEntries).onConflictDoNothing();
        }

        return { ok: true, synced: body.logs.length };
    }

    async getGlobalStats(user: any) {
        console.log(`[DIAGNOSTIC] getGlobalStats: userScope=${user.visibilityScope}, value=${user.scopeValue}`);

        const validScanCondition = or(
            sql`${schema.scans.status} != 'errored'`,
            inArray(schema.scans.errorReviewAction, ['bubble_corrected', 'operator_corrected'])
        );

        let totalConds: any[] = [validScanCondition];
        let reviewConds: any[] = [validScanCondition, eq(schema.scans.reviewRequired, true)];
        let streamConds: any[] = [validScanCondition];

        if (user.visibilityScope !== 'NATIONAL') {
            if (user.visibilityScope === 'SCHOOL') {
                totalConds.push(eq(schema.scans.schoolId, user.scopeValue));
                reviewConds.push(eq(schema.scans.schoolId, user.scopeValue));
                streamConds.push(eq(schema.scans.schoolId, user.scopeValue));
            } else if (user.visibilityScope === 'REGIONAL') {
                const regionSchools = this.db.select({ id: schema.schools.id }).from(schema.schools).where(eq(schema.schools.regionId, user.scopeValue));
                totalConds.push(inArray(schema.scans.schoolId, regionSchools));
                reviewConds.push(inArray(schema.scans.schoolId, regionSchools));
                streamConds.push(inArray(schema.scans.schoolId, regionSchools));
            }
        }

        let streamQuery = this.db.select({
            id: schema.scans.id,
            schoolId: schema.scans.schoolId,
            machineId: schema.scans.machineId,
            fileName: schema.scans.fileName,
            totalScore: schema.scans.totalScore,
            maxScore: schema.scans.maxScore,
            confidence: schema.scans.confidence,
            status: schema.scans.status,
            createdAt: schema.scans.createdAt,
            reviewRequired: schema.scans.reviewRequired,
            studentFirstName: sql<string>`${schema.scans.extracted_data}->'student_info'->'first_name'->>'answer'`,
            studentLastName: sql<string>`${schema.scans.extracted_data}->'student_info'->'last_name'->>'answer'`,
            lrn: sql<string>`${schema.scans.extracted_data}->'student_info'->'lrn'->>'answer'`,
        }).from(schema.scans).where(and(...streamConds)).$dynamic();

        const [[total], [review], recentScans] = await Promise.all([
            this.db.select({ value: count() }).from(schema.scans).where(and(...totalConds)),
            this.db.select({ value: count() }).from(schema.scans).where(and(...reviewConds)),
            streamQuery.orderBy(desc(schema.scans.createdAt)).limit(20)
        ]);

        let scopeName = 'Global Sync Stream';
        if (user.visibilityScope === 'SCHOOL') {
            const [school] = await this.db.select({ name: schema.schools.name }).from(schema.schools).where(eq(schema.schools.id, user.scopeValue)).limit(1);
            if (school) scopeName = school.name;
        } else if (user.visibilityScope === 'REGIONAL') {
            const [region] = await this.db.select({ name: schema.regions.name }).from(schema.regions).where(eq(schema.regions.id, user.scopeValue)).limit(1);
            if (region) scopeName = region.name;
        }

        const sIds = [...new Set(recentScans.map((s: any) => s.schoolId))].filter(Boolean) as string[];
        const schools = sIds.length > 0 ? await this.db.select({ id: schema.schools.id, name: schema.schools.name }).from(schema.schools).where(inArray(schema.schools.id, sIds)) : [];
        const schoolMap = Object.fromEntries(schools.map((s: any) => [s.id, s.name]));

        return {
            totalScans: Number(total.value),
            reviewRequired: Number(review.value),
            scopeName,
            recentScans: recentScans.map((s: any) => this.decorateScan(s, schoolMap))
        };
    }

    public decorateScan(s: any, schoolMap: Record<string, string>, includeBlob: boolean = false) {
        const info = s.extracted_data?.student_info;
        const first = s.studentFirstName || info?.first_name?.answer || info?.firstName?.answer || '';
        const last = s.studentLastName || info?.last_name?.answer || info?.lastName?.answer || '';
        const lrn = s.lrn || info?.lrn?.answer || '---';
        const studentName = (first || last) ? `${first} ${last}`.trim() : 'Unidentified';

        const { extracted_data: _blob, studentFirstName: _f, studentLastName: _l, ...rest } = s;

        return {
            ...rest,
            ...(includeBlob ? { extracted_data: _blob } : {}),
            schoolName: schoolMap[s.schoolId] || 'Unknown',
            studentName,
            lrn,
        };
    }

    async getScan(id: string, user: any) {
        const [scan] = await this.db.select().from(schema.scans).where(eq(schema.scans.id, id)).limit(1);
        if (!scan) throw new NotFoundException();

        if (user.visibilityScope === 'SCHOOL' && scan.schoolId !== user.scopeValue) {
            throw new UnauthorizedException('Access denied');
        }

        const schoolMap: Record<string, string> = {};
        if (scan.schoolId) {
            const [school] = await this.db.select({ name: schema.schools.name }).from(schema.schools).where(eq(schema.schools.id, scan.schoolId)).limit(1);
            if (school) schoolMap[scan.schoolId] = school.name;
        }

        let reviewerName = null;
        if (scan.errorReviewedBy) {
            const [reviewer] = await this.db.select({ firstName: schema.users.firstName, lastName: schema.users.lastName, email: schema.users.email })
                .from(schema.users).where(eq(schema.users.id, scan.errorReviewedBy)).limit(1);
            if (reviewer) {
                reviewerName = `${reviewer.firstName || ''} ${reviewer.lastName || ''}`.trim() || reviewer.email;
            }
        }

        return {
            ...this.decorateScan(scan, schoolMap, true),
            reviewerName
        };
    }

    async listErroredScans(limit: string, offset: string, reviewStatus: string, search: string, user: any) {
        const l = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
        const o = Math.max(parseInt(offset) || 0, 0);
        const conditions = [eq(schema.scans.status, 'errored')];

        if (user.visibilityScope === 'SCHOOL') conditions.push(eq(schema.scans.schoolId, user.scopeValue));
        else if (user.visibilityScope === 'REGIONAL') {
            const regionSchools = this.db.select({ id: schema.schools.id }).from(schema.schools).where(eq(schema.schools.regionId, user.scopeValue));
            conditions.push(inArray(schema.scans.schoolId, regionSchools));
        }

        if (reviewStatus) conditions.push(eq(schema.scans.errorReviewStatus, reviewStatus));

        if (search) {
            const s = `%${search.toLowerCase()}%`;
            const firstName = sql`lower(COALESCE(${schema.scans.pending_data}->'student_info'->'first_name'->>'answer', ${schema.scans.extracted_data}->'student_info'->'first_name'->>'answer'))`;
            const lastName = sql`lower(COALESCE(${schema.scans.pending_data}->'student_info'->'last_name'->>'answer', ${schema.scans.extracted_data}->'student_info'->'last_name'->>'answer'))`;
            const lrn = sql`lower(COALESCE(${schema.scans.pending_data}->'student_info'->'lrn'->>'answer', ${schema.scans.extracted_data}->'student_info'->'lrn'->>'answer'))`;

            const searchCondition = or(
                sql`${firstName} LIKE ${s}`,
                sql`${lastName} LIKE ${s}`,
                sql`${lrn} LIKE ${s}`
            );
            if (searchCondition) conditions.push(searchCondition);
        }

        const whereClause = and(...conditions);
        const itemsQuery = this.db.select({
            id: schema.scans.id,
            schoolId: schema.scans.schoolId,
            machineId: schema.scans.machineId,
            fileName: schema.scans.fileName,
            confidence: schema.scans.confidence,
            status: schema.scans.status,
            createdAt: schema.scans.createdAt,
            errorReviewStatus: schema.scans.errorReviewStatus,
            errorReviewAction: schema.scans.errorReviewAction,
            errorOperatorCorrectionRef: schema.scans.errorOperatorCorrectionRef,
            recognizedRatio: schema.scans.recognizedRatio,
            studentFirstName: sql<string>`${schema.scans.extracted_data}->'student_info'->'first_name'->>'answer'`,
            studentLastName: sql<string>`${schema.scans.extracted_data}->'student_info'->'last_name'->>'answer'`,
        }).from(schema.scans).$dynamic();

        if (whereClause) itemsQuery.where(whereClause);

        const items = await itemsQuery.orderBy(desc(schema.scans.createdAt)).limit(l).offset(o);

        let totalQuery = this.db.select({ value: count() }).from(schema.scans).$dynamic();
        if (whereClause) totalQuery.where(whereClause);
        const [totalResult] = await totalQuery;

        const sIds = [...new Set(items.map((i: any) => i.schoolId))].filter(Boolean) as string[];
        const schoolNames = sIds.length > 0 ? await this.db.select({ id: schema.schools.id, name: schema.schools.name }).from(schema.schools).where(inArray(schema.schools.id, sIds)) : [];
        const schoolMap = Object.fromEntries(schoolNames.map((s: any) => [s.id, s.name]));

        return {
            items: items.map((s: any) => ({
                ...s,
                schoolName: schoolMap[s.schoolId] || 'Unknown',
                studentName: `${s.studentFirstName || ''} ${s.studentLastName || ''}`.trim() || '---'
            })),
            total: Number(totalResult.value),
            limit: l, offset: o
        };
    }

    async markInvalid(id: string, notes: string, userId: string) {
        const [scan] = await this.db.select({ status: schema.scans.status }).from(schema.scans).where(eq(schema.scans.id, id)).limit(1);
        if (!scan) throw new NotFoundException('Scan not found');
        if (scan.status !== 'errored') throw new BadRequestException('Scan is not in errored state');

        await this.db.update(schema.scans).set({
            errorReviewStatus: 'reviewed',
            errorReviewAction: 'marked_invalid',
            errorReviewedBy: userId,
            errorReviewedAt: new Date(),
            updatedAt: new Date()
        }).where(eq(schema.scans.id, id));

        await this.db.insert(schema.correctionLogs).values({
            scanId: id,
            action: 'ERRORED_SHEET_MARKED_INVALID',
            reason: notes || 'Reviewer marked as invalid',
            status: 'approved',
            userId: userId
        });

        return { ok: true };
    }

    async bubbleCorrection(id: string, raw_data: any, reason: string, version: string, userId: string) {
        const [scan] = await this.db.select({ status: schema.scans.status }).from(schema.scans).where(eq(schema.scans.id, id)).limit(1);
        if (!scan) throw new NotFoundException('Scan not found');
        if (scan.status !== 'errored') throw new BadRequestException('Scan is not in errored state');

        const { totalScore, maxPossibleScore, gradingDetails } = await this.gradingService.gradeScan(raw_data, version);

        await this.db.update(schema.scans).set({
            extracted_data: raw_data,
            totalScore,
            maxScore: maxPossibleScore,
            gradingDetails,
            errorReviewStatus: 'reviewed',
            errorReviewAction: 'bubble_corrected',
            errorReviewedBy: userId,
            errorReviewedAt: new Date(),
            reviewRequired: false,
            updatedAt: new Date()
        }).where(eq(schema.scans.id, id));

        await this.db.insert(schema.correctionLogs).values({
            scanId: id,
            action: 'ERRORED_SHEET_BUBBLE_CORRECTED',
            oldData: scan.extracted_data,
            newData: raw_data,
            reason: reason || 'Authoritative bubble correction for errored sheet',
            status: 'approved',
            userId: userId
        });

        return { ok: true, score: totalScore };
    }

    async listScans(limit: string, offset: string, search: string, schoolId: string, regionId: string, user: any) {
        const l = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
        const o = Math.max(parseInt(offset) || 0, 0);
        const conditions: any[] = [
            or(
                sql`${schema.scans.status} != 'errored'`,
                inArray(schema.scans.errorReviewAction, ['bubble_corrected', 'operator_corrected'])
            )
        ];

        if (user.visibilityScope === 'SCHOOL') conditions.push(eq(schema.scans.schoolId, user.scopeValue));
        else if (user.visibilityScope === 'REGIONAL') {
            const regionSchools = this.db.select({ id: schema.schools.id }).from(schema.schools).where(eq(schema.schools.regionId, user.scopeValue));
            conditions.push(inArray(schema.scans.schoolId, regionSchools));
        }

        if (schoolId) conditions.push(eq(schema.scans.schoolId, schoolId));
        if (regionId && user.visibilityScope === 'NATIONAL') {
            const regionSchools = this.db.select({ id: schema.schools.id }).from(schema.schools).where(eq(schema.schools.regionId, regionId));
            conditions.push(inArray(schema.scans.schoolId, regionSchools));
        }

        if (search) {
            const s = `%${search.toLowerCase()}%`;
            const firstName = sql`lower(COALESCE(${schema.scans.pending_data}->'student_info'->'first_name'->>'answer', ${schema.scans.extracted_data}->'student_info'->'first_name'->>'answer'))`;
            const lastName = sql`lower(COALESCE(${schema.scans.pending_data}->'student_info'->'last_name'->>'answer', ${schema.scans.extracted_data}->'student_info'->'last_name'->>'answer'))`;
            const lrn = sql`lower(COALESCE(${schema.scans.pending_data}->'student_info'->'lrn'->>'answer', ${schema.scans.extracted_data}->'student_info'->'lrn'->>'answer'))`;

            const searchCondition = or(
                sql`${firstName} LIKE ${s}`,
                sql`${lastName} LIKE ${s}`,
                sql`${lrn} LIKE ${s}`
            );
            if (searchCondition) conditions.push(searchCondition);
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
        const itemsQuery = this.db.select({
            id: schema.scans.id,
            schoolId: schema.scans.schoolId,
            machineId: schema.scans.machineId,
            fileName: schema.scans.fileName,
            totalScore: schema.scans.totalScore,
            maxScore: schema.scans.maxScore,
            confidence: schema.scans.confidence,
            status: schema.scans.status,
            createdAt: schema.scans.createdAt,
            reviewRequired: schema.scans.reviewRequired,
            studentFirstName: sql<string>`${schema.scans.extracted_data}->'student_info'->'first_name'->>'answer'`,
            studentLastName: sql<string>`${schema.scans.extracted_data}->'student_info'->'last_name'->>'answer'`,
            lrn: sql<string>`${schema.scans.extracted_data}->'student_info'->'lrn'->>'answer'`,
        }).from(schema.scans).$dynamic();

        if (whereClause) itemsQuery.where(whereClause);

        const items = await itemsQuery.orderBy(desc(schema.scans.createdAt)).limit(l).offset(o);

        let totalQuery = this.db.select({ value: count() }).from(schema.scans).$dynamic();
        if (whereClause) totalQuery.where(whereClause);
        const [totalResult] = await totalQuery;

        const sIds = [...new Set(items.map((i: any) => i.schoolId))].filter(Boolean) as string[];
        const schoolNames = sIds.length > 0 ? await this.db.select({ id: schema.schools.id, name: schema.schools.name }).from(schema.schools).where(inArray(schema.schools.id, sIds)) : [];
        const schoolMap = Object.fromEntries(schoolNames.map((s: any) => [s.id, s.name]));

        return {
            items: items.map((s: any) => this.decorateScan(s, schoolMap)),
            total: Number(totalResult.value),
            limit: l, offset: o
        };
    }

    async getMachineResolutions(machineId: string) {
        const resolutions = await this.db.select({
            sha: schema.scans.originalSha,
            status: schema.scans.status,
            errorReviewAction: schema.scans.errorReviewAction,
            reviewRequired: schema.scans.reviewRequired,
            updatedAt: schema.scans.updatedAt
        })
            .from(schema.scans)
            .where(and(
                eq(schema.scans.machineId, machineId),
                eq(schema.scans.reviewRequired, false)
            ))
            .limit(100);

        return resolutions;
    }

    async getMachineOperators(machineId: string) {
        const assignedUsers = await this.db.select({
            id: schema.users.id,
            email: schema.users.email,
            firstName: schema.users.firstName,
            lastName: schema.users.lastName,
            userType: schema.users.userType
        }).from(schema.users).innerJoin(schema.userMachines, eq(schema.users.id, schema.userMachines.userId)).where(eq(schema.userMachines.machineId, machineId));
        
        return assignedUsers.map((user: any) => ({
            id: user.id, email: user.email, first_name: user.firstName, last_name: user.lastName, user_type: user.userType,
        }));
    }

    async getMachineSchools(machineId: string) {
        const assignments = await this.db.select().from(schema.machineAssignments).where(eq(schema.machineAssignments.machineId, machineId));
        if (assignments.length === 0) return [];

        const conditions = [];
        for (const assignment of assignments) {
            if (assignment.scope === 'SCHOOL') conditions.push(eq(schema.schools.id, assignment.scopeValue));
            else if (assignment.scope === 'REGION') conditions.push(eq(schema.schools.regionId, assignment.scopeValue));
            else if (assignment.scope === 'NATIONAL') return this.db.select({ id: schema.schools.id, name: schema.schools.name, code: schema.schools.code, regionId: schema.schools.regionId, division: schema.schools.division }).from(schema.schools);
        }

        if (conditions.length === 0) return [];

        return this.db.select({
            id: schema.schools.id,
            name: schema.schools.name,
            code: schema.schools.code,
            regionId: schema.schools.regionId,
            division: schema.schools.division
        }).from(schema.schools).where(or(...conditions));
    }
}
