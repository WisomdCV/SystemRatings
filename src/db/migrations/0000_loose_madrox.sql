CREATE TABLE `account` (
	`userId` text NOT NULL,
	`type` text NOT NULL,
	`provider` text NOT NULL,
	`providerAccountId` text NOT NULL,
	`refresh_token` text,
	`access_token` text,
	`expires_at` integer,
	`token_type` text,
	`scope` text,
	`id_token` text,
	`session_state` text,
	PRIMARY KEY(`provider`, `providerAccountId`),
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `area_kpi_summary` (
	`id` text PRIMARY KEY NOT NULL,
	`area_id` text NOT NULL,
	`semester_id` text NOT NULL,
	`month` integer NOT NULL,
	`year` integer NOT NULL,
	`average_kpi` real DEFAULT 0,
	`ranking_position` integer,
	FOREIGN KEY (`area_id`) REFERENCES `area`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`semester_id`) REFERENCES `semester`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `area` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`code` text,
	`description` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `area_code_unique` ON `area` (`code`);--> statement-breakpoint
CREATE TABLE `attendance_record` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`user_id` text NOT NULL,
	`status` text NOT NULL,
	`justification_status` text DEFAULT 'NONE',
	`justification_reason` text,
	`justification_link` text,
	`justification_note` text,
	`admin_feedback` text,
	`reviewed_by_id` text,
	FOREIGN KEY (`event_id`) REFERENCES `event`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reviewed_by_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `event` (
	`id` text PRIMARY KEY NOT NULL,
	`semester_id` text NOT NULL,
	`created_by_id` text,
	`title` text NOT NULL,
	`description` text,
	`target_area_id` text,
	`date` integer NOT NULL,
	`start_time` text,
	`end_time` text,
	`is_virtual` integer DEFAULT false,
	`meet_link` text,
	`google_event_id` text,
	`status` text DEFAULT 'SCHEDULED',
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`semester_id`) REFERENCES `semester`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_area_id`) REFERENCES `area`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `grade_definition` (
	`id` text PRIMARY KEY NOT NULL,
	`semester_id` text NOT NULL,
	`name` text NOT NULL,
	`weight` real NOT NULL,
	`director_weight` real,
	`max_score` real DEFAULT 5,
	`is_director_only` integer DEFAULT false,
	FOREIGN KEY (`semester_id`) REFERENCES `semester`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `grade` (
	`id` text PRIMARY KEY NOT NULL,
	`definition_id` text NOT NULL,
	`user_id` text NOT NULL,
	`assigned_by_id` text,
	`score` real NOT NULL,
	`feedback` text,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`definition_id`) REFERENCES `grade_definition`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assigned_by_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `kpi_monthly_summary` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`semester_id` text NOT NULL,
	`month` integer NOT NULL,
	`year` integer NOT NULL,
	`final_kpi_score` real DEFAULT 0,
	`attendance_score` real DEFAULT 0,
	`applied_role` text,
	`last_updated` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`semester_id`) REFERENCES `semester`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `position_history` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`area_id` text,
	`role` text,
	`semester_id` text,
	`reason` text,
	`start_date` integer DEFAULT (unixepoch()),
	`end_date` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`area_id`) REFERENCES `area`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`semester_id`) REFERENCES `semester`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `semester_area` (
	`id` text PRIMARY KEY NOT NULL,
	`semester_id` text NOT NULL,
	`area_id` text NOT NULL,
	`is_active` integer DEFAULT true,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`semester_id`) REFERENCES `semester`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`area_id`) REFERENCES `area`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `semester` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`is_active` integer DEFAULT false,
	`start_date` integer,
	`end_date` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `semester_name_unique` ON `semester` (`name`);--> statement-breakpoint
CREATE TABLE `session` (
	`sessionToken` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`first_name` text,
	`last_name` text,
	`email` text NOT NULL,
	`emailVerified` integer,
	`image` text,
	`cui` text,
	`phone` text,
	`area_id` text,
	`role` text DEFAULT 'VOLUNTEER',
	`category` text DEFAULT 'TRAINEE',
	`joined_at` integer DEFAULT (unixepoch()),
	`status` text DEFAULT 'ACTIVE',
	`moderation_reason` text,
	`suspended_until` integer,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`area_id`) REFERENCES `area`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verificationToken` (
	`identifier` text NOT NULL,
	`token` text NOT NULL,
	`expires` integer NOT NULL,
	PRIMARY KEY(`identifier`, `token`)
);
