import { and, eq, lt } from "drizzle-orm";
import { GetDb } from "../db";
import { characters } from "../db/schema";
import { GetUsernameForUserId } from "./login";
import { logger } from "../logger";

const TARGET_CHANGELIST = process.env.TARGET_CHANGELIST;

function TransformDbCharacterToWireCharacter(DbCharacter: any){
    return {
        accountId: DbCharacter.userId,
        createdDate: DbCharacter.createdDate,
        data: DbCharacter.data,
        id: DbCharacter.characterId,
        lastModifiedDate: DbCharacter.lastModifiedDate,
        name: DbCharacter.name,
        updateVersion: DbCharacter.updateVersion
    };
}

export async function GetCharactersForUid(userId: string){
    let CharactersFromDb = await GetDb().query.characters.findMany({where: eq(characters.userId, userId)});

    if(CharactersFromDb.length === 0){
        const Username = await GetUsernameForUserId(userId);

        await CreateCharacterForUid(userId, Username);

        CharactersFromDb = await GetDb().query.characters.findMany({where: eq(characters.userId, userId)});
    }

    return CharactersFromDb.map((DbCharacter) => TransformDbCharacterToWireCharacter(DbCharacter));
}

function Pad(Target: number){
    return String(Target).padStart(2, "0");
}

export async function CreateCharacterForUid(userId: string, characterName: string){
    let CharacterUUID = crypto.randomUUID();

    let CurrentDate = new Date();

    let FormattedCurrentDate = CurrentDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
    });

    let NewCharacter = await GetDb().insert(characters).values({
        characterId: CharacterUUID,
        userId: userId,
        name: characterName,
        createdDate: FormattedCurrentDate,
        lastModifiedDate: FormattedCurrentDate,
        updateVersion: 0,
        data: "{}"
    }).returning();

    return TransformDbCharacterToWireCharacter(NewCharacter[0]);
}

export async function UpdateCharacterForUid(CharacterId: string, UserId: string, CharacterDataToUpdateWith: string, UpdateVersion: number){
    const CurrentData = await GetCharacterWithUid(CharacterId, UserId);

    if(CurrentData!.updateVersion >= UpdateVersion){
        return false;
    }

    await GetDb().update(characters).set({
        data: CharacterDataToUpdateWith,
        updateVersion: UpdateVersion
    }).where(and(and(eq(characters.userId, UserId), eq(characters.characterId, CharacterId)), lt(characters.updateVersion, UpdateVersion)));

    return true;
}

export async function GetCharacterWithUid(CharacterId: string, UserId: string){
    const Character = await GetDb().query.characters.findFirst({where: and(eq(characters.characterId, CharacterId), eq(characters.userId, UserId))});

    if(Character == undefined){
        return undefined;
    }

    return TransformDbCharacterToWireCharacter(Character);
}