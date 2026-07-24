import { Router } from "express";
import { HandleGameserverHeartbeat, HandleGameserverReadyCallback } from "../controllers/gameservers";

export const gameserverRouter = Router();

gameserverRouter.post("/ready", (req, res) => {
    const Result = HandleGameserverReadyCallback(req.header("x-undaunted-ready-token"), req.body);

    res.status(Result.status);
    res.json(Result.body);
});

gameserverRouter.post("/heartbeat", (req, res) => {
    const Result = HandleGameserverHeartbeat(
        req.header("x-undaunted-lifecycle-token"), req.body);

    res.status(Result.status);
    res.json(Result.body);
});
