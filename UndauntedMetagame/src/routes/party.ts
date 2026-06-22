import { Router } from "express";
import { HasUndauntedMetagameAuth } from "../middleware/HasUndauntedMetagameAuth";
import { logger } from "../logger";
import { GetUsernameForUserId } from "../controllers/login";

// TODO: Party functionality will be coming very soon (tm), for now this is just a stub

export const partyRouter = Router();

partyRouter.post("/party", HasUndauntedMetagameAuth, (req: any, res) => {
    const UserId = req.AuthData.userId;
    const Username = GetUsernameForUserId(UserId);

    logger.info("Get Party State (stubbed)");

    res.status(200);
    res.json({
        candidateId: "CANDIDATE_ID_LOL",
        candidateState: "QUEUED_FOR_START",
        gauntletLevel: null,
        leaderPlayerId: UserId,
        partyId: UserId, // TODO: Switch to tracked UUID
        playerHuntId: null, // TODO: Make current Hunt ID
        playerStates: [
            {
                consoleSessionId: null,
                displayName: Username,
                isMemberOfCandidate: true,
                platform: "win",
                playerId: UserId
            }
        ]
    });
});

partyRouter.get("/party/invites", (req: any, res) => {
    logger.info("Get Party Invites (stubbed)");

    res.status(200);
    res.json({
        invitations: []
    });
});