import { and, eq } from "drizzle-orm";
import { GetDb } from "../db";
import { inventory } from "../db/schema";
import { GetCharacterWithUid } from "./character";
import { logger } from "../logger";

async function DoesInventoryBelongToUserId(UserId: string, CharacterId: string){
    const CharacterFromDb = await GetCharacterWithUid(CharacterId, UserId);

    return CharacterFromDb != undefined;
}

export async function RunInventoryTransaction(UserId: string, CharacterId: string, TransactionId: string, InstancedItemsToAdd: any[], StackedItemsToAdd: any[], InstancedItemsToRemove: any[], StackedItemsToRemove: any[], InstancedItemsToSave: any[]){
    if(!await DoesInventoryBelongToUserId(UserId, CharacterId)){
        logger.error(`Specified characterId ${CharacterId} does not belong to user ${UserId}`);
        return false;
    }
    
    let CurrentInventory = await GetDb().query.inventory.findFirst({where: eq(inventory.characterId, CharacterId)});

    if(CurrentInventory == undefined){
        logger.info(`Creating inventory for characterId ${CharacterId}`)

        CurrentInventory = {
            characterId: CharacterId,
            stackedItems: "[]",
            instancedItems: "[]"
        };

        await GetDb().insert(inventory).values(CurrentInventory);
    }

    let InstancedItems: any[] = JSON.parse(CurrentInventory!.instancedItems);

    let StackedItems: any[] = JSON.parse(CurrentInventory!.stackedItems);

    for(let NewInstancedItem of InstancedItemsToAdd){
        InstancedItems.push(NewInstancedItem);
    }

    for(let NewStackedItem of StackedItemsToAdd){
        let found = false;

        for(let CmpStackedItem of StackedItems){
            if(CmpStackedItem.catalogId === NewStackedItem.catalogId){
                CmpStackedItem.quantity = CmpStackedItem.quantity + NewStackedItem.quantity;
                found = true;
                break;
            }
        }

        if(!found){
            StackedItems.push(NewStackedItem);
        }
    }

    // TODO: Consume removals & save

    await GetDb().update(inventory).set({stackedItems: JSON.stringify(StackedItems), instancedItems: JSON.stringify(InstancedItems)}).where(eq(inventory.characterId, CharacterId));

    return true;
}

export async function GetInventoryForUserIdAndCharacterId(UserId: string, CharacterId: string){
    if(!await DoesInventoryBelongToUserId(UserId, CharacterId)){ // TODO: HACK: Get rid of this ugly thing, this is a workaround as we don't have a userId on our inventories table
        return undefined;
    }

    let InventoryFromDb = await GetDb().query.inventory.findFirst({where: eq(inventory.characterId, CharacterId)});

    if(InventoryFromDb == undefined){
        logger.info(`Creating inventory for characterId ${CharacterId} and userId ${UserId}`);

        InventoryFromDb = {
            characterId: CharacterId,
            instancedItems: "[]",
            stackedItems: "[]",
        };

        await GetDb().insert(inventory).values(InventoryFromDb);
    }

    return {
        characterId: CharacterId,
        instancedItems: JSON.parse(InventoryFromDb!.instancedItems),
        stackedItems: JSON.parse(InventoryFromDb!.stackedItems)
    };
}