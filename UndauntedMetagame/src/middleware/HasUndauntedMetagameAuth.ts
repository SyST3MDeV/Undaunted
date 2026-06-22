import { NextFunction, Request, Response } from "express";
import { logger } from "../logger";
import { ValidateMetagameJWTAndGetPayload } from "../controllers/auth";

export function HasUndauntedMetagameAuth(req: Request, res: Response, next: NextFunction){
    const AuthHeader = req.headers.authorization;

    if(AuthHeader == undefined || (!AuthHeader?.startsWith("bearer ") && !AuthHeader?.startsWith("Bearer ") && !AuthHeader?.startsWith("BEARER "))){
        res.status(401);

        logger.error("Unauthenticated req to something that needed Undaunted Metagame auth, make sure this isn't a dedicated server!");

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