import {GetDb} from "../db"
import { gameserverapikeys, gameserverapikeystoregister } from "../db/schema";
import crypto from "crypto";
import { logger } from "../logger";

function HashGameserverAPIKey(GameserverAPIKeyToHash: string){
    return crypto.createHash("sha256").update(GameserverAPIKeyToHash, "utf8").digest("hex");
}

export async function DrainAndRegisterAPIKeys(){
    const APIKeysToRegister = await GetDb().query.gameserverapikeystoregister.findMany();

    await GetDb().delete(gameserverapikeystoregister);

    for(const APIKey of APIKeysToRegister){
        await GetDb().insert(gameserverapikeys).values({
            keyHash: HashGameserverAPIKey(APIKey.key)
        });
    }

    logger.info(`Registered ${APIKeysToRegister.length} new Gameserver API Key(s) on boot!`);
}

export async function IsValidGameserverAPIKey(GameserverAPIKey: string){
    const AllAPIKeyHashes = await GetDb().query.gameserverapikeys.findMany();

    const IncomingGameserverAPIKeyHashBuffer = Buffer.from(HashGameserverAPIKey(GameserverAPIKey), "hex");

    let Match: boolean = false;

    for(const CmpAPIKeyHash of AllAPIKeyHashes){
        const CmpAPIKeyHashBuffer = Buffer.from(CmpAPIKeyHash.keyHash!, "hex");

        if(CmpAPIKeyHashBuffer.length !== IncomingGameserverAPIKeyHashBuffer.length){
            continue;
        }

        if(crypto.timingSafeEqual(IncomingGameserverAPIKeyHashBuffer, CmpAPIKeyHashBuffer)){
            Match = true;
        }
    }

    return Match;
}