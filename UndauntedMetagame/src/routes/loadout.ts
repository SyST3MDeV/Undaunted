import { Router } from "express";
import { HasUndauntedMetagameAuth } from "../middleware/HasUndauntedMetagameAuth";
import { GetAllLoadoutsForUserIdAndCharacterId, GetPersistentLoadoutForUserIdAndCharacterId, SetLoadoutDataForUserIdAndCharacterId } from "../controllers/loadout";
import { logger } from "../logger";

export const loadoutRouter = Router();

loadoutRouter.get("/loadout/:userId/:characterId/all", HasUndauntedMetagameAuth, async (req: any, res) => {
    const RequestorAccountId = req.AuthData.IsGameserver ? req.params.userId : req.AuthData.userId;
    const CharacterId = req.params.characterId;

    const Loadouts: any[] = await GetAllLoadoutsForUserIdAndCharacterId(RequestorAccountId, CharacterId);
    const Persistent: any = await GetPersistentLoadoutForUserIdAndCharacterId(RequestorAccountId, CharacterId); // TODO: WARN: Ordering of this and the GetAllLoadoutsForUserIdAndCharacterId MUST NOT CHANGE until create-on-nonexistent is added in the loadout controller

    logger.info(`Fetched ${Loadouts.length} loadout(s) for userId ${RequestorAccountId} and characterId ${CharacterId}`);

    res.status(200);
    res.json({
        code: null,
        message: "OK",
        payload: {
            loadouts: Loadouts,
            persistent: Persistent,
            num_account_slots: 1, // TODO: Make these loadout slots add-able, support multiple loadouts
            max_account_slots: 1,
            num_character_slots: 1,
            max_character_slots: 1,
            active_index: 0, // TODO: Make this support multi-loadouts
            needs_migration: false
        }
    });
});

loadoutRouter.post("/loadout/:userId/:characterId/:index", HasUndauntedMetagameAuth, async (req: any, res) => {
    const RequestorAccountId = req.AuthData.IsGameserver ? req.params.userId : req.AuthData.userId;
    const CharacterId = req.params.characterId;
    const Data = req.body.data;
    const Index = req.params.index;

    const Success = await SetLoadoutDataForUserIdAndCharacterId(RequestorAccountId, CharacterId, Index, Data);

    if(Success){
        logger.info(`Successfully updated loadout index ${Index} for userId ${RequestorAccountId} and characterId ${CharacterId}`);
        // TODO: RE success shape, below is a complete guess

        const Loadouts: any[] = await GetAllLoadoutsForUserIdAndCharacterId(RequestorAccountId, CharacterId);
        const Persistent: any = await GetPersistentLoadoutForUserIdAndCharacterId(RequestorAccountId, CharacterId); // TODO: WARN: Ordering of this and the GetAllLoadoutsForUserIdAndCharacterId MUST NOT CHANGE until create-on-nonexistent is added in the loadout controller

        logger.info(`Fetched ${Loadouts.length} loadout(s) for userId ${RequestorAccountId} and characterId ${CharacterId}`);

        res.status(200);
        res.json({
            code: null,
            message: "OK",
            payload: {
                loadouts: Loadouts,
                persistent: Persistent,
                num_account_slots: 1, // TODO: Make these loadout slots add-able, support multiple loadouts
                max_account_slots: 1,
                num_character_slots: 1,
                max_character_slots: 1,
                active_index: 0, // TODO: Make this support multi-loadouts
                needs_migration: false
            }
        });
    }
    else{
        logger.error(`Failed to update loadout index ${Index} for userId ${RequestorAccountId} and characterId ${CharacterId}`);

        res.status(400);
        res.send();
    }
});