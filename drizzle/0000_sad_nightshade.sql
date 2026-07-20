CREATE TABLE `companies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ticker` text NOT NULL,
	`name` text NOT NULL,
	`sector` text NOT NULL,
	`category` text DEFAULT '个股' NOT NULL,
	`thesis` text DEFAULT '' NOT NULL,
	`status` text DEFAULT '观察' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `companies_ticker_unique` ON `companies` (`ticker`);--> statement-breakpoint
CREATE TABLE `decisions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`snapshot_id` integer NOT NULL,
	`verdict` text NOT NULL,
	`score` real NOT NULL,
	`reasons_json` text NOT NULL,
	`risk_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `evidence` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`title` text NOT NULL,
	`source_url` text DEFAULT '' NOT NULL,
	`source_grade` text DEFAULT 'B' NOT NULL,
	`published_at` text NOT NULL,
	`evidence_type` text DEFAULT '事实' NOT NULL,
	`stance` text DEFAULT '中性' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`title` text NOT NULL,
	`outcome` text NOT NULL,
	`excess_return` real DEFAULT 0 NOT NULL,
	`lessons` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`period` text NOT NULL,
	`revenue_growth` real NOT NULL,
	`margin_trend` real NOT NULL,
	`cfo_quality` real NOT NULL,
	`inventory_gap` real NOT NULL,
	`debt_ratio` real NOT NULL,
	`industry_score` real NOT NULL,
	`moat_score` real NOT NULL,
	`catalyst_score` real NOT NULL,
	`positive_probability` real NOT NULL,
	`expected_excess` real NOT NULL,
	`permanent_loss_probability` real NOT NULL,
	`valuation_percentile` real NOT NULL,
	`drawdown` real NOT NULL,
	`volatility` real NOT NULL,
	`tradable` integer DEFAULT true NOT NULL,
	`data_complete` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
