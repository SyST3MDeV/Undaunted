import { Router } from "express";
import { logger } from "../logger";
import { HandleMatchmakingRequest } from "../controllers/matchmaker";

export const matchmakingRouter = Router();

matchmakingRouter.post("/handle-matchmaking-for-player", (req, res) => {
    const GameMode = req.body.GameMode;
    const GameType = req.body.GameType;
    const HuntId = req.body.HuntId;

    const MatchmakingResult = HandleMatchmakingRequest(GameMode, GameType, HuntId);

    res.status(200);
    res.json(MatchmakingResult);
});