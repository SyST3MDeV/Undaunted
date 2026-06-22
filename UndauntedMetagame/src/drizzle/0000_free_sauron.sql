CREATE TABLE `characters` (
	`characterId` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`createdDate` text NOT NULL,
	`lastModifiedDate` text NOT NULL,
	`name` text NOT NULL,
	`updateVersion` integer NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`userId` text PRIMARY KEY NOT NULL,
	`name` text
);
