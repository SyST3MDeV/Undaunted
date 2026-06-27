import { Router } from "express";
import { logger } from "../logger";
import { HasUndauntedMetagameAuth } from "../middleware/HasUndauntedMetagameAuth";
import progressionconfig from "../vendor/progression_config.json";

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

systemRouter.get("/entitlementsv2", HasUndauntedMetagameAuth, (req, res) => {
	logger.info("Entitlements (stubbed)");

	res.status(200);
	res.json({
		entitlements: []
	});
});

systemRouter.get("/entitlement\v2/:userId", HasUndauntedMetagameAuth, (req, res) => {
	logger.info("Entitlements (stubbed)");

	res.status(200);
	res.json({
		entitlements: []
	});
});

systemRouter.get("/playertreatments/:userId", HasUndauntedMetagameAuth, (req, res) => {
	logger.info("Cohorts (stubbed)");

	res.status(200);
	res.json({
		treatments: []
	});
});

systemRouter.get("/escalation/:escalationSeason/:userId", HasUndauntedMetagameAuth, (req, res) => {
	const EscalationSeason = req.params.escalationSeason;

	logger.info(`Escalation Configuration for season ${EscalationSeason} (stubbed)`);

	res.status(200);
	res.json({
		code: null,
		message: "OK",
		payload: {
        	escalation_level: 0,
        	next_level_xp: 0,
        	talents_progress: [],
        	unlock_progress: [],
        	update_version: 0,
      	}
	});
});

systemRouter.get("/eventstats/", HasUndauntedMetagameAuth, (req, res) => {
	logger.info("Event stats (stubbed)");

	res.status(200);
	res.json({
		stats: []
	});
});

systemRouter.get("/progression/config", HasUndauntedMetagameAuth, (req, res) => {
	logger.info("Progression Config (stubbed)");

	res.status(200);
	res.json(progressionconfig);
});

systemRouter.get("/huntpass/:userId", HasUndauntedMetagameAuth, (req: any, res) => {
	logger.info("Huntpass (stubbed)");

	res.status(200);
	res.json({
        code: null,
        message: "OK",
        payload: "season09b"
    });
});

// TODO: Cooldowns might be gameplay-important, impl if so

systemRouter.get("/cooldown/:userId", HasUndauntedMetagameAuth, (req: any, res) => {
	logger.info("Cooldowns (stubbed)");

	res.status(200);
	res.json({
		code: null,
		message: "OK",
		payload: {

		}
	});
});

systemRouter.put("/cooldown/batch/:userId", HasUndauntedMetagameAuth, (req: any, res) => {
	logger.info("Add Cooldowns (stubbed)");

	res.status(200);
	res.json({
		code: null,
		message: "OK",
		payload: {

		}
	});
});

systemRouter.get("/bounty/game-data", HasUndauntedMetagameAuth, (req: any, res) => {
	logger.info("Bounty game data (stubbed)");

	res.status(200);
	res.json({
    code: null,
    message: "OK",
    payload: {
      max_slots: 4,
      num_draft_options: 3,
      num_spicy_options: 1,
      bounty_token_id: "TOKEN_BOUNTY_DRAFT",
      premium_bounty_token_id: "TOKEN_BOUNTY_DRAFT_PREMIUM",
      num_tokens_hp_start: 4,
      num_tokens_per_day: 0,
      bounty_token_grant_hour: 0,
      history_length: 10,
      bronze_count: 9,
      silver_count: 3,
      gold_count: 1,
      new_season_reset_bounties: false,
      bounty_data: [],
      item_grant_data: [],
      token_rollover_warning_days: 1000,
      automatic_draft: false,
      automatic_claim: false,
      delete_claimed_bounties: false,
    },
  });
});

systemRouter.get("/bounty/:userId", HasUndauntedMetagameAuth, (req: any, res) => { // TODO: This masks /bounty/game-data Right now they seem to have compatible schema, but I could be wrong about that.
	logger.info("Bounties (stubbed)");

	res.status(200);
	res.json({
		code: null,
		message: "OK",
		payload: {
			bounties: [],
			draft_data: {
				current_draft_choices: [],
    			previous_draft_selections: [],
    			bronze_count: 0,
    			silver_count: 0,
    			gold_count: 0,
			},
			draft_data_daily: {
				current_draft_choices: [],
    			previous_draft_selections: [],
    			bronze_count: 0,
    			silver_count: 0,
    			gold_count: 0,
			},
			draft_data_weekly: {
				current_draft_choices: [],
    			previous_draft_selections: [],
    			bronze_count: 0,
    			silver_count: 0,
    			gold_count: 0,
			}
		}
	})
});

systemRouter.post("/bounty/:userId", HasUndauntedMetagameAuth, (req: any, res) => { // TODO: This masks /bounty/game-data Right now they seem to have compatible schema, but I could be wrong about that.
	logger.info("Set Bounties (stubbed)");

	res.status(200);
	res.json({
		code: null,
		message: "OK",
		payload: {
			bounties: [],
			draft_data: {
				current_draft_choices: [],
    			previous_draft_selections: [],
    			bronze_count: 0,
    			silver_count: 0,
    			gold_count: 0,
			},
			draft_data_daily: {
				current_draft_choices: [],
    			previous_draft_selections: [],
    			bronze_count: 0,
    			silver_count: 0,
    			gold_count: 0,
			},
			draft_data_weekly: {
				current_draft_choices: [],
    			previous_draft_selections: [],
    			bronze_count: 0,
    			silver_count: 0,
    			gold_count: 0,
			}
		}
	})
});

systemRouter.get("/all/", HasUndauntedMetagameAuth, (req: any, res) => {
	logger.info("Mailbox (stubbed)");

	res.json({
		code: null,
		message: "OK",
		payload: {
			messages: []
		}
	});
});