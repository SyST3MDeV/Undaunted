import { Router } from "express";
import { logger } from "../logger";

export const tuningRouter = Router();

tuningRouter.get("/game_tuning/seasonal_event_schedule", (req: any, res) => {
    logger.info("Seasonal Event Schedule (stubbed)");

    res.status(200);
    res.json({
        code: null,
        message: "OK",
        payload: {
            ScheduledItems: []
        }
    });
})

tuningRouter.get("/game_tuning/huntpass_xp_config", (req: any, res) => {
    logger.info("Huntpass XP Config (stubbed)");

    res.status(200);
    res.json({
        code: null,
        message: "OK",
        payload: {
            EventConfigs: [],
            GlobalConfig: {
                DifficultyBias: 1.000000000000000,
                GlobalMultiplier: 1.000000000000000,
                MaxXPAwarded: 200
            }
        }
    });
});