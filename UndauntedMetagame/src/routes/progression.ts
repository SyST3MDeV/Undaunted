import { Router } from "express";
import { HasUndauntedMetagameAuth } from "../middleware/HasUndauntedMetagameAuth";
import { logger } from "../logger";
import { AddEncounteredContent, GetBreadcrumbsForCharacterIdAndUserId, ProgressionError, QueryEncounteredContent, SetBreadcrumbsForCharacterIdAndUserId } from "../controllers/progression";

// TODO: We will be gaining progression support very soon, but for now just a stub

export const progressionRouter = Router();

function StatusForProgressionError(Error: ProgressionError){
    switch(Error){
        case "forbidden":
            return 403;
        case "conflict":
            return 409;
        case "invalid_data":
        case "db_error":
            return 500;
    }
}

progressionRouter.get("/encountered-content/:characterId/:contentType", HasUndauntedMetagameAuth, async (req: any, res) => {
    const RequestorAccountId = req.AuthData.userId;
    const CharacterId = req.params.characterId;
    const ContentType = req.params.contentType as number;

    logger.info(`Querying encountered content for userId ${RequestorAccountId} and characterId ${CharacterId}`);

    const ContentResult = await QueryEncounteredContent(RequestorAccountId, CharacterId, [ContentType]);

    if(!ContentResult.success){
        res.status(StatusForProgressionError(ContentResult.error));
        res.send();
        return;
    }

    res.status(200);
    res.send({
        code: null,
        message: "OK",
        payload: {
            content_types: ContentResult.data,
            success: true
        }
    });
});

progressionRouter.post("/encountered-content/query/:characterId", HasUndauntedMetagameAuth, async (req: any, res) => {
    const RequestorAccountId = req.AuthData.userId;
    const CharacterId = req.params.characterId;
    const ContentTypes = req.body.content_types;

    logger.info(`Querying encountered content for userId ${RequestorAccountId} and characterId ${CharacterId}`);

    const ContentResult = await QueryEncounteredContent(RequestorAccountId, CharacterId, ContentTypes);

    if(!ContentResult.success){
        res.status(StatusForProgressionError(ContentResult.error));
        res.send();
        return;
    }

    res.status(200);
    res.send({
        code: null,
        message: "OK",
        payload: {
            content_types: ContentResult.data,
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

    const ContentResult = await AddEncounteredContent(RequestorAccountId, CharacterId, ContentType, ContentId);

    if(!ContentResult.success){
        res.status(StatusForProgressionError(ContentResult.error));
        res.send();
        return;
    }

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
        payload: {
            objectives: [
                
            ],
            progress_tracks: [
                {
                    phx_account_id: RequestorAccountId,
                    progression_id: "MasteryTrack_PlayerLevel",
                    progress: 99999999,
                    confirmed_fremium_rank: 99999999,
                    confirmed_premium_rank: 99999999,
                    confirmed_date: new Date().toISOString(),
                },
                {
                    phx_account_id: RequestorAccountId,
                    progression_id: "MasteryTrack_Behemoth",
                    progress: 99999999,
                    confirmed_fremium_rank: 99999999,
                    confirmed_premium_rank: 99999999,
                    confirmed_date: new Date().toISOString(),
                },
                {
                    phx_account_id: RequestorAccountId,
                    progression_id: "MasteryTrack_Weapon_Strikers",
                    progress: 99999999,
                    confirmed_fremium_rank: 99999999,
                    confirmed_premium_rank: 99999999,
                    confirmed_date: new Date().toISOString(),
                },
                {
                    phx_account_id: RequestorAccountId,
                    progression_id: "MasteryTrack_Weapon_Hammer",
                    progress: 99999999,
                    confirmed_fremium_rank: 99999999,
                    confirmed_premium_rank: 99999999,
                    confirmed_date: new Date().toISOString(),
                },
                {
                    phx_account_id: RequestorAccountId,
                    progression_id: "MasteryTrack_Weapon_Repeaters",
                    progress: 99999999,
                    confirmed_fremium_rank: 99999999,
                    confirmed_premium_rank: 99999999,
                    confirmed_date: new Date().toISOString(),
                },
                {
                    phx_account_id: RequestorAccountId,
                    progression_id: "MasteryTrack_Weapon_ChainBlades",
                    progress: 99999999,
                    confirmed_fremium_rank: 99999999,
                    confirmed_premium_rank: 99999999,
                    confirmed_date: new Date().toISOString(),
                },
                {
                    phx_account_id: RequestorAccountId,
                    progression_id: "MasteryTrack_Weapon_Axe",
                    progress: 99999999,
                    confirmed_fremium_rank: 99999999,
                    confirmed_premium_rank: 99999999,
                    confirmed_date: new Date().toISOString(),
                },
                {
                    phx_account_id: RequestorAccountId,
                    progression_id: "MasteryTrack_Weapon_Sword",
                    progress: 99999999,
                    confirmed_fremium_rank: 99999999,
                    confirmed_premium_rank: 99999999,
                    confirmed_date: new Date().toISOString(),
                },
                {
                    phx_account_id: RequestorAccountId,
                    progression_id: "MasteryTrack_Weapon_Warpike",
                    progress: 99999999,
                    confirmed_fremium_rank: 99999999,
                    confirmed_premium_rank: 99999999,
                    confirmed_date: new Date().toISOString(),
                },
                {
                    phx_account_id: RequestorAccountId,
                    progression_id: "MasteryTrack_Weapon_Spear",
                    progress: 99999999,
                    confirmed_fremium_rank: 99999999,
                    confirmed_premium_rank: 99999999,
                    confirmed_date: new Date().toISOString(),
                }
            ]
        }
    })
});

progressionRouter.get("/progression/objectives/:userId/:objectiveId", HasUndauntedMetagameAuth, (req: any, res) => {
    const RequestorAccountId = req.AuthData.userId;

    logger.info(`Objective progression fetched for userId ${RequestorAccountId}`);
    
    res.status(200);
    res.json({
        code: null,
        message: "OK",
        payload: {
            phx_account_id: req.params.userId,
            objective_id: req.params.objectiveId,
            progress: 9999999,
            completed_count: 9999999,
            created_date: new Date("1970-1-1").toISOString(),
            last_modified_date: new Date("1970-1-1").toISOString(),
        }
    })
});

progressionRouter.get("/breadcrumbs/:characterId", HasUndauntedMetagameAuth, async (req: any, res) => {
    const RequestedCharacterId = req.params.characterId;
    const RequestorUserId = req.AuthData.userId;

    logger.info(`Requested breadcrumbs for characterId ${RequestedCharacterId}`);

    const BreadcrumbsResult = await GetBreadcrumbsForCharacterIdAndUserId(RequestorUserId, RequestedCharacterId);

    if(!BreadcrumbsResult.success){
        res.status(StatusForProgressionError(BreadcrumbsResult.error));
        res.send();
        return;
    }

    res.status(200);
    res.json({
        code: null,
        message: "OK",
        payload: BreadcrumbsResult.data
    });
});

progressionRouter.post("/breadcrumbs/:characterId", HasUndauntedMetagameAuth, async (req: any, res) => {
    const RequestedCharacterId = req.params.characterId;
    const RequestorUserId = req.AuthData.userId;
    const BreadcrumbsFromUser = req.body.breadcrumbs;
    const UpdateVersion = req.body.updateVersion;

    logger.info(`Setting breadcrumbs for characterId ${RequestedCharacterId}`);

    const BreadcrumbsResult = await SetBreadcrumbsForCharacterIdAndUserId(RequestorUserId, RequestedCharacterId, BreadcrumbsFromUser, UpdateVersion);

    if(!BreadcrumbsResult.success){
        res.status(StatusForProgressionError(BreadcrumbsResult.error));
        res.send();
        return;
    }

    res.status(200);
    res.json({
        code: null,
        message: "OK",
        payload: BreadcrumbsResult.data
    });
});

progressionRouter.post("/progression/:userId", HasUndauntedMetagameAuth, (req: any, res) => {
    const RequestorAccountId = req.params.userId;
    
    logger.info(`Progression set for userId ${RequestorAccountId} (stubbed)`);
    
    res.status(400); // TODO: Figure out how to properly grant progression. If this returns anything other than 400, we get the infinite mastery pop issue
    res.send();
});

progressionRouter.get("/progression/:userId", HasUndauntedMetagameAuth, (req: any, res) => {
    const RequestorAccountId = req.AuthData.userId;

    // TODO: Impl proper progression. Right now this is the minimum to not block the Boreal crafting reqs

    logger.info(`Progression fetched for userId ${RequestorAccountId} (stubbed)`);
    
    res.status(200);
    res.json({
        code: null,
        message: "OK",
        payload: [
            {
                phx_account_id: RequestorAccountId,
                progression_id: "season09b",
                progress: 99999999,
                confirmed_fremium_rank: 99999999,
                confirmed_premium_rank: 99999999,
                confirmed_date: new Date().toISOString(),
            },
            {
                phx_account_id: RequestorAccountId,
                progression_id: "MasteryTrack_PlayerLevel",
                progress: 99999999,
                confirmed_fremium_rank: 99999999,
                confirmed_premium_rank: 99999999,
                confirmed_date: new Date().toISOString(),
            },
            {
                phx_account_id: RequestorAccountId,
                progression_id: "MasteryTrack_Behemoth",
                progress: 99999999,
                confirmed_fremium_rank: 99999999,
                confirmed_premium_rank: 99999999,
                confirmed_date: new Date().toISOString(),
            },
            {
                phx_account_id: RequestorAccountId,
                progression_id: "MasteryTrack_Weapon_Strikers",
                progress: 99999999,
                confirmed_fremium_rank: 99999999,
                confirmed_premium_rank: 99999999,
                confirmed_date: new Date().toISOString(),
            },
            {
                phx_account_id: RequestorAccountId,
                progression_id: "MasteryTrack_Weapon_Hammer",
                progress: 99999999,
                confirmed_fremium_rank: 99999999,
                confirmed_premium_rank: 99999999,
                confirmed_date: new Date().toISOString(),
            },
            {
                phx_account_id: RequestorAccountId,
                progression_id: "MasteryTrack_Weapon_Repeaters",
                progress: 99999999,
                confirmed_fremium_rank: 99999999,
                confirmed_premium_rank: 99999999,
                confirmed_date: new Date().toISOString(),
            },
            {
                phx_account_id: RequestorAccountId,
                progression_id: "MasteryTrack_Weapon_ChainBlades",
                progress: 99999999,
                confirmed_fremium_rank: 99,
                confirmed_premium_rank: 99,
                confirmed_date: new Date().toISOString(),
            },
            {
                phx_account_id: RequestorAccountId,
                progression_id: "MasteryTrack_Weapon_Axe",
                progress: 99999999,
                confirmed_fremium_rank: 99999999,
                confirmed_premium_rank: 99999999,
                confirmed_date: new Date().toISOString(),
            },
            {
                phx_account_id: RequestorAccountId,
                progression_id: "MasteryTrack_Weapon_Sword",
                progress: 99999999,
                confirmed_fremium_rank: 99999999,
                confirmed_premium_rank: 99999999,
                confirmed_date: new Date().toISOString(),
            },
            {
                phx_account_id: RequestorAccountId,
                progression_id: "MasteryTrack_Weapon_Warpike",
                progress: 99999999,
                confirmed_fremium_rank: 99999999,
                confirmed_premium_rank: 99999999,
                confirmed_date: new Date().toISOString(),
            }
        ]
    })
});
