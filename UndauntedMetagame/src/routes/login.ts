import { Router } from "express";
import { logger } from "../logger";
import { HasUndauntedMetagameAuth } from "../middleware/HasUndauntedMetagameAuth";
import { GetDb } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import { GetUsernameForUserId } from "../controllers/login";

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

loginRouter.post("/login", HasUndauntedMetagameAuth, async (req: any, res) => {
    if(req.AuthData.userId !== req.body.email){
        res.status(400);

        logger.error(`UserID from Undaunted Auth ${req.AuthData.userId} didn't match UserID from token ${req.AuthData.email}`);

        return;
    }

    let UserRecord = await GetDb().query.users.findFirst({where: eq(users.userId, req.AuthData.userId)});

    if(UserRecord == undefined){
        res.status(400);

        logger.error(`UserID from Undaunted Auth ${req.AuthData.userId} had no database entry!`);

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

loginRouter.get("/accountinfo", HasUndauntedMetagameAuth, async (req: any, res) => {
    logger.info("Account info")

    const Username = await GetUsernameForUserId(req.AuthData.userId);

    res.json({
        "accountId" : req.AuthData.userId,
        "creationDate" : "2000-01-01 00:00:00",
        "email" : null,
        "preferredLanguage" : null,
        "username" : Username,
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
            "sessionid": "SESSION_ID_LOL", // TODO: This is surfaced in the UI, but I don't think it matters for anything else
            "sessionToken": Token 
        }
    })
});

loginRouter.post("/accountinfo/public", HasUndauntedMetagameAuth, async (req: any, res) => {
    const AccountIdToLookupFromRequest = req.body.accountId;
    const RequestorAccountId = req.AuthData.userId;

    const Username = await GetUsernameForUserId(req.AuthData.userId);

    // TODO: I *think* the idea here was I'm-authenticated-let-me-look-up-anybody
    // Not super comfy with that right now, so for rn I'm just using the requestor's accId and looking that up.
    // Might need to change in the future with party functionality

    if(AccountIdToLookupFromRequest !== RequestorAccountId){
        logger.error(`Looked up ${AccountIdToLookupFromRequest} from requestor ${RequestorAccountId} this will break things!`);
    }
    else{
        logger.info(`Looked up account info for ${RequestorAccountId}`);
    }

    res.status(200);
    res.json({
        accountId: RequestorAccountId,
        isSubscribed: true,
        language: null,
        linkedAccounts: [
            {
                accountId: RequestorAccountId,
                accountType: "epic"
            }
        ],
        username: Username
    });
});