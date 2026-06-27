import { GetRamsgateConnectionDetails, GetTrainingDojoConnectionDetails } from "./gameservers";

export function HandleMatchmakingRequest(GameMode: string, GameType: string, HuntId: string){
    if(GameType === "CITY"){
        return GetRamsgateConnectionDetails();
    }
    else if(GameType === "HUNTING_GROUND"){
        return GetTrainingDojoConnectionDetails();
    }
}