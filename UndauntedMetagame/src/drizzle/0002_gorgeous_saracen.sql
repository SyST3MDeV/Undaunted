CREATE TABLE `gameserverapikeys` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`keyHash` text
);
--> statement-breakpoint
CREATE TABLE `gameserverapikeystoregister` (
	`key` text PRIMARY KEY NOT NULL
);
