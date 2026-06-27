import { Router } from "express";
import { HasUndauntedMetagameAuth } from "../middleware/HasUndauntedMetagameAuth";
import { logger } from "../logger";
import { GetBreadcrumbsForCharacterIdAndUserId, SetBreadcrumbsForCharacterIdAndUserId } from "../controllers/progression";

// TODO: We will be gaining progression support very soon, but for now just a stub

export const progressionRouter = Router();

progressionRouter.get("/progression/objectives/:userId", HasUndauntedMetagameAuth, (req: any, res) => {
    const RequestorAccountId = req.AuthData.userId;

    logger.info(`Objective progression fetched for userId ${RequestorAccountId}`);
    
    res.status(200);
    res.json({
        code: null,
        message: "OK",
        payload: []
    })
});

progressionRouter.get("/breadcrumbs/:characterId", HasUndauntedMetagameAuth, async (req: any, res) => {
    const RequestedCharacterId = req.params.characterId;
    const RequestorUserId = req.AuthData.userId;

    logger.info(`Requested breadcrumbs for characterId ${RequestedCharacterId}`);

    const Payload = await GetBreadcrumbsForCharacterIdAndUserId(RequestedCharacterId, RequestorUserId);

    res.status(200);
    res.json({
        code: null,
        message: "OK",
        payload: Payload
    });
});

progressionRouter.post("/breadcrumbs/:characterId", HasUndauntedMetagameAuth, async (req: any, res) => {
    const RequestedCharacterId = req.params.characterId;
    const RequestorUserId = req.AuthData.userId;
    const BreadcrumbsFromUser = req.body.breadcrumbs;
    const UpdateVersion = req.body.updateVersion;

    logger.info(`Setting breadcrumbs for characterId ${RequestedCharacterId}`);

    const Payload = await SetBreadcrumbsForCharacterIdAndUserId(RequestorUserId, RequestedCharacterId, BreadcrumbsFromUser, UpdateVersion);

    res.status(200);
    res.json({
        code: null,
        message: "OK",
        payload: Payload
    });
});

progressionRouter.get("/progression/:userId", HasUndauntedMetagameAuth, (req: any, res) => {
    const RequestorAccountId = req.AuthData.userId;

    logger.info(`Progression fetched for userId ${RequestorAccountId}`);
    
    res.status(200);
    res.json({
        code: null,
        message: "OK",
        payload: [
            {
                "trackId": "ExperienceTrack_Player",
                "rank": 1,
                "confirmedRank": 1,
                "premiumRank": 0,
                "confirmedPremiumRank": 0,
                "rankPoints": 0,
                "totalPoints": 0,
                "unclaimedRewards": [],
                "bHasPremium": false
            },
            {
                "trackId": "ExperienceTrack_Weapon_Sword",
                "rank": 1,
                "confirmedRank": 1,
                "premiumRank": 0,
                "confirmedPremiumRank": 0,
                "rankPoints": 0,
                "totalPoints": 0,
                "unclaimedRewards": [],
                "bHasPremium": false
            }
        ]
    })
});