"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.correctionLogs = exports.scans = exports.answerKeys = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const schools_1 = require("./schools");
const users_1 = require("./users");
exports.answerKeys = (0, pg_core_1.pgTable)('answer_keys', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    examName: (0, pg_core_1.varchar)('exam_name', { length: 255 }).notNull(),
    subject: (0, pg_core_1.varchar)('subject', { length: 50 }).notNull(),
    version: (0, pg_core_1.varchar)('version', { length: 50 }).default('2026-V1').notNull(),
    answers: (0, pg_core_1.jsonb)('answers').notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
    subjIdx: (0, pg_core_1.index)('key_subject_idx').on(t.subject),
    versionIdx: (0, pg_core_1.index)('key_version_idx').on(t.version),
    uniqueSubjVer: (0, pg_core_1.uniqueIndex)('answer_keys_subject_version_idx').on(t.subject, t.version),
}));
exports.scans = (0, pg_core_1.pgTable)('omr_scans', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    schoolId: (0, pg_core_1.uuid)('school_id').references(() => schools_1.schools.id, { onDelete: 'set null' }),
    machineId: (0, pg_core_1.varchar)('machine_id', { length: 255 }).notNull(),
    fileName: (0, pg_core_1.varchar)('file_name', { length: 255 }),
    fileUrl: (0, pg_core_1.varchar)('file_url', { length: 512 }),
    originalSha: (0, pg_core_1.varchar)('original_sha', { length: 64 }).notNull().unique(),
    status: (0, pg_core_1.varchar)('status', { length: 50 }).notNull().default('pending'),
    confidence: (0, pg_core_1.real)('confidence'),
    reviewRequired: (0, pg_core_1.boolean)('review_required').notNull().default(false),
    extracted_data: (0, pg_core_1.jsonb)('extracted_data'),
    pending_data: (0, pg_core_1.jsonb)('pending_data'),
    totalScore: (0, pg_core_1.integer)('total_score'),
    maxScore: (0, pg_core_1.integer)('max_score'),
    gradingDetails: (0, pg_core_1.jsonb)('grading_details'),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
    schoolIdx: (0, pg_core_1.index)('scans_school_idx').on(t.schoolId),
    statusIdx: (0, pg_core_1.index)('scans_status_idx').on(t.status),
    shaIdx: (0, pg_core_1.uniqueIndex)('scans_sha_idx').on(t.originalSha),
    machineIdx: (0, pg_core_1.index)('scans_machine_idx').on(t.machineId),
    reviewIdx: (0, pg_core_1.index)('scans_review_required_idx').on(t.reviewRequired),
}));
exports.correctionLogs = (0, pg_core_1.pgTable)('correction_logs', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    scanId: (0, pg_core_1.uuid)('scan_id').notNull().references(() => exports.scans.id, { onDelete: 'cascade' }),
    userId: (0, pg_core_1.uuid)('user_id').references(() => users_1.users.id),
    action: (0, pg_core_1.varchar)('action', { length: 50 }).notNull(),
    oldData: (0, pg_core_1.jsonb)('old_data'),
    newData: (0, pg_core_1.jsonb)('new_data'),
    reason: (0, pg_core_1.text)('reason'),
    status: (0, pg_core_1.varchar)('status', { length: 50 }).notNull().default('pending'),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
});
//# sourceMappingURL=scans.js.map