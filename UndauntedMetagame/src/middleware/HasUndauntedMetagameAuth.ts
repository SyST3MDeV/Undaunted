import { NextFunction, Request, Response } from "express";
import { logger } from "../logger";
import { ValidateMetagameJWTAndGetPayload } from "../controllers/auth";
import { IsValidGameserverAPIKey } from "../controllers/apikeys";
import { JwtPayload } from "jsonwebtoken";

export async function HasUndauntedMetagameAuth(req: Request, res: Response, next: NextFunction){
    const AuthHeader = req.headers.authorization;

    const GameserverAuthHeader = req.headers["x-undaunted-gameserver-apikey"];

    if(GameserverAuthHeader !== undefined){
        const IsValid = await IsValidGameserverAPIKey(GameserverAuthHeader as string);

        if(IsValid){
            if(AuthHeader != undefined){ // Why this double-auth amalgam? Sometimes the client sends it's Bearer auth to the server, and the server makes reqs where the only userId identifying factor is that auth token. This fixes that up, so we have that context.
                const Token = AuthHeader.slice("bearer ".length);

                const Payload = ValidateMetagameJWTAndGetPayload(Token);

                (req as any).AuthData = {
                    IsGameserver: true,
                    ...(Payload as JwtPayload)
                };
            }
            else{
                (req as any).AuthData = {
                    IsGameserver: true,
                };
            }

            next();

            return;
        }
        else{
            logger.error(`Invalid Gameserver API Key Auth`);
            return;
        }
    }

    if(AuthHeader == undefined || (!AuthHeader?.startsWith("bearer ") && !AuthHeader?.startsWith("Bearer ") && !AuthHeader?.startsWith("BEARER "))){
        res.status(401);

        logger.error(`Unauthenticated ${req.method} to ${req.path} which needs Undaunted Metagame auth!`);

        return;
    }

    const Token = AuthHeader.slice("bearer ".length);

    try{
        const Payload = ValidateMetagameJWTAndGetPayload(Token);

        (req as any).AuthData = Payload;

        next();
    } catch {
        res.status(401);

        logger.warn("Request with bad Undaunted Metagame auth!");

        return;
    }
}