CREATE TABLE `project_resource_category` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`icon` text,
	`color` text DEFAULT '#6366f1',
	`position` integer DEFAULT 0,
	`project_id` text,
	`is_system` integer DEFAULT false,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `project_resource_link` (
	`id` text PRIMARY KEY NOT NULL,
	`resource_id` text NOT NULL,
	`url` text NOT NULL,
	`preview_url` text,
	`label` text,
	`domain` text,
	`link_status` text DEFAULT 'UNKNOWN' NOT NULL,
	`last_checked_at` integer,
	`added_by_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`resource_id`) REFERENCES `project_resource`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`added_by_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `project_resource` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`project_area_id` text,
	`task_id` text,
	`category_id` text,
	`name` text NOT NULL,
	`description` text,
	`created_by_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_area_id`) REFERENCES `project_area`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`task_id`) REFERENCES `project_task`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `project_resource_category`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
