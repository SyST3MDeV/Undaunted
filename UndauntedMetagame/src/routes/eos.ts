import { Router } from "express";
import { logger } from "../logger";
import { GetUserIDForAPIKey, SignMetagameJWTForUid } from "../controllers/authuser";
import { HasUndauntedMetagameAuth } from "../middleware/HasUndauntedMetagameAuth";
import { GetUsernameForUserId } from "../controllers/login";

export const eosRouter = Router();

eosRouter.post("/account/api/oauth/token", async (req, res) => {
    if(process.env.AUTH_MODE === "NONE" && process.env.NODE_ENV !== "production"){
        const UserId = req.body.exchange_code;

        logger.info(`Logging in ${UserId}!`);

        const AuthToken = SignMetagameJWTForUid(UserId);

        res.json({
            "access_token": AuthToken,
            "token_type": "bearer",
            "expires_at": "2085-09-09T01:01:01.703Z", // TODO: We sign 24hr JWTs so we're unlikely to hit this, but just in case (tm)
            "features": ["Achievements", "AntiCheat", "Ecom", "Voice"],
            "organization_id": "o-krlzxj88qrtb69fredeuaf887bl5az",
            "product_id": "prod-jackal",
            "sandbox_id": "jackal",
            "deployment_id": "53565ba467df4edbb6f5a3d939a8b4f2",
            "expires_in": 86400,
            "refresh_token": "refresh.token.lol", // TODO: IDK if we need to support this considering our intended flow, but flagged regardless
            "refresh_expires_at": "2085-09-09T01:01:01.703Z",
            "account_id": UserId
        });
    }
    else if(process.env.AUTH_MODE === "APIKEY"){
        const ApiKey = req.body.exchange_code;

        const UserId = await GetUserIDForAPIKey(ApiKey);

        if(UserId != undefined){
            logger.info(`Logging in ${UserId}!`);

            const AuthToken = SignMetagameJWTForUid(UserId);

            res.json({
                "access_token": AuthToken,
                "token_type": "bearer",
                "expires_at": "2085-09-09T01:01:01.703Z", // TODO: We sign 24hr JWTs so we're unlikely to hit this, but just in case (tm)
                "features": ["Achievements", "AntiCheat", "Ecom", "Voice"],
                "organization_id": "o-krlzxj88qrtb69fredeuaf887bl5az",
                "product_id": "prod-jackal",
                "sandbox_id": "jackal",
                "deployment_id": "53565ba467df4edbb6f5a3d939a8b4f2",
                "expires_in": 86400,
                "refresh_token": "refresh.token.lol", // TODO: IDK if we need to support this considering our intended flow, but flagged regardless
                "refresh_expires_at": "2085-09-09T01:01:01.703Z",
                "account_id": UserId
            });
        }
        else{
            logger.error(`Invalid API key auth!`);

            res.status(400);
            res.send();
        }
    }
    else{
        logger.fatal("No login method configured!");
    }
});

eosRouter.get("/account/api/oauth/verify", (req, res) => {
    logger.info("Verifying token");

    // TODO: EOS treats this as a "just checking in" endpoint, so I've gone with a minimal stub. Validate this is correct.

    res.json({
      "active": true,
      "scope": "basic_profile friends_list presence",
      "token_type": "bearer",
      "expires_in": 86400,
      "expires_at": "2085-09-09T01:01:01.703Z",
      "account_id": "9626f441055349ce8cb7d7d5a483eaa2",
      "client_id": "xyza7891lhxMVYGCON7LgnKZZ8HQGD5H",
      "application_id": "fghi4567O03HROxEjwbn7kgXpBhnhWwv"
    });
});

eosRouter.get("/account/api/public/account/:AccId", (req, res) => {
    logger.info("EOS Account Info (stubbed)");

    res.json({});
});

eosRouter.get("/account/api/public/account/:AccId/externalAuths", (req, res) => {
    logger.info("External Auths (stubbed)");

    res.json({});
});

eosRouter.delete("/account/api/oauth/sessions/kill", (req, res) => {
    logger.info("Session kill (stubbed)");

    // TODO: Is this needed?

    res.json({});
})

eosRouter.delete("/account/api/oauth/sessions/kill/:AuthToken", (req, res) => {
    logger.info("Session kill (stubbed)");

    // TODO: Is this needed?

    res.json({});
})

eosRouter.get("/account/api/public/account", HasUndauntedMetagameAuth, (req: any, res) => {
    const UserId = req.AuthData.userId;
    const Username = GetUsernameForUserId(UserId);

    logger.info(`Account info for userId ${UserId}`);

    res.json({
        "id": UserId,
        "displayName": Username,
        "name": "",
        "lastName": "",
        "email": "",
        "failedLoginAttempts": 0,
        "lastLogin": new Date().toISOString(),
        "numberOfDisplayNameChanges": 0,
        "ageGroup": "ADULT",
        "headless": false,
        "country": "US",
        "lastNameChange": new Date().toISOString(),
        "preferredLanguage": "en",
        "canUpdateDisplayName": false,
        "tfaEnabled": false,
        "emailVerified": true,
        "minorVerified": false,
        "minorStatus": "NOT_MINOR"
    });
});
