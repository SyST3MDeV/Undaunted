import { Router } from "express";
import { HasUndauntedMetagameAuth } from "../middleware/HasUndauntedMetagameAuth";
import { logger } from "../logger";
import { AddEncounteredContent, GetBreadcrumbsForCharacterIdAndUserId, QueryEncounteredContent, SetBreadcrumbsForCharacterIdAndUserId } from "../controllers/progression";

// TODO: We will be gaining progression support very soon, but for now just a stub

export const progressionRouter = Router();

progressionRouter.get("/encountered-content/:characterId/:contentType", HasUndauntedMetagameAuth, async (req: any, res) => {
    const RequestorAccountId = req.AuthData.userId;
    const CharacterId = req.params.characterId;
    const ContentType = req.params.contentType as number;

    logger.info(`Querying encountered content for userId ${RequestorAccountId} and characterId ${CharacterId}`);

    const Content = await QueryEncounteredContent(RequestorAccountId, CharacterId, [ContentType]);

    res.status(200);
    res.send({
        code: null,
        message: "OK",
        payload: {
            content_types: Content,
            success: true
        }
    });
});

progressionRouter.post("/encountered-content/query/:characterId", HasUndauntedMetagameAuth, async (req: any, res) => {
    const RequestorAccountId = req.AuthData.userId;
    const CharacterId = req.params.characterId;
    const ContentTypes = req.body.content_types;

    logger.info(`Querying encountered content for userId ${RequestorAccountId} and characterId ${CharacterId}`);

    const Content = await QueryEncounteredContent(RequestorAccountId, CharacterId, ContentTypes);

    res.status(200);
    res.send({
        code: null,
        message: "OK",
        payload: {
            content_types: Content,
            success: true
        }
    });
});

progressionRouter.post("/encountered-content/:characterId", HasUndauntedMetagameAuth, async (req: any, res) => {
    const RequestorAccountId = req.AuthData.userId;
    const CharacterId = req.params.characterId;
    const ContentType = req.body.content_type;
    const ContentId = req.body.content_id;

    logger.info(`Adding encountered content ${ContentId} for userId ${RequestorAccountId} and characterId ${CharacterId}`);

    await AddEncounteredContent(RequestorAccountId, CharacterId, ContentType, ContentId);

    res.status(200);
    res.send({
        code: null,
        message: "OK",
        payload: {}
    });
});

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