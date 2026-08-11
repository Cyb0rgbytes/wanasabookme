CREATE TABLE `event_attendees` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`user_id` text NOT NULL,
	`join_price_fils` integer NOT NULL,
	`status` text DEFAULT 'joined' NOT NULL,
	`joined_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_event_attendee` ON `event_attendees` (`event_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `idx_attendees_event` ON `event_attendees` (`event_id`);--> statement-breakpoint
CREATE INDEX `idx_attendees_user` ON `event_attendees` (`user_id`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`organizer_id` text NOT NULL,
	`title_en` text NOT NULL,
	`title_ar` text,
	`description_en` text,
	`description_ar` text,
	`starts_at` integer NOT NULL,
	`ends_at` integer,
	`timezone` text DEFAULT 'Asia/Dubai' NOT NULL,
	`venue_name` text,
	`city` text,
	`latitude` integer,
	`longitude` integer,
	`total_cost_fils` integer DEFAULT 0 NOT NULL,
	`capacity` integer NOT NULL,
	`min_headcount` integer DEFAULT 1 NOT NULL,
	`price_floor_fils` integer DEFAULT 0 NOT NULL,
	`price_ceiling_fils` integer NOT NULL,
	`audience` text DEFAULT 'mixed' NOT NULL,
	`category` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`cover_image_key` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`organizer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `events_slug_unique` ON `events` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_events_slug` ON `events` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_events_organizer` ON `events` (`organizer_id`);--> statement-breakpoint
CREATE INDEX `idx_events_starts_at` ON `events` (`starts_at`);--> statement-breakpoint
CREATE INDEX `idx_events_city` ON `events` (`city`);--> statement-breakpoint
CREATE INDEX `idx_events_category` ON `events` (`category`);--> statement-breakpoint
CREATE INDEX `idx_events_audience` ON `events` (`audience`);--> statement-breakpoint
CREATE INDEX `idx_events_status_starts_at` ON `events` (`status`,`starts_at`);