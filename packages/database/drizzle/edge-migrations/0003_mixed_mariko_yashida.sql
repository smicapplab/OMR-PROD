ALTER TABLE `scans` ADD `recognized_ratio` real;--> statement-breakpoint
ALTER TABLE `scans` ADD `cloud_review_status` text DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `scans` ADD `cloud_review_action` text;--> statement-breakpoint
ALTER TABLE `scans` ADD `cloud_review_synced_at` text;