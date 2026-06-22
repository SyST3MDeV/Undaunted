import { Router } from "express";
import { logger } from "../logger";
import { HasUndauntedMetagameAuth } from "../middleware/HasUndauntedMetagameAuth";
import { GetNotesForUser } from "../controllers/store";

export const storeRouter = Router();

storeRouter.post("/reconcile", HasUndauntedMetagameAuth, async (req: any, res) => {
    let Notes = GetNotesForUser(req.AuthData.userId);

    logger.info(`Retrieved notes balance of ${Notes} for ${req.AuthData.userId}`);

    res.status(200);
    res.json({
        balances: {
            id_currency_notes: Notes,
            CURRENCY_NOTES: Notes
        },
        refreshInventory: true
    });
});