CREATE TABLE `scans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`file_name` text,
	`file_path` text,
	`original_sha` text,
	`sync_status` text DEFAULT 'pending',
	`process_status` text DEFAULT 'pending',
	`confidence` real,
	`review_required` integer DEFAULT false,
	`raw_data` text,
	`school_id` text,
	`machine_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
