ALTER TABLE "omr_scans" ADD COLUMN "error_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "omr_scans" ADD COLUMN "error_review_status" varchar(50) DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "omr_scans" ADD COLUMN "error_reviewed_by" uuid;--> statement-breakpoint
ALTER TABLE "omr_scans" ADD COLUMN "error_reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "omr_scans" ADD COLUMN "error_review_action" varchar(50);--> statement-breakpoint
ALTER TABLE "omr_scans" ADD COLUMN "error_operator_correction_ref" uuid;--> statement-breakpoint
ALTER TABLE "omr_scans" ADD CONSTRAINT "omr_scans_error_reviewed_by_users_id_fk" FOREIGN KEY ("error_reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;