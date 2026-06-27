import { Router } from "express";
import { HasUndauntedMetagameAuth } from "../middleware/HasUndauntedMetagameAuth";
import { logger } from "../logger";
import { HandlePlayerMatchmaking } from "../controllers/matchmaking";

export const matchmakingRouter = Router();

const QOS_TARGET_URL = process.env.QOS_TARGET_URL;
const TARGET_CHANGELIST = process.env.TARGET_CHANGELIST;

let MatchmakingMap: any = {}; // TODO: Move this to the controller

matchmakingRouter.post("/candidate/player/register", HasUndauntedMetagameAuth, (req: any, res) => {
    logger.info(`userId ${req.AuthData.userId} is registering for matchmaking!`);

    res.status(200);
    res.json({});
});

matchmakingRouter.delete("/party/member", HasUndauntedMetagameAuth, (req: any, res) => {
    logger.info(`Clear party (stubbed)`);

    res.status(200);
    res.json({});
});

matchmakingRouter.get("/candidate/regions", HasUndauntedMetagameAuth, (req: any, res) => {
    logger.info(`Querying regions for QoS`);

    res.status(200);
    res.json({
        code: 200,
        message: "success",
        payload: {
            maxPingingStepTime: 3,
            pingCount: 5,
            pingFrequency: 0.25,
            regionUrls: [
                QOS_TARGET_URL
            ]
        }
    });
});

matchmakingRouter.post("/key/generate", HasUndauntedMetagameAuth, async (req: any, res) => {
    res.status(400);
    res.send();
});

matchmakingRouter.get("/candidate/status", HasUndauntedMetagameAuth, async (req: any, res) => {
    const UserId = req.AuthData.userId;

    const MatchmakingResult = MatchmakingMap[UserId];

    if(MatchmakingResult != undefined){
        if(MatchmakingResult.Result.readyNow){
            logger.info(`Telling client to travel to ${MatchmakingResult.Result.host}:${MatchmakingResult.Result.port}`);

            res.status(200);
            res.json({
                candidateId: MatchmakingResult.CandidateId,
                candidateStatusPeriodMillis: 10000,
                gameMode: MatchmakingResult.GameMode,
                huntId: MatchmakingResult.HuntId,
                playerStates: {
                  UserId: {}
                },
                serverInfo: {
                    buildId: TARGET_CHANGELIST + "_1.4.4_shipping", // TODO: pull the end of the buildstring from somewhere nonstatic
                    gameSessionId: MatchmakingResult.CandidateId,
                    host: MatchmakingResult.Result.host,
                    port: MatchmakingResult.Result.port
                },
                status: "IN_PROGRESS",
                statusDuration: 0.0,
                statusReason: null
            });
        }
        else{
            logger.error(`Delayed ready not supported, failing matchmaking!`);

            res.status(404);
            res.send();
        }
    }
    else{
        logger.error(`UserId ${UserId} was not found in the MatchmakingMap`);

        res.status(404);
        res.send();
    }
});

matchmakingRouter.post("/candidate/join", HasUndauntedMetagameAuth, async (req: any, res) => {
    const UserId = req.AuthData.userId;
    const GameMode = req.body.gameMode;
    const GameArgs = req.body.gameArgs;
    const HuntId = req.body.playerHuntId;

    logger.info(`UserId ${UserId} wants to join a game with GameMode ${GameMode} & GameArgs ${GameArgs} & HuntId ${HuntId}`);

    // TODO: We put a LOT of faith in our authenticated users not abusing the matchmaking system right now
    // A reasonable addition would be checks on frequency of MM/server spinup
    // Best scenario is 1-1 for server session<->player and a new server cooldown

    const MatchmakingResult = await HandlePlayerMatchmaking(GameMode, GameArgs, HuntId);

    if(!MatchmakingResult.succeeded){
        res.status(400);
        res.send();
        return;
    }

    const CandidateId = crypto.randomUUID();

    MatchmakingMap[UserId] = {
        GameMode: GameMode,
        CandidateId: CandidateId,
        HuntId: HuntId,
        Result: MatchmakingResult
    };

    res.status(200);
    res.json({
        candidateId: CandidateId,
        gameMode: GameMode,
        huntId: HuntId,
        status: "MATCHING",
        statusReason: null
    });
});

matchmakingRouter.get("/QoS", (req, res) => {
    logger.info(`QoS Ping`);

    res.status(200);
    res.send("<!DOCTYPE html><html><body>pong</body></html>");
})