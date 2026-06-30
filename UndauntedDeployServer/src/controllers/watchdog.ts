import { logger } from "../logger";
import { Gameservers, ShutdownServer } from "./gameservers";

/**
 * TODO:
 * This watchdog is SUPER basic rn, and will result in zombie processes as players will often finish hunts in quicker than the allotted time.
 * We err on the side of killing too late than too early
 * If the server gets bogged down, we'll add more checks here.
 */

export async function RunWatchdog(){
    logger.info(`Running Gameserver Watchdog!`);

    for(const Gameserver of Gameservers){
        if((new Date()).getTime() - Gameserver.startTime.getTime() > 40 * 60 * 1000){ // Was this server launched more that 40 minutes ago?
            logger.info(`Shutting down gameserver w/ PID ${Gameserver.processId} & Port ${Gameserver.port}`);
            
            ShutdownServer(Gameserver);
        }
    }
}