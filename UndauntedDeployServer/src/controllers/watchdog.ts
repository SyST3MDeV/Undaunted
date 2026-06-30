import { kill } from "node:process";
import { logger } from "../logger";
import { Gameserver, Gameservers, CleanupServer } from "./gameservers";

/**
 * TODO:
 * This watchdog is SUPER basic rn, and will result in zombie processes as players will often finish hunts in quicker than the allotted time.
 * We err on the side of killing too late than too early
 * If the server gets bogged down, we'll add more checks here.
 */

function IsGameserverStillAlive(GameserverToCheck: Gameserver){
    try{
        kill(GameserverToCheck.processId, 0);

        return true;
    } catch(err) {
        return false;
    }
}

export async function RunWatchdog(){
    logger.info(`Running Gameserver Watchdog!`);

    for(const Gameserver of Gameservers){
        if(!IsGameserverStillAlive(Gameserver)){
            console.log(`Cleaning up Gameserver on port ${Gameserver.port}`);

            CleanupServer(Gameserver);
        }
    }
}