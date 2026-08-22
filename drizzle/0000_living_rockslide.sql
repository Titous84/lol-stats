CREATE TABLE `asset_versions` (
	`ddragon_version` text PRIMARY KEY NOT NULL,
	`fetched_at` text NOT NULL,
	`is_current` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ingest_cursors` (
	`puuid` text NOT NULL,
	`queue_id` integer NOT NULL,
	`last_match_end_ms` integer,
	`last_match_id` text,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`puuid`, `queue_id`)
);
--> statement-breakpoint
CREATE TABLE `ingest_failures` (
	`match_id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`attempt_count` integer DEFAULT 1 NOT NULL,
	`last_attempt_at` text NOT NULL,
	`detail` text
);
--> statement-breakpoint
CREATE TABLE `ingest_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`status` text NOT NULL,
	`matches_discovered_count` integer DEFAULT 0 NOT NULL,
	`matches_written_count` integer DEFAULT 0 NOT NULL,
	`api_call_count` integer DEFAULT 0 NOT NULL,
	`rate_limit_wait_ms` integer DEFAULT 0 NOT NULL,
	`error_kind` text,
	`error_message` text
);
--> statement-breakpoint
CREATE TABLE `match_participants` (
	`match_id` text NOT NULL,
	`puuid` text NOT NULL,
	`participant_id` integer NOT NULL,
	`team_id` integer NOT NULL,
	`champion_id` integer NOT NULL,
	`champion_name` text NOT NULL,
	`champ_level` integer NOT NULL,
	`riot_id_game_name` text NOT NULL,
	`riot_id_tag_line` text NOT NULL,
	`team_position` text,
	`individual_position` text,
	`lane` text,
	`role` text,
	`win` integer NOT NULL,
	`kills` integer NOT NULL,
	`deaths` integer NOT NULL,
	`assists` integer NOT NULL,
	`total_damage_dealt_to_champions` integer NOT NULL,
	`physical_damage_to_champions` integer NOT NULL,
	`magic_damage_to_champions` integer NOT NULL,
	`true_damage_to_champions` integer NOT NULL,
	`total_damage_taken` integer NOT NULL,
	`damage_self_mitigated` integer NOT NULL,
	`damage_dealt_to_objectives` integer NOT NULL,
	`damage_dealt_to_turrets` integer NOT NULL,
	`total_minions_killed` integer NOT NULL,
	`neutral_minions_killed` integer NOT NULL,
	`gold_earned` integer NOT NULL,
	`gold_spent` integer NOT NULL,
	`vision_score` integer NOT NULL,
	`wards_placed_count` integer NOT NULL,
	`wards_killed_count` integer NOT NULL,
	`detector_wards_placed_count` integer NOT NULL,
	`vision_wards_bought_count` integer NOT NULL,
	`time_ccing_others_s` integer NOT NULL,
	`total_time_spent_dead_s` integer NOT NULL,
	`longest_time_living_s` integer NOT NULL,
	`turret_kills` integer NOT NULL,
	`inhibitor_kills` integer NOT NULL,
	`dragon_kills` integer NOT NULL,
	`baron_kills` integer NOT NULL,
	`largest_killing_spree` integer NOT NULL,
	`largest_multi_kill` integer NOT NULL,
	`double_kills` integer NOT NULL,
	`triple_kills` integer NOT NULL,
	`quadra_kills` integer NOT NULL,
	`penta_kills` integer NOT NULL,
	`first_blood_kill` integer NOT NULL,
	`first_blood_assist` integer NOT NULL,
	`first_tower_kill` integer NOT NULL,
	`item_0` integer NOT NULL,
	`item_1` integer NOT NULL,
	`item_2` integer NOT NULL,
	`item_3` integer NOT NULL,
	`item_4` integer NOT NULL,
	`item_5` integer NOT NULL,
	`item_6` integer NOT NULL,
	`summoner_1_id` integer NOT NULL,
	`summoner_2_id` integer NOT NULL,
	`perk_primary_style` integer,
	`perk_sub_style` integer,
	`perk_keystone` integer,
	`perks_json` text,
	`challenges_json` text,
	`solo_kills` integer,
	`lane_minions_first_10` integer,
	`control_wards_placed` integer,
	`team_total_kills` integer NOT NULL,
	`team_total_damage_to_champions` integer NOT NULL,
	`team_total_gold_earned` integer NOT NULL,
	PRIMARY KEY(`match_id`, `puuid`),
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`match_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`puuid`) REFERENCES `players`(`puuid`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_mp_puuid_match` ON `match_participants` (`puuid`,`match_id`);--> statement-breakpoint
CREATE INDEX `idx_mp_puuid_champ` ON `match_participants` (`puuid`,`champion_id`);--> statement-breakpoint
CREATE INDEX `idx_mp_puuid_pos` ON `match_participants` (`puuid`,`team_position`);--> statement-breakpoint
CREATE INDEX `idx_mp_match_pos` ON `match_participants` (`match_id`,`team_position`);--> statement-breakpoint
CREATE INDEX `idx_mp_match_team` ON `match_participants` (`match_id`,`team_id`);--> statement-breakpoint
CREATE TABLE `match_raw` (
	`match_id` text PRIMARY KEY NOT NULL,
	`payload_gz` blob NOT NULL,
	`payload_schema` text NOT NULL,
	`fetched_at` text NOT NULL,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`match_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `match_teams` (
	`match_id` text NOT NULL,
	`team_id` integer NOT NULL,
	`win` integer NOT NULL,
	`baron_kills` integer NOT NULL,
	`dragon_kills` integer NOT NULL,
	`herald_kills` integer NOT NULL,
	`tower_kills` integer NOT NULL,
	`inhibitor_kills` integer NOT NULL,
	`first_blood` integer NOT NULL,
	`first_tower` integer NOT NULL,
	`first_dragon` integer NOT NULL,
	`first_baron` integer NOT NULL,
	`bans_json` text,
	PRIMARY KEY(`match_id`, `team_id`),
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`match_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `match_timelines` (
	`match_id` text PRIMARY KEY NOT NULL,
	`payload_gz` blob,
	`fetched_at` text,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`match_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `matches` (
	`match_id` text PRIMARY KEY NOT NULL,
	`platform_id` text NOT NULL,
	`queue_id` integer NOT NULL,
	`game_version` text NOT NULL,
	`patch` text NOT NULL,
	`season_id` text NOT NULL,
	`game_creation_ms` integer NOT NULL,
	`game_start_ms` integer NOT NULL,
	`game_end_ms` integer,
	`game_duration_s` integer NOT NULL,
	`map_id` integer NOT NULL,
	`game_mode` text NOT NULL,
	`game_type` text NOT NULL,
	`ended_in_early_surrender` integer DEFAULT 0 NOT NULL,
	`ended_in_surrender` integer DEFAULT 0 NOT NULL,
	`is_remake` integer DEFAULT 0 NOT NULL,
	`timeline_fetched_at` text,
	`ingested_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_matches_queue_start` ON `matches` (`queue_id`,"game_start_ms" desc);--> statement-breakpoint
CREATE INDEX `idx_matches_patch` ON `matches` (`patch`);--> statement-breakpoint
CREATE INDEX `idx_matches_season` ON `matches` (`season_id`);--> statement-breakpoint
CREATE INDEX `idx_matches_timeline_todo` ON `matches` (`queue_id`,`timeline_fetched_at`) WHERE "matches"."timeline_fetched_at" IS NULL;--> statement-breakpoint
CREATE TABLE `player_lookups` (
	`game_name_lower` text NOT NULL,
	`tag_line_lower` text NOT NULL,
	`puuid` text NOT NULL,
	`resolved_at` text NOT NULL,
	PRIMARY KEY(`game_name_lower`, `tag_line_lower`)
);
--> statement-breakpoint
CREATE TABLE `players` (
	`puuid` text PRIMARY KEY NOT NULL,
	`game_name` text NOT NULL,
	`tag_line` text NOT NULL,
	`platform_id` text NOT NULL,
	`is_self` integer DEFAULT 0 NOT NULL,
	`is_tracked` integer DEFAULT 0 NOT NULL,
	`first_seen_ms` integer NOT NULL,
	`last_seen_ms` integer NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rank_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`puuid` text NOT NULL,
	`queue_type` text NOT NULL,
	`tier` text NOT NULL,
	`rank` text NOT NULL,
	`league_points` integer NOT NULL,
	`wins` integer NOT NULL,
	`losses` integer NOT NULL,
	`hot_streak` integer NOT NULL,
	`captured_at` text NOT NULL,
	`captured_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_rank_puuid_time` ON `rank_snapshots` (`puuid`,`queue_type`,`captured_ms`);