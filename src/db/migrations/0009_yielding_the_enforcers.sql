CREATE TABLE `task_comment` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`user_id` text NOT NULL,
	`content` text NOT NULL,
	`parent_id` text,
	`is_edited` integer DEFAULT false,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`task_id`) REFERENCES `project_task`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `project_task` ADD `start_date` integer;