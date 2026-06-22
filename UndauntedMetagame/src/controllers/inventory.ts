import { and, eq } from "drizzle-orm";
import { GetDb } from "../db";
import { inventory } from "../db/schema";
import { GetCharacterWithUid } from "./character";

async function DoesInventoryBelongToUserId(UserId: string, CharacterId: string){
    const CharacterFromDb = await GetCharacterWithUid(CharacterId, UserId);

    return CharacterFromDb != undefined;
}

export async function GetInventoryForUserIdAndCharacterId(UserId: string, CharacterId: string){
    if(!DoesInventoryBelongToUserId(UserId, CharacterId)){ // TODO: HACK: Get rid of this ugly thing, this is a workaround as we don't have a userId on our inventories table
        return undefined;
    }

    const InventoryFromDb = await GetDb().query.inventory.findFirst({where: eq(inventory.characterId, CharacterId)});

    if(InventoryFromDb == undefined){
        return undefined;
    }

    return {
        characterId: CharacterId,
        instancedItems: JSON.parse(InventoryFromDb!.instancedItems),
        stackedItems: JSON.parse(InventoryFromDb!.stackedItems)
    };
}