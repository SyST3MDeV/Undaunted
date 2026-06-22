import { Router } from "express";
import { HasUndauntedMetagameAuth } from "../middleware/HasUndauntedMetagameAuth";
import { logger } from "../logger";

export const inventoryRouter = Router();

inventoryRouter.post("/inventory/:characterId/:changeList", HasUndauntedMetagameAuth, (req: any, res) => {
    logger.info("Inventory migration (stubbed)");

    res.status(200);
    res.json({
        code: null,
        message: ""
    })
});