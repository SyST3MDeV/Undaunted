import { Router } from "express";
import { logger } from "../logger";
import { HandleMatchmakingRequest } from "../controllers/matchmaker";
import express from "express";

export const matchmakingRouter = Router();

matchmakingRouter.post("/handle-matchmaking-for-player", express.json(), (req, res) => {
    const GameMode = req.body.GameMode;
    const HuntId = req.body.HuntId;

    const MatchmakingResult = HandleMatchmakingRequest(GameMode, HuntId);

    res.status(200);
    res.json(MatchmakingResult);
});