CREATE TABLE `discovery_candidates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_id` integer NOT NULL,
	`rank` integer NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`primary_chain` text NOT NULL,
	`themes_json` text NOT NULL,
	`price` real NOT NULL,
	`pe` real NOT NULL,
	`pb` real NOT NULL,
	`market_cap` real NOT NULL,
	`turnover_amount` real NOT NULL,
	`change_60d` real NOT NULL,
	`change_ytd` real NOT NULL,
	`theme_score` real NOT NULL,
	`valuation_score` real NOT NULL,
	`momentum_score` real NOT NULL,
	`risk_score` real NOT NULL,
	`total_score` real NOT NULL,
	`pool` text NOT NULL,
	`reasons_json` text NOT NULL,
	`vetoes_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `discovery_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`status` text NOT NULL,
	`as_of` text DEFAULT '' NOT NULL,
	`universe_count` integer DEFAULT 0 NOT NULL,
	`board_count` integer DEFAULT 0 NOT NULL,
	`scanned_count` integer DEFAULT 0 NOT NULL,
	`candidate_count` integer DEFAULT 0 NOT NULL,
	`source_version` text NOT NULL,
	`raw_hash` text DEFAULT '' NOT NULL,
	`error` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `source_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_id` integer NOT NULL,
	`source` text NOT NULL,
	`endpoint` text NOT NULL,
	`retrieved_at` text NOT NULL,
	`status` text NOT NULL,
	`row_count` integer DEFAULT 0 NOT NULL,
	`raw_hash` text DEFAULT '' NOT NULL,
	`error` text DEFAULT '' NOT NULL
);
