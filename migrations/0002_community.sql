-- Community enhancements: comment likes, author follows, deduplicated spot views.
-- All statements are idempotent so this can run on an existing database.

CREATE TABLE IF NOT EXISTS `comment_likes` (
	`user_id` text NOT NULL,
	`comment_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `comment_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`comment_id`) REFERENCES `comments`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS `follows` (
	`follower_id` text NOT NULL,
	`followee_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`follower_id`, `followee_id`),
	FOREIGN KEY (`follower_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`followee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS `follows_followee_idx` ON `follows` (`followee_id`);

CREATE TABLE IF NOT EXISTS `spot_views` (
	`spot_id` text NOT NULL,
	`viewer_key` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`spot_id`, `viewer_key`),
	FOREIGN KEY (`spot_id`) REFERENCES `spots`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS `spot_views_spot_idx` ON `spot_views` (`spot_id`);