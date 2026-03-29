CREATE TABLE `area_permission` (
	`id` text PRIMARY KEY NOT NULL,
	`area_id` text NOT NULL,
	`permission` text NOT NULL,
	FOREIGN KEY (`area_id`) REFERENCES `area`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `project_role_permission` (
	`id` text PRIMARY KEY NOT NULL,
	`project_role_id` text NOT NULL,
	`permission` text NOT NULL,
	FOREIGN KEY (`project_role_id`) REFERENCES `project_role`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `area` ADD `color` text DEFAULT '#6366f1';--> statement-breakpoint
ALTER TABLE `area` DROP COLUMN `can_create_events`;--> statement-breakpoint
ALTER TABLE `area` DROP COLUMN `can_create_individual_events`;--> statement-breakpoint
ALTER TABLE `project_area` DROP COLUMN `members_can_create_events`;--> statement-breakpoint
ALTER TABLE `project_role` DROP COLUMN `permissions`;--> statement-breakpoint
ALTER TABLE `project_role` DROP COLUMN `can_create_events`;--> statement-breakpoint
ALTER TABLE `project_role` DROP COLUMN `can_view_all_area_events`;