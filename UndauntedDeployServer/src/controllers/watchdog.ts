import { kill } from "node:process";
import { logger } from "../logger";
import { Gameserver, Gameservers, CleanupServer, CleanupStaleAssignments, GetGameserverIdleShutdownReason, ShutdownIdleGameserver, ShutdownIdleRamsgate } from "./gameservers";

/**
 * TODO:
 * This watchdog is SUPER basic rn, only releases resources, the server itself handles cleaning itself up
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
    // logger.info(`Running Gameserver Watchdog!`);

    CleanupStaleAssignments();
    for(const Gameserver of [...Gameservers]){
        if(!IsGameserverStillAlive(Gameserver)){
            logger.info(`Cleaning up dead gameserver on port ${Gameserver.port}`);

            await CleanupServer(Gameserver);

            continue;
        }

        if(Gameserver.isRamsgate){
            const IdleDecision = GetGameserverIdleShutdownReason(Gameserver);
            if(IdleDecision != undefined){
                await ShutdownIdleRamsgate(Gameserver, IdleDecision);
            }
            continue;
        }

        const IdleDecision = GetGameserverIdleShutdownReason(Gameserver);
        if(IdleDecision != undefined){
            await ShutdownIdleGameserver(Gameserver, IdleDecision);
        }
    }
}
