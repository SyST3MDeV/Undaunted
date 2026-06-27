CREATE TABLE `breadcrumbs` (
	`characterId` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`breadcrumbs` text NOT NULL,
	`updateVersion` integer NOT NULL
);
