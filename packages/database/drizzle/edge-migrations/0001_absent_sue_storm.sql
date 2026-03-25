CREATE TABLE `activity_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`scan_id` integer NOT NULL,
	`action` text NOT NULL,
	`status_after` text,
	`details` text,
	`machine_id` text,
	`is_synced` integer DEFAULT false,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
ALTER TABLE scans ADD `is_manually_edited` integer DEFAULT false;