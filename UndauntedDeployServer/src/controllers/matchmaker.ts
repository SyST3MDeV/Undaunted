import { logger } from "../logger";
import { GetRamsgateConnectionDetails, GetTrainingDojoConnectionDetails } from "./gameservers";

export function HandleMatchmakingRequest(GameMode: string, HuntId: string){
    logger.info(`Handling matchmaking with GameMode: ${GameMode} and HuntId: ${HuntId}`);

    if(GameMode === "CITY"){
        return GetRamsgateConnectionDetails();
    }
    else if(GameMode === "ISLAND"){
        return GetTrainingDojoConnectionDetails();
    }
    else{
        return GetTrainingDojoConnectionDetails();
    }
}