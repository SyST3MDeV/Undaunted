import { Router } from "express";
import { logger } from "../logger";
import { HasUndauntedMetagameAuth } from "../middleware/HasUndauntedMetagameAuth";

export const loginRouter = Router();

loginRouter.get("/features/platform/win", (req, res) => {
    logger.info("Features");

    res.send({
        "code" : null,
        "message" : "OK",
        "payload" : {
           "crossplay" : true,
           "crossprogression" : true
        }
    });
});

loginRouter.get("/account/link/epic/:AccId", (req, res) => {
    logger.info("Account Linking");

    res.json({
        "code" : null,
        "message" : "OK",
        "payload" : {
           "isLinked" : true
        }
    });
});

loginRouter.post("/login", HasUndauntedMetagameAuth, (req: any, res) => {
    if(req.AuthData.userId !== req.body.email){
        res.status(400);

        logger.error(`UserID from Undaunted Auth ${req.AuthData.userId} didn't match UserID from token ${req.AuthData.email}`);

        return;
    }

    logger.info(`${req.body.email} is logging in!`);

    res.json({
        "error_code": "TicketRateOk",
        "message": "",
        "state": "OPEN",
        "timeout": 8000,
        "title": ""
    });
});

loginRouter.get("/accountinfo", HasUndauntedMetagameAuth, (req: any, res) => {
    logger.info("Account info")

    res.json({
        "accountId" : req.AuthData.userId,
        "creationDate" : "2000-01-01 00:00:00",
        "email" : null,
        "preferredLanguage" : null,
        "username" : null,
        "verified" : true
    });
});

loginRouter.get("/tags", HasUndauntedMetagameAuth, (req: any, res) => {
    logger.info("Tags")

    res.json({
        "accountId" : req.AuthData.userId,
        "tags": []
    });
});

loginRouter.put("/gamesession/epic", HasUndauntedMetagameAuth, (req: any, res) => {
    const AuthHeader = req.headers.authorization;

    const Token = AuthHeader.slice("bearer ".length);

    // A note on auth tokens:
    // The original flow went Epic Launcher -> Epic -> PHX
    // With each step having it's own auth token.
    // Since this is unneeded complexity for us, we just use the same token for all 3
    // Hence this echo endpoint

    res.json({
        "code": null,
        "message": "OK",
        "payload": {
            "error_code": null,
            "sessionid": Token,
            "sessionToken": Token
        }
    })
});