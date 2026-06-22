import { Router } from "express";
import { HasUndauntedMetagameAuth } from "../middleware/HasUndauntedMetagameAuth";
import { logger } from "../logger";
import { GetInventoryForUserIdAndCharacterId } from "../controllers/inventory";

export const inventoryRouter = Router();

inventoryRouter.post("/inventory/:characterId/:changeList", HasUndauntedMetagameAuth, (req: any, res) => {
    logger.info("Inventory migration (stubbed)");

    res.status(200);
    res.json({
        code: null,
        message: ""
    });
});

inventoryRouter.get("/inventory/:userId/:characterId", HasUndauntedMetagameAuth, (req: any, res) => {
    const UserId = req.AuthData.userId;
    const CharacterId = req.params.characterId;

    logger.info(`UserId ${UserId} requested inventory for CharacterId ${CharacterId}`);

    const Inventory = GetInventoryForUserIdAndCharacterId(UserId, CharacterId);

    if(Inventory != undefined){
        res.status(200);
        res.json(Inventory);
    }
    else{
        res.status(400);
        res.send();
    }
});

inventoryRouter.post("/inventory", HasUndauntedMetagameAuth, (req: any, res) => {
    const UserId = req.AuthData.userId;
    const CharacterId = req.body.characterId;
    const TransactionId = req.body.transactionId;
    const InstancedItemsToAdd = req.body.addInstancedItems;
    const StackedItemsToAdd = req.body.addStackedItems;
    const InstancedItemsToRemove = req.body.removeInstancedItems;
    const StackedItemsToRemove = req.body.removeStackedItems;
    const InstancedItemsToSave = req.body.saveInstancedItems;
});