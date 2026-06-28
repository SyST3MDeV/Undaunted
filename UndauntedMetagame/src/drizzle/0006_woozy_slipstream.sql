CREATE TABLE `userapikeys` (
	`userId` text PRIMARY KEY NOT NULL,
	`keyHash` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `userapikeystoregister` (
	`userId` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL
);
