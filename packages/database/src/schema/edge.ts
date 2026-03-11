import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const scans = sqliteTable('scans', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    fileName: text('file_name'),
    filePath: text('file_path'),
    
    // Forensic Integrity
    originalSha: text('original_sha'),
    
    // Sync Status: pending | synced | error
    syncStatus: text('sync_status').default('pending'),
    
    // OMR Processing status: success | error | pending_approval
    processStatus: text('process_status').default('pending'),
    
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
