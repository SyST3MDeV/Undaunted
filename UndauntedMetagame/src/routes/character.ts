import { Router } from "express";
import { logger } from "../logger";
import { HasUndauntedMetagameAuth } from "../middleware/HasUndauntedMetagameAuth";
import { CreateCharacterForUid, GetCharactersForUid, GetCharacterWithUid, UpdateCharacterForUid } from "../controllers/character";
import express from "express";

export const characterRouter = Router();

characterRouter.get("/character", HasUndauntedMetagameAuth, async (req: any, res) => {
    const UserId = req.AuthData.userId;

    const CharactersForUid = await GetCharactersForUid(UserId);

    logger.info(`Retrieved ${CharactersForUid.length} characters for ${UserId}`);

    res.status(200);
    res.json(CharactersForUid);
});

characterRouter.put("/character", HasUndauntedMetagameAuth, async (req: any, res) => {
    const CharacterNameToCreate = req.body.name;

    logger.info(`Creating a character named ${CharacterNameToCreate} for user ${req.AuthData.userId}`);

    let NewCharacter = await CreateCharacterForUid(req.AuthData.userId, CharacterNameToCreate);

    res.status(200);
    res.json(NewCharacter);
})

characterRouter.post("/character", HasUndauntedMetagameAuth, async (req: any, res) => {
    const CharacterIdToUpdate = req.body.characterId;
    const UserId = req.AuthData.userId;
    const DataToUpdateWith = req.body.data;
    const UpdateVersion = req.body.updateVersion;

    logger.info(`Updating characterId ${CharacterIdToUpdate} for userId ${UserId} with updateVersion ${UpdateVersion}`);

    const DidSucceed = await UpdateCharacterForUid(CharacterIdToUpdate, UserId, DataToUpdateWith, UpdateVersion);

    if(!DidSucceed){
        logger.warn(`Failed to update characterId ${CharacterIdToUpdate} for userId ${UserId} due to conflict`);

        res.status(409);
        res.send();
        return;
    }

    const UpdatedCharacter = await GetCharacterWithUid(CharacterIdToUpdate, UserId);

    res.status(200);
    res.json(UpdatedCharacter);
});