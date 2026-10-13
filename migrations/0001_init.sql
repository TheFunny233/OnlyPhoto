-- OnlyPhoto schema (identical to the Node/Drizzle version's 14 tables).
-- Idempotent so it can run against an existing database created by the Node version.

CREATE TABLE IF NOT EXISTS `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`nickname` text NOT NULL,
	`is_demo` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS `users_email_unique` ON `users` (`email`);
CREATE INDEX IF NOT EXISTS `users_email_idx` ON `users` (`email`);

CREATE TABLE IF NOT EXISTS `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS `sessions_user_idx` ON `sessions` (`user_id`);

CREATE TABLE IF NOT EXISTS `photos` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`storage_key` text NOT NULL,
	`original_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`bytes` integer NOT NULL,
	`content_hash` text NOT NULL,
	`privacy` text DEFAULT 'private' NOT NULL,
	`is_demo` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS `photos_owner_idx` ON `photos` (`owner_id`);
CREATE INDEX IF NOT EXISTS `photos_hash_idx` ON `photos` (`owner_id`,`content_hash`);

CREATE TABLE IF NOT EXISTS `analysis_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`photo_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`error` text,
	`error_type` text,
	`idempotency_key` text NOT NULL,
	`mode` text NOT NULL,
	`provider` text DEFAULT '' NOT NULL,
	`model` text,
	`prompt_version` text NOT NULL,
	`scene` text DEFAULT '' NOT NULL,
	`goals` text DEFAULT '[]' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`started_at` integer,
	`finished_at` integer,
	FOREIGN KEY (`photo_id`) REFERENCES `photos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE UNIQUE INDEX IF NOT EXISTS `analysis_idem_idx` ON `analysis_jobs` (`idempotency_key`);
CREATE INDEX IF NOT EXISTS `analysis_photo_idx` ON `analysis_jobs` (`photo_id`);
CREATE INDEX IF NOT EXISTS `analysis_status_idx` ON `analysis_jobs` (`status`);

CREATE TABLE IF NOT EXISTS `analysis_results` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`photo_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`data` text NOT NULL,
	`receipt` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `analysis_jobs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`photo_id`) REFERENCES `photos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE UNIQUE INDEX IF NOT EXISTS `analysis_result_job_idx` ON `analysis_results` (`job_id`);

CREATE TABLE IF NOT EXISTS `edit_recipes` (
	`id` text PRIMARY KEY NOT NULL,
	`photo_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`recipe` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`photo_id`) REFERENCES `photos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE UNIQUE INDEX IF NOT EXISTS `recipe_photo_idx` ON `edit_recipes` (`photo_id`);

CREATE TABLE IF NOT EXISTS `spots` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`title` text NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`area` text DEFAULT '' NOT NULL,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`coord_system` text DEFAULT 'WGS84' NOT NULL,
	`precision` text DEFAULT 'approximate' NOT NULL,
	`subjects` text DEFAULT '[]' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`how_to_stand` text DEFAULT '' NOT NULL,
	`direction` text DEFAULT '' NOT NULL,
	`best_light` text DEFAULT '' NOT NULL,
	`light_source` text DEFAULT 'unconfirmed' NOT NULL,
	`gear` text DEFAULT '' NOT NULL,
	`safety` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'published' NOT NULL,
	`is_demo` integer DEFAULT false NOT NULL,
	`verified_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS `spots_city_idx` ON `spots` (`city`);
CREATE INDEX IF NOT EXISTS `spots_status_idx` ON `spots` (`status`);

CREATE TABLE IF NOT EXISTS `spot_media` (
	`id` text PRIMARY KEY NOT NULL,
	`spot_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`photo_id` text,
	`storage_key` text NOT NULL,
	`width` integer DEFAULT 0 NOT NULL,
	`height` integer DEFAULT 0 NOT NULL,
	`bytes` integer DEFAULT 0 NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL,
	`is_demo` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`spot_id`) REFERENCES `spots`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`photo_id`) REFERENCES `photos`(`id`) ON UPDATE no action ON DELETE set null
);
CREATE INDEX IF NOT EXISTS `spot_media_spot_idx` ON `spot_media` (`spot_id`);

CREATE TABLE IF NOT EXISTS `likes` (
	`user_id` text NOT NULL,
	`spot_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `spot_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`spot_id`) REFERENCES `spots`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS `favorites` (
	`user_id` text NOT NULL,
	`spot_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `spot_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`spot_id`) REFERENCES `spots`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`spot_id` text NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'visible' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`spot_id`) REFERENCES `spots`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS `comments_spot_idx` ON `comments` (`spot_id`);

CREATE TABLE IF NOT EXISTS `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`reporter_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`reporter_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS `reports_target_idx` ON `reports` (`target_type`,`target_id`);

CREATE TABLE IF NOT EXISTS `api_usage` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`photo_id` text,
	`mode` text NOT NULL,
	`provider` text DEFAULT '' NOT NULL,
	`model` text,
	`status` text NOT NULL,
	`error_type` text,
	`input_tokens` integer,
	`output_tokens` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
CREATE INDEX IF NOT EXISTS `api_usage_mode_idx` ON `api_usage` (`mode`);
CREATE INDEX IF NOT EXISTS `api_usage_user_idx` ON `api_usage` (`user_id`);

CREATE TABLE IF NOT EXISTS `live_budget` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`used` integer DEFAULT 0 NOT NULL,
	`limit` integer DEFAULT 12 NOT NULL,
	`updated_at` integer NOT NULL
);