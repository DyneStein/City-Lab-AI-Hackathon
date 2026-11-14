CREATE TABLE `gmail_pending` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`message_id` text NOT NULL,
	`attachment_id` text NOT NULL,
	`filename` text NOT NULL,
	`mime_type` text NOT NULL,
	`sender` text NOT NULL,
	`received_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pending_msg_att_idx` ON `gmail_pending` (`user_id`,`message_id`,`filename`);--> statement-breakpoint
ALTER TABLE `email_connections` ADD `senders` text DEFAULT '[]' NOT NULL;