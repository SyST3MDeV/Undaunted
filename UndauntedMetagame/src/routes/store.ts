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

storeRouter.get("/creator", HasUndauntedMetagameAuth, async (req: any, res) => {
    logger.info("SupportACreator (stubbed)");

    res.status(200);
    res.json({
        "expirationDate": "2099-01-01T01:00:00.041Z",
        "slug": "MROWMROW",
        "success": true
    });
})

storeRouter.get("/balance", HasUndauntedMetagameAuth, async (req: any, res) => {
    const UserId = req.AuthData.userId;

    const NotesBalance = await GetNotesForUser(UserId);

    logger.info(`Fetched notes balance of ${NotesBalance} for userId ${UserId}`);

    res.status(200);
    res.json({
        CURRENCY_NOTES: NotesBalance,
        id_currency_notes: NotesBalance
    });
});

storeRouter.get("/product/skus/public", HasUndauntedMetagameAuth, async (req: any, res) => {
    logger.info("Store SKUs (stubbed)");

    // TODO: No clue if this is microtransactions or game transactions yet
    // If game transactions, I'll support it as it was on live
    // If microtransactions, I'll prob rewire to make everything earnable (no real money here!)

    res.status(400);
    res.json({
        code: "400",
        message: "Undaunted does not support the store (yet)"
    });
});