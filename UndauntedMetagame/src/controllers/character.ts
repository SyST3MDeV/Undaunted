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

function ProcessTriggers(CharacterDataToUpdateWith: string){
    const CharacterData = JSON.parse(CharacterDataToUpdateWith);

    if(CharacterData.SERIE_cr19_series_1_ftue != undefined){
        const FTUESerieData = JSON.parse(CharacterData.SERIE_cr19_series_1_ftue);

        if(FTUESerieData["929A333B40E413C41E47B0A425EC3349"].Status === 3 && CharacterData["SERIE_dojo"] == undefined){
            logger.info(`Injecting SERIE_dojo!`);

            CharacterData["SERIE_dojo"] = "{\"ID\":\"Dojo\",\"Status\":0,\"62B91BD94558409B4F7352B5B96F3ED7\":{\"Status\":0,\"6CA2C43B46334BC06F73DEB5F2BFFEC1\":{\"Status\":0,\"CurrentAmount\":0,\"LastUpdateAmount\":0},\"3A7241AA43743647D3C1E39E8976E4F3\":{\"Status\":0,\"CurrentAmount\":0,\"LastUpdateAmount\":0}},\"816CBFD94D16EDA252BD1D8461209568\":{\"Status\":1},\"B152371947599B3C2D55BE9B91439C37\":{\"Status\":0,\"D3F19E2248AECEF5C5C3C8B9E2AC2C67\":{\"Status\":0,\"CurrentAmount\":0,\"LastUpdateAmount\":0},\"0407C2134FE0BEFE3EC791999632D2BC\":{\"Status\":0,\"CurrentAmount\":0,\"LastUpdateAmount\":0}},\"DFE54F884C6FC60688B6C494D79ADD29\":{\"Status\":0,\"9D1B0D754DBC896034F942AD625F9D93\":{\"Status\":0,\"CurrentAmount\":0,\"LastUpdateAmount\":0}}}";
        }
    }

    return JSON.stringify(CharacterData);
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

    CharacterDataToUpdateWith = ProcessTriggers(CharacterDataToUpdateWith);

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