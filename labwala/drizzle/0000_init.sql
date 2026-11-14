CREATE TABLE `access_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`grantee_id` text NOT NULL,
	`scope` text NOT NULL,
	`report_id` text,
	`expires_at` integer,
	`revoked_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `grants_grantee_idx` ON `access_grants` (`grantee_id`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text,
	`action` text NOT NULL,
	`target_type` text,
	`target_id` text,
	`meta` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_actor_idx` ON `audit_logs` (`actor_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `consents` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`granted` integer NOT NULL,
	`scope` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `consents_user_idx` ON `consents` (`user_id`,`kind`);--> statement-breakpoint
CREATE TABLE `doctors` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`specialty` text NOT NULL,
	`hospital_id` text,
	`city` text NOT NULL,
	`phone` text,
	`booking_info` text,
	`source` text NOT NULL,
	`verified_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `email_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`email_address` text NOT NULL,
	`scopes` text NOT NULL,
	`refresh_token_enc` text NOT NULL,
	`selected_lab_ids` text DEFAULT '[]' NOT NULL,
	`last_sync_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `explanations` (
	`id` text PRIMARY KEY NOT NULL,
	`report_id` text NOT NULL,
	`kind` text NOT NULL,
	`test_result_id` text,
	`language` text NOT NULL,
	`content_enc` text NOT NULL,
	`generator` text NOT NULL,
	`input_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `reports`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `expl_lookup_idx` ON `explanations` (`report_id`,`kind`,`language`);--> statement-breakpoint
CREATE TABLE `family_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`owner_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `family_invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`invited_by` text NOT NULL,
	`email` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`accepted_at` integer,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `family_groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `family_invitations_token_hash_unique` ON `family_invitations` (`token_hash`);--> statement-breakpoint
CREATE TABLE `family_members` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`user_id` text,
	`display_name` text NOT NULL,
	`role` text NOT NULL,
	`guardian_user_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `family_groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `fm_group_idx` ON `family_members` (`group_id`);--> statement-breakpoint
CREATE TABLE `family_relationships` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`from_member_id` text NOT NULL,
	`to_member_id` text NOT NULL,
	`relation` text NOT NULL,
	`confirmed_by_both` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `family_groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `hospitals` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`city` text NOT NULL,
	`address` text,
	`phone` text,
	`website` text,
	`specialties` text DEFAULT '[]' NOT NULL,
	`source` text NOT NULL,
	`verified_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `knowledge_chunks` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`test_key` text,
	`loinc` text,
	`content` text NOT NULL,
	`embedding` text,
	FOREIGN KEY (`source_id`) REFERENCES `knowledge_sources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `chunks_key_idx` ON `knowledge_chunks` (`test_key`);--> statement-breakpoint
CREATE TABLE `knowledge_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`publisher` text NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`last_reviewed` text,
	`retrieved_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `labs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`verified_domains` text DEFAULT '[]' NOT NULL,
	`known_senders` text DEFAULT '[]' NOT NULL,
	`report_patterns` text DEFAULT '[]' NOT NULL,
	`formats` text DEFAULT '["pdf"]' NOT NULL,
	`api_info` text,
	`verified_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `medical_history` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`text_enc` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`ref_id` text,
	`read_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notif_user_idx` ON `notifications` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `pii_vault` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`scope` text NOT NULL,
	`placeholder` text NOT NULL,
	`entity_type` text NOT NULL,
	`value_enc` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vault_scope_ph_idx` ON `pii_vault` (`scope`,`placeholder`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`full_name` text NOT NULL,
	`date_of_birth` text,
	`age_years` integer,
	`language` text DEFAULT 'en' NOT NULL,
	`country` text DEFAULT 'Pakistan' NOT NULL,
	`region` text,
	`sex` text DEFAULT 'undisclosed',
	`phone` text,
	`onboarded_at` integer,
	`voice_notifications` integer DEFAULT false NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`source` text NOT NULL,
	`status` text NOT NULL,
	`file_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`file_size` integer NOT NULL,
	`file_sha256` text NOT NULL,
	`storage_key` text NOT NULL,
	`lab_name` text,
	`lab_id` text,
	`report_date` text,
	`extraction_method` text,
	`ocr_confidence` real,
	`page_count` integer,
	`layout_enc` text,
	`error_code` text,
	`created_at` integer NOT NULL,
	`confirmed_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `reports_user_idx` ON `reports` (`user_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `reports_user_sha_idx` ON `reports` (`user_id`,`file_sha256`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `share_links` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`report_id` text NOT NULL,
	`doctor_email` text NOT NULL,
	`scope` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`claimed_at` integer,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`report_id`) REFERENCES `reports`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `share_links_token_hash_unique` ON `share_links` (`token_hash`);--> statement-breakpoint
CREATE TABLE `test_results` (
	`id` text PRIMARY KEY NOT NULL,
	`report_id` text NOT NULL,
	`user_id` text NOT NULL,
	`position` integer NOT NULL,
	`test_name` text NOT NULL,
	`canonical_key` text,
	`value_text` text NOT NULL,
	`value_num` real,
	`unit` text,
	`ref_text` text,
	`ref_low` real,
	`ref_high` real,
	`lab_flag` text,
	`status` text NOT NULL,
	`status_reason` text,
	`needs_review` integer DEFAULT false NOT NULL,
	`review_reason` text,
	`user_verified` integer DEFAULT false NOT NULL,
	`page` integer,
	`bbox` text,
	`source_line` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `reports`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `results_report_idx` ON `test_results` (`report_id`,`position`);--> statement-breakpoint
CREATE INDEX `results_user_key_idx` ON `test_results` (`user_id`,`canonical_key`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);