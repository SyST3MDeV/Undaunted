import { logger } from "../logger";
import crypto from "node:crypto";

const MATCHMAKING_MODE = process.env.MATCHMAKING_MODE;
const DEPLOYSERVER_URL = process.env.DEPLOYSERVER_URL;
const DEPLOYSERVER_MATCHMAKING_PATH = "/api/matchmaker/handle-matchmaking-for-player";

type MatchmakingQueueData = {
    Players: string[],
    LastPlayerAddedTime: Date,
    Resolved: boolean
};

type MatchmakingResult = {
    Ready: boolean,
    HuntId: string,
    CandidateId: string,
    Host: string,
    Port: number
};

let MatchmakingQueueMap: Map<string, MatchmakingQueueData> = new Map<string, MatchmakingQueueData>(); // Key is HuntID
let MatchmakingResultMap: Map<string, MatchmakingResult> = new Map<string, MatchmakingResult>(); // Key is PlayerID

function HuntIdRequiresMatchmaking(HuntId: string){
    return HuntId.includes("CR19");
}

async function LaunchGameOnDeployserver(GameMode: string, GameArgs: string, HuntId: string, ExpectedPlayers: string[] | undefined){
    logger.info(`Querying DeployServer for GameMode: ${GameMode} HuntId ${HuntId} with ${ExpectedPlayers?.length} Expected Players!`);

    const URL = "http://" + DEPLOYSERVER_URL + DEPLOYSERVER_MATCHMAKING_PATH;

    const MatchmakingResult = await fetch(URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            GameMode: GameMode,
            GameArgs: GameArgs,
            HuntId: HuntId,
            ExpectedPlayers: ExpectedPlayers!
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

async function PopQueue(HuntId: string){
    const MatchmakingQueue = MatchmakingQueueMap.get(HuntId);

    logger.info(MatchmakingQueue);
    
    const GameOnDeployServer = await LaunchGameOnDeployserver("ISLAND", "", HuntId, MatchmakingQueue!.Players);

    for(const Player of MatchmakingQueue!.Players){
        const PlayerMatchmakingResultToUpdate = MatchmakingResultMap.get(Player);

        if(PlayerMatchmakingResultToUpdate != undefined){
            PlayerMatchmakingResultToUpdate.Host = GameOnDeployServer.host;
            PlayerMatchmakingResultToUpdate.Port = GameOnDeployServer.port;
            PlayerMatchmakingResultToUpdate.Ready = true;
        }
    }

    MatchmakingQueueMap.delete(HuntId);
}

export async function CheckAndUpdateQueueStatus(PlayerId: string){
    const PlayerMatchmakingResult = MatchmakingResultMap.get(PlayerId);

    if(PlayerMatchmakingResult == undefined){
        return undefined;
    }

    if(!PlayerMatchmakingResult.Ready){
        const MatchmakingQueue = MatchmakingQueueMap.get(PlayerMatchmakingResult.HuntId);

        if((new Date()).getTime() - MatchmakingQueue!.LastPlayerAddedTime.getTime() > 20000){ // 20 sec
            await PopQueue(PlayerMatchmakingResult.HuntId);
        }
    }

    return PlayerMatchmakingResult;
}

async function QueuePlayer(HuntId: string, PlayerId: string){
    if(MatchmakingQueueMap.get(HuntId) != undefined){
        const CurrentMMEntry = MatchmakingQueueMap.get(HuntId);

        CurrentMMEntry!.Players.push(PlayerId);
        CurrentMMEntry!.LastPlayerAddedTime = new Date();

        if(CurrentMMEntry!.Players.length >= 4){
            await PopQueue(HuntId);
        }
    }
    else{
        MatchmakingQueueMap.set(HuntId, {
            Players: [PlayerId],
            LastPlayerAddedTime: new Date(),
            Resolved: false
        });
    }

    MatchmakingResultMap.set(PlayerId, {
        Ready: false,
        CandidateId: crypto.randomUUID(),
        HuntId: HuntId,
        Host: "",
        Port: 0
    });
}

export async function HandlePlayerMatchmaking(GameMode: string, GameArgs: string, HuntId: string, PlayerId: string){
    if(MATCHMAKING_MODE === "DISABLED"){
        logger.warn("Matchmaking is disabled, refusing MM!");

        return false;
    }
    else if(MATCHMAKING_MODE === "DEPLOYSERVER"){
        if(HuntId == undefined || HuntId.trim().length == 0 || !HuntIdRequiresMatchmaking(HuntId)){
            const GameOnDeployServer = await LaunchGameOnDeployserver(GameMode, GameArgs, HuntId, undefined);

            MatchmakingResultMap.set(PlayerId, {
                Ready: true,
                CandidateId: crypto.randomUUID(),
                HuntId: HuntId,
                Host: GameOnDeployServer.host,
                Port: GameOnDeployServer.port
            });

            return true;
        }
        else{
            QueuePlayer(HuntId, PlayerId);

            return true;
        }
    }
    else{
        logger.fatal("Unsupported MATCHMAKING_MODE!");

        return false;
    }
}