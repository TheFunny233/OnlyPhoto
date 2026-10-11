-- User-defined collections (groups of spots) for personal curation.

CREATE TABLE IF NOT EXISTS `collections` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS `collections_user_idx` ON `collections` (`user_id`);

CREATE TABLE IF NOT EXISTS `collection_items` (
	`collection_id` text NOT NULL,
	`spot_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`collection_id`, `spot_id`),
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`spot_id`) REFERENCES `spots`(`id`) ON UPDATE no action ON DELETE cascade
);