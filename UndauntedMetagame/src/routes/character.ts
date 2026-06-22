import { Router } from "express";
import { logger } from "../logger";
import { HasUndauntedMetagameAuth } from "../middleware/HasUndauntedMetagameAuth";
import { CreateCharacterForUid, GetCharactersForUid } from "../controllers/character";

export const characterRouter = Router();

characterRouter.get("/character", HasUndauntedMetagameAuth, async (req: any, res) => {
    let CharactersForUid = await GetCharactersForUid(req.AuthData.userId);

    logger.info(`Retrieved ${CharactersForUid.length} characters for ${req.AuthData.userId}`);

    res.status(200);
    res.json(CharactersForUid);
});

characterRouter.put("/character", HasUndauntedMetagameAuth, async (req: any, res) => {
    let CharacterNameToCreate = req.body.name;

    logger.info(`Creating a character named ${CharacterNameToCreate} for user ${req.AuthData.userId}`);

    let NewCharacter = await CreateCharacterForUid(req.AuthData.userId, CharacterNameToCreate);

    res.status(200);
    res.json(NewCharacter);
})