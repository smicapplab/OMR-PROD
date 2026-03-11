import { pgTable, uuid, varchar, timestamp, index, uniqueIndex, integer, real, text, boolean, jsonb } from 'drizzle-orm/pg-core';
import { schools } from './schools';
import { users } from './users';

export const answerKeys = pgTable('answer_keys', {
    id: uuid('id').defaultRandom().primaryKey(),
    examName: varchar('exam_name', { length: 255 }).notNull(),
    subject: varchar('subject', { length: 50 }).notNull(), // math, english, etc.
    version: varchar('version', { length: 50 }).default('2026-V1').notNull(),
    
    // Key-value pair of question numbers and correct letters: { "1": "A", "2": "C" }
    answers: jsonb('answers').notNull(),
    
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
    subjIdx: index('key_subject_idx').on(t.subject),
    versionIdx: index('key_version_idx').on(t.version),
    uniqueSubjVer: uniqueIndex('answer_keys_subject_version_idx').on(t.subject, t.version),
}));

export const scans = pgTable('omr_scans', {
    id: uuid('id').defaultRandom().primaryKey(),
    schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'set null' }),
    machineId: varchar('machine_id', { length: 255 }).notNull(),
    
    fileName: varchar('file_name', { length: 255 }),
    fileUrl: varchar('file_url', { length: 512 }),
    originalSha: varchar('original_sha', { length: 64 }).notNull().unique(),
    
    status: varchar('status', { length: 50 }).notNull().default('pending'),
    confidence: real('confidence'),
    reviewRequired: boolean('review_required').notNull().default(false),
    
    // Extracted OMR data (Letters)
    extracted_data: jsonb('extracted_data'),
    pending_data: jsonb('pending_data'), // Proposed changes awaiting QA
    
    // --- SCORING DATA (CLOUD ONLY) ---
    totalScore: integer('total_score'),
    maxScore: integer('max_score'),
    
    // Detailed grading: { "math": { "score": 38, "total": 40, "results": { "1": true, "2": false } } }
    gradingDetails: jsonb('grading_details'),
    
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
    schoolIdx: index('scans_school_idx').on(t.schoolId),
    statusIdx: index('scans_status_idx').on(t.status),
    shaIdx: uniqueIndex('scans_sha_idx').on(t.originalSha),
    machineIdx: index('scans_machine_idx').on(t.machineId),
}));

export const correctionLogs = pgTable('correction_logs', {
    id: uuid('id').defaultRandom().primaryKey(),
    scanId: uuid('scan_id').notNull().references(() => scans.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id),
    action: varchar('action', { length: 50 }).notNull(), // 'SCHOOL_ASSIGNMENT' | 'BUBBLE_CORRECTION'
    oldData: jsonb('old_data'),
    newData: jsonb('new_data'),
    reason: text('reason'),
    status: varchar('status', { length: 50 }).notNull().default('approved'), // 'pending' | 'approved' | 'rejected'
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
