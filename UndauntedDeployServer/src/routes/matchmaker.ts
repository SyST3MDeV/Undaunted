import { Router } from "express";
import { logger } from "../logger";
import { HandleMatchmakingRequest } from "../controllers/matchmaker";
import { GetGameserverStatusForPlayer, GetRamsgatePrewarmStatus, TouchGameserverForPlayer } from "../controllers/gameservers";
import express from "express";

export const matchmakingRouter = Router();

matchmakingRouter.post("/handle-matchmaking-for-player", express.json(), async (req, res) => {
    const StartedAt = performance.now();
    const GameMode = req.body.GameMode;
    const GameArgs = req.body.GameArgs;
    const HuntId = req.body.HuntId;
    const ExpectedPlayers = req.body.ExpectedPlayers;
    const FreshInstance = req.body.FreshInstance === true;

    try{
        const MatchmakingResult = await HandleMatchmakingRequest(GameMode, GameArgs, HuntId, ExpectedPlayers, FreshInstance);
        const DurationMs = Math.round(performance.now() - StartedAt);

        logger.info({
            gameMode: GameMode,
            huntId: HuntId ?? "",
            durationMs: DurationMs,
            ramsgatePrewarm: GameMode === "CITY" ? GetRamsgatePrewarmStatus() : undefined
        }, "Matchmaking response ready");

        res.status(200);
        res.json(MatchmakingResult);
    }
    catch(Error){
        const DurationMs = Math.round(performance.now() - StartedAt);
        logger.error(Error, `Failed to handle matchmaking for GameMode ${GameMode} HuntId ${HuntId}`);
        logger.info({ gameMode: GameMode, huntId: HuntId ?? "", durationMs: DurationMs }, "Matchmaking response failed");

        res.status(503);
        res.json({
            error: "gameserver_startup_failed"
        });
    }
});

matchmakingRouter.post("/touch-player", express.json(), (req, res) => {
    const PlayerId = req.body.PlayerId;

    if(typeof PlayerId !== "string" || PlayerId.length === 0){
        res.status(400);
        res.json({touched: false});
        return;
    }

    const TouchedServer = TouchGameserverForPlayer(PlayerId);

    if(TouchedServer == undefined){
        res.status(404);
        res.json({touched: false});
        return;
    }

    res.status(200);
    res.json({
        touched: true,
        server: TouchedServer
    });
});

matchmakingRouter.post("/player-server-status", express.json(), async (req, res) => {
    const PlayerId = req.body.PlayerId;

    if(typeof PlayerId !== "string" || PlayerId.length === 0){
        res.status(400);
        res.json({
            found: false,
            joinable: false
        });
        return;
    }

    res.status(200);
    res.json(await GetGameserverStatusForPlayer(PlayerId));
});
