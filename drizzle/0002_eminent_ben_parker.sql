CREATE TABLE `automation_exceptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_id` integer NOT NULL,
	`company_id` integer,
	`stage` text NOT NULL,
	`severity` text NOT NULL,
	`message` text NOT NULL,
	`retryable` integer DEFAULT true NOT NULL,
	`resolved` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `automation_locks` (
	`lock_key` text PRIMARY KEY NOT NULL,
	`acquired_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `automation_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`trigger` text NOT NULL,
	`status` text NOT NULL,
	`stage` text NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`discovery_run_id` integer,
	`promoted_count` integer DEFAULT 0 NOT NULL,
	`financial_count` integer DEFAULT 0 NOT NULL,
	`evidence_count` integer DEFAULT 0 NOT NULL,
	`snapshot_count` integer DEFAULT 0 NOT NULL,
	`decision_count` integer DEFAULT 0 NOT NULL,
	`exception_count` integer DEFAULT 0 NOT NULL,
	`model_version` text NOT NULL,
	`summary_json` text DEFAULT '{}' NOT NULL,
	`error` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `financial_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_id` integer NOT NULL,
	`company_id` integer NOT NULL,
	`period` text NOT NULL,
	`source` text NOT NULL,
	`revenue` real NOT NULL,
	`revenue_growth` real NOT NULL,
	`net_profit` real NOT NULL,
	`net_profit_growth` real NOT NULL,
	`assets` real NOT NULL,
	`liabilities` real NOT NULL,
	`inventory` real NOT NULL,
	`cfo` real NOT NULL,
	`raw_hash` text NOT NULL,
	`data_complete` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE `discovery_candidates` ADD `industry_fit_score` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `discovery_candidates` ADD `liquidity_score` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `discovery_candidates` ADD `scale_score` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `discovery_candidates` ADD `breadth_score` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `snapshots` ADD `model_version` text DEFAULT 'MANUAL' NOT NULL;--> statement-breakpoint
ALTER TABLE `snapshots` ADD `model_status` text DEFAULT 'MANUAL' NOT NULL;--> statement-breakpoint
ALTER TABLE `snapshots` ADD `automation_run_id` integer;