import { Router } from "express";
import { logger } from "../logger";
import { HasUndauntedMetagameAuth } from "../middleware/HasUndauntedMetagameAuth";

export const systemRouter = Router();

systemRouter.get("/dauntless-status", (req, res) => {
    logger.info("Status");

    res.json({
	    "show-status": true,
	    "en": "Welcome to Undaunted v0.0.1!",
	    "fr": "Welcome to Undaunted v0.0.1!",
	    "it": "Welcome to Undaunted v0.0.1!",
	    "es": "Welcome to Undaunted v0.0.1!",
	    "de": "Welcome to Undaunted v0.0.1!",
	    "pt": "Welcome to Undaunted v0.0.1!",
	    "ru": "Welcome to Undaunted v0.0.1!",
	    "ja": "Welcome to Undaunted v0.0.1!"
    });
});

systemRouter.post("/heartbeat", (req, res) => {
    // TODO: Maybe playercount here?
    res.status(200);
    res.json({});
});

systemRouter.post("/event", (req, res) => {
    res.status(200);
    res.json({});
});

systemRouter.post("/account/migrate", HasUndauntedMetagameAuth, (req, res) => {
	logger.info("Account migration (stubbed)");

	res.status(200);
	res.json({
		migration_failed: false,
		migration_finished: true
	});
});

systemRouter.post("/profile/update", HasUndauntedMetagameAuth, (req, res) => {
	logger.info("Leaderboard update profile (stubbed)");

	res.status(200);
	res.send();
});

systemRouter.get("/vivox/login", HasUndauntedMetagameAuth, (req, res) => {
	logger.info("Vivox login (stubbed)");

	res.status(404);
	res.send();
});

systemRouter.post("/motd/", HasUndauntedMetagameAuth, (req, res) => {
	logger.info("MOTD (stubbed)");

	res.status(204);
	res.send();
});