import { logger } from "../logger";

const MATCHMAKING_MODE = process.env.MATCHMAKING_MODE;

export async function HandlePlayerMatchmaking(GameMode: string, GameType: string, GameArgs: string, HuntId: string){
    if(MATCHMAKING_MODE === "DISABLED"){
        logger.warn("Matchmaking is disabled, refusing MM!");

        return {
            succeeded: false,
            readyNow: false,
            host: "",
            port: 0
        };
    }
    else{
        logger.fatal("Unsupported MATCHMAKING_MODE!");

        return {
            succeeded: false,
            readyNow: false,
            host: "",
            port: 0
        };
    }
}