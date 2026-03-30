CREATE TABLE `project_invitation` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`user_id` text NOT NULL,
	`project_role_id` text NOT NULL,
	`project_area_id` text,
	`invited_by_id` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`message` text,
	`rejection_reason` text,
	`created_at` integer DEFAULT (unixepoch()),
	`expires_at` integer NOT NULL,
	`responded_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_role_id`) REFERENCES `project_role`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_area_id`) REFERENCES `project_area`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`invited_by_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
