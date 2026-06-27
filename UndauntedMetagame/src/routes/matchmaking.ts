import { Router } from "express";
import { HasUndauntedMetagameAuth } from "../middleware/HasUndauntedMetagameAuth";
import { logger } from "../logger";
import { HandlePlayerMatchmaking } from "../controllers/matchmaking";

export const matchmakingRouter = Router();

const QOS_TARGET_URL = process.env.QOS_TARGET_URL;

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
    // FIXME: Impl
});

matchmakingRouter.get("/candidate/status", HasUndauntedMetagameAuth, async (req: any, res) => {
    // FIXME: Impl
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

    logger.fatal("Unsupported Matchmaking Result!");

    // TODO: Support non-ready-now

    // TODO: Support proper host+port
});

matchmakingRouter.get("/QoS", (req, res) => {
    logger.info(`QoS Ping`);

    res.status(200);
    res.send("<!DOCTYPE html><html><body>pong</body></html>");
})