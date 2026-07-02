import { Router } from "express";
import { HasUndauntedMetagameAuth } from "../middleware/HasUndauntedMetagameAuth";
import { logger } from "../logger";
import { GetInventoryForUserIdAndCharacterId, RunInventoryTransaction, UpdateInstancedItem } from "../controllers/inventory";

export const inventoryRouter = Router();

inventoryRouter.post("/inventory/:characterId/:changeList", HasUndauntedMetagameAuth, (req: any, res) => {
    logger.info("Inventory migration (stubbed)");

    res.status(200);
    res.json({
        code: null,
        message: ""
    });
});

inventoryRouter.get("/inventory/:userId/:characterId", HasUndauntedMetagameAuth, async (req: any, res) => {
    const UserId = req.AuthData.IsGameserver ? req.params.userId : req.AuthData.userId;
    
    req.AuthData.userId;
    const CharacterId = req.params.characterId;

    logger.info(`UserId ${UserId} requested inventory for CharacterId ${CharacterId}`);

    const Inventory = await GetInventoryForUserIdAndCharacterId(UserId, CharacterId);

    if(Inventory != undefined){
        res.status(200);
        res.json(Inventory);
    }
    else{
        res.status(400);
        res.send();
    }
});

inventoryRouter.post("/inventory", HasUndauntedMetagameAuth, async (req: any, res) => {
    const UserId = req.AuthData.IsGameserver ? req.body.accountId : req.AuthData.userId;
    const CharacterId = req.body.characterId;
    const TransactionId = req.body.transactionId;
    const InstancedItemsToAdd = req.body.addInstancedItems;
    const StackedItemsToAdd = req.body.addStackedItems;
    const InstancedItemsToRemove = req.body.removeInstancedItems;
    const StackedItemsToRemove = req.body.removeStackedItems;
    const InstancedItemsToSave = req.body.saveInstancedItems;

    if(await RunInventoryTransaction(UserId, CharacterId, TransactionId, InstancedItemsToAdd, StackedItemsToAdd, InstancedItemsToRemove, StackedItemsToRemove, InstancedItemsToSave)){
        logger.info(`Ran transactionId ${TransactionId} for userId ${UserId} and characterId ${CharacterId}`);

        res.status(200);
        res.json({
            createdInstancedItems: InstancedItemsToAdd,
            updatedInstancedItems: InstancedItemsToAdd, // TODO: Actually properly diff & merge the JSON blobs
            updatedStackedItems: StackedItemsToAdd,
            removedInstancedItems: InstancedItemsToRemove
        });

        return;
    }
    else{
        logger.error(`transactionId ${TransactionId} for userId ${UserId} and characterId ${CharacterId} FAILED!`);

        res.status(400);
        res.send();
        return;
    }
});

inventoryRouter.post("/inventory/instanceditem", HasUndauntedMetagameAuth, async (req: any, res) => {
    const CharacterId = req.body.characterId;
    const UserId = req.AuthData.IsGameserver ? req.body.accountId : req.AuthData.UserId;
    const InstanceId = req.body.instanceId;
    const CatalogId = req.body.catalogId;
    const ItemData = req.body.itemData;
    const UpdateVersion = req.body.updateVersion;

    const Item = await UpdateInstancedItem(CharacterId, UserId, InstanceId, CatalogId, ItemData, UpdateVersion);

    res.status(200);
    res.json(Item);
});