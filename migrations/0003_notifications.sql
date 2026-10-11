-- In-app notifications for community interactions (like/favorite/comment/reply/follow).

CREATE TABLE IF NOT EXISTS `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`type` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`spot_id` text,
	`is_read` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS `notifications_user_idx` ON `notifications` (`user_id`, `is_read`);
CREATE INDEX IF NOT EXISTS `notifications_created_idx` ON `notifications` (`created_at`);