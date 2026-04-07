import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const scans = sqliteTable('scans', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    fileName: text('file_name'),
    filePath: text('file_path'),
    
    // Data Integrity
    originalSha: text('original_sha'),
    
    // Sync Status: pending | synced | error
    syncStatus: text('sync_status').default('pending'),
    
    // OMR Processing status: success | error | pending_approval | errored | errored_corrected
    processStatus: text('process_status').default('pending'),
    
    // Errored Sheet Fields
    errorDetectedAt: text('error_detected_at'),
    errorReason: text('error_reason'),
    recognizedRatio: real('recognized_ratio'),
    operatorCorrectionSubmittedAt: text('operator_correction_submitted_at'),
    operatorCorrectionBy: text('operator_correction_by'),
    
    // Sync-back fields from Cloud Review
    cloudReviewStatus: text('cloud_review_status').default('pending'), // 'pending' | 'reviewed'
    cloudReviewAction: text('cloud_review_action'), // 'marked_invalid' | 'bubble_corrected' | 'operator_corrected'
    cloudReviewSyncedAt: text('cloud_review_synced_at'),
    
    confidence: real('confidence'),
    reviewRequired: integer('review_required', { mode: 'boolean' }).default(false),
    isManuallyEdited: integer('is_manually_edited', { mode: 'boolean' }).default(false),
    
    // Raw OMR data (JSON string in SQLite)
    rawData: text('raw_data'),
    
    // Multi-tenancy metadata
    schoolId: text('school_id'),
    machineId: text('machine_id'),

    createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const activityLogs = sqliteTable('activity_logs', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: text('user_id').notNull(),
    scanId: integer('scan_id').notNull(),
    action: text('action').notNull(),
    statusAfter: text('status_after'),
    details: text('details'), // JSON string
    machineId: text('machine_id'),
    isSynced: integer('is_synced', { mode: 'boolean' }).default(false),
    createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});
