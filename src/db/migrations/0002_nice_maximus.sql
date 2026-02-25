CREATE TABLE `custom_role_permission` (
	`id` text PRIMARY KEY NOT NULL,
	`custom_role_id` text NOT NULL,
	`permission` text NOT NULL,
	FOREIGN KEY (`custom_role_id`) REFERENCES `custom_role`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `custom_role` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`color` text DEFAULT '#6366f1',
	`position` integer DEFAULT 0,
	`is_system` integer DEFAULT false,
	`created_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE UNIQUE INDEX `custom_role_name_unique` ON `custom_role` (`name`);--> statement-breakpoint
CREATE TABLE `project_area` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`color` text DEFAULT '#94a3b8',
	`position` integer DEFAULT 0,
	`is_system` integer DEFAULT false
);
--> statement-breakpoint
CREATE TABLE `project_role` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`hierarchy_level` integer DEFAULT 10 NOT NULL,
	`color` text DEFAULT '#6366f1',
	`permissions` text,
	`is_system` integer DEFAULT false
);
--> statement-breakpoint
CREATE TABLE `user_custom_role` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`custom_role_id` text NOT NULL,
	`assigned_at` integer DEFAULT (unixepoch()),
	`assigned_by_id` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`custom_role_id`) REFERENCES `custom_role`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assigned_by_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_project_member` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`user_id` text NOT NULL,
	`project_role_id` text NOT NULL,
	`project_area_id` text,
	`joined_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_role_id`) REFERENCES `project_role`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_area_id`) REFERENCES `project_area`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_project_member`("id", "project_id", "user_id", "project_role_id", "project_area_id", "joined_at") SELECT "id", "project_id", "user_id", "project_role_id", "project_area_id", "joined_at" FROM `project_member`;--> statement-breakpoint
DROP TABLE `project_member`;--> statement-breakpoint
ALTER TABLE `__new_project_member` RENAME TO `project_member`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `area` ADD `is_leadership_area` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `project_task` ADD `project_area_id` text REFERENCES project_area(id);