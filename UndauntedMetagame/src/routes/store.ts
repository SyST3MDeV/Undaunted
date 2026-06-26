import { Router } from "express";
import { logger } from "../logger";
import { HasUndauntedMetagameAuth } from "../middleware/HasUndauntedMetagameAuth";
import { GetNotesForUser } from "../controllers/store";

export const storeRouter = Router();

storeRouter.post("/reconcile", HasUndauntedMetagameAuth, async (req: any, res) => {
    const Notes = await GetNotesForUser(req.AuthData.userId);

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
        id_currency_s20_coin: 0,
        CURRENCY_GAUNTLET_COIN_FADED: 0,
        CURRENCY_S20_COIN: 0,
        CURRENCY_S18_COIN: 0,
        id_currency_seasonal_coin: 0,
        id_currency_s18_coin: 0,
        id_currency_weapon_token: 25,
        id_currency_celldust: 0,
        id_currency_event_ramsgiving: 0,
        CURRENCY_NOTES: NotesBalance,
        id_currency_event_frostfall: 0,
        CURRENCY_EVENT_DARKHARVEST: 0,
        CURRENCY_S19_COIN: 0,
        id_currency_s16_coin: 0,
        CURRENCY_S16_COIN: 0,
        id_currency_gauntlet_coin: 0,
        id_currency_s13_coin: 0,
        CURRENCY_MARKS_STEEL: 0,
        CURRENCY_S13_COIN: 0,
        CURRENCY_EVENT_FROSTFALL: 0,
        CURRENCY_GAUNTLET_COIN: 0,
        id_currency_marks_steel: 0,
        id_currency_rewardcache: 0,
        CURRENCY_PRESTIGE: 0,
        CURRENCY_SEASONAL_COIN: 0,
        CURRENCY_REWARDCACHE: 0,
        id_currency_token_exchange_speed_up: 0,
        id_currency_event_springtide: 0,
        CURRENCY_TOKEN_EXCHANGE_SPEED_UP: 0,
        id_currency_gauntlet_coin_faded: 0,
        CURRENCY_S15_COIN: 0,
        CURRENCY_PLATINUM: 0,
        id_currency_platinum: 0,
        id_currency_s15_coin: 0,
        id_currency_marks_gilded: 0,
        id_currency_event_darkharvest: 0,
        id_currency_event_saintsbond: 0,
        CURRENCY_EVENT_SPRINGTIDE: 0,
        id_currency_s19_coin: 0,
        id_currency_notes: NotesBalance,
        id_currency_prestige: 0,
        id_currency_s13_daily: 0,
        CURRENCY_WEAPON_TOKEN: 25,
        CURRENCY_MARKS_GILDED: 0,
        CURRENCY_S13_DAILY: 0,
        CURRENCY_CELLDUST: 0,
        CURRENCY_S14_COIN: 0,
        CURRENCY_EVENT_SAINTSBOND: 0,
        CURRENCY_S17_COIN: 0,
        id_currency_s14_coin: 0,
        CURRENCY_EVENT_RAMSGIVING: 0,
        id_currency_s17_coin: 0
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