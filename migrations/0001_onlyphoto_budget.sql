-- Carry the historical request budget forward without resetting usage.
INSERT INTO `live_budget` (`id`, `task_id`, `used`, `limit`, `updated_at`)
SELECT 'onlyphoto-dev-run', 'onlyphoto-dev-run', `used`, `limit`, `updated_at`
FROM `live_budget` WHERE `id` = 'photomaster-dev-run'
ON CONFLICT (`id`) DO UPDATE SET
  `used` = `live_budget`.`used` + excluded.`used`,
  `limit` = min(`live_budget`.`limit`, excluded.`limit`),
  `updated_at` = max(`live_budget`.`updated_at`, excluded.`updated_at`);
--> statement-breakpoint
DELETE FROM `live_budget` WHERE `id` = 'photomaster-dev-run';
