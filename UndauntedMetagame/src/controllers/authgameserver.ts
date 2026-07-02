import {GetDb} from "../db"
import { gameserverapikeys, gameserverapikeystoregister } from "../db/schema";
import { logger } from "../logger";
import { CreateAPIKeyCache, HashAPIKey } from "./apikeycache";

const GameserverKeys = CreateAPIKeyCache("Gameserver", () =>
    GetDb().query.gameserverapikeys.findMany({
        columns: {
            keyHash: true
        }
    })
);

export async function DrainAndRegisterAPIKeys(){
    const RegisteredAPIKeyCount = GetDb().transaction((tx) => {
        const KeysToRegister = tx.query.gameserverapikeystoregister.findMany({
            columns: {
                key: true
            }
        }).sync();

        if(KeysToRegister.length > 0){
            tx.insert(gameserverapikeys).values(KeysToRegister.map((APIKey) => ({
                keyHash: HashAPIKey(APIKey.key)
            }))).run();

            tx.delete(gameserverapikeystoregister).run();
        }

        return KeysToRegister.length;
    });

    await GameserverKeys.refresh();

    logger.info(`Registered ${RegisteredAPIKeyCount} new Gameserver API Key(s) on boot!`);
}

export async function IsValidGameserverAPIKey(GameserverAPIKey: string){
    return GameserverKeys.has(GameserverAPIKey);
}
