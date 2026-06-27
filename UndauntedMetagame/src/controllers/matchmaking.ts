import { logger } from "../logger";

const MATCHMAKING_MODE = process.env.MATCHMAKING_MODE;
const DEPLOYSERVER_URL = process.env.DEPLOYSERVER_URL;
const DEPLOYSERVER_MATCHMAKING_PATH = "/api/matchmaker/handle-matchmaking-for-player";

export async function HandlePlayerMatchmaking(GameMode: string, GameArgs: string, HuntId: string){
    if(MATCHMAKING_MODE === "DISABLED"){
        logger.warn("Matchmaking is disabled, refusing MM!");

        return {
            succeeded: false,
            readyNow: false,
            host: "",
            port: 0
        };
    }
    else if(MATCHMAKING_MODE === "DEPLOYSERVER"){
        logger.info(`Querying DeployServer for GameMode: ${GameMode} HuntId ${HuntId}`);

        const URL = "http://" + DEPLOYSERVER_URL + DEPLOYSERVER_MATCHMAKING_PATH;

        const MatchmakingResult = await fetch(URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                GameMode: GameMode,
                HuntId: HuntId
            })
        });

        if(MatchmakingResult.status === 200){
            const MatchmakingData = await MatchmakingResult.json();

            logger.info(`DeployServer returned gameserver ${MatchmakingData.host}:${MatchmakingData.port}`);

            return {
                succeeded: true,
                readyNow: true,
                host: MatchmakingData.host,
                port: MatchmakingData.port
            }
        }
        else{
            logger.error(`DeployServer returned status ${MatchmakingResult.status}`);

            return {
                succeeded: false,
                readyNow: false,
                host: "",
                port: 0
            };
        }
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