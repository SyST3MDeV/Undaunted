import { logger } from "../logger";
import { GetRamsgateConnectionDetails, GetTrainingDojoConnectionDetails, StartupGameserverWithArgs, StartupGameserverWithHuntIdAndPlayers } from "./gameservers";

export async function HandleMatchmakingRequest(GameMode: string, GameArgs: string, HuntId: string, ExpectedPlayers: string[] | undefined){
    logger.info(`Handling matchmaking with GameMode: ${GameMode} HuntId: ${HuntId} and GameArgs: ${GameArgs}`);

    if(GameMode === "CITY"){
        return GetRamsgateConnectionDetails();
    }
    else if(GameMode === "SHARED"){
        if (HuntId != undefined && HuntId.trim().length > 0){
            if(HuntId == "ShatteredIsles_TrainingDojo"){
                return GetTrainingDojoConnectionDetails();
            }
        }
    }
    else if(GameMode === "ISLAND"){
        if(GameArgs != undefined && GameArgs.trim().length > 0){
            return await StartupGameserverWithArgs(GameArgs);
        }

        if(HuntId != undefined && HuntId.trim().length > 0 && ExpectedPlayers != undefined){
            return await StartupGameserverWithHuntIdAndPlayers(HuntId, ExpectedPlayers!);
        }
    }

    logger.error("Matchmaking failed, sending you to Ramsgate!");

    return GetRamsgateConnectionDetails();
}