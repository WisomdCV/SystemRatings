CREATE TABLE `event_invitee` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`user_id` text NOT NULL,
	`status` text DEFAULT 'PENDING',
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`event_id`) REFERENCES `event`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `event_invitee_event_id_user_id_unique` ON `event_invitee` (`event_id`,`user_id`);--> statement-breakpoint
ALTER TABLE `area` ADD `can_create_events` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `area` ADD `can_create_individual_events` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `event` ADD `event_scope` text DEFAULT 'IISE' NOT NULL;--> statement-breakpoint
ALTER TABLE `event` ADD `event_type` text DEFAULT 'GENERAL' NOT NULL;--> statement-breakpoint
ALTER TABLE `event` ADD `project_id` text REFERENCES project(id);--> statement-breakpoint
ALTER TABLE `event` ADD `target_project_area_id` text REFERENCES project_area(id);--> statement-breakpoint
ALTER TABLE `event` ADD `tracks_attendance` integer DEFAULT true;--> statement-breakpoint
ALTER TABLE `project_area` ADD `members_can_create_events` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `project_role` ADD `can_create_events` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `project_role` ADD `can_view_all_area_events` integer DEFAULT false;