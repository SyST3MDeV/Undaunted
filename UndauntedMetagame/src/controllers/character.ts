import { and, eq } from "drizzle-orm";
import { GetDb } from "../db";
import { characters } from "../db/schema";

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

    let InnerFormattedCurrentDate = [
        CurrentDate.getFullYear(),
        Pad(CurrentDate.getMonth() + 1),
        Pad(CurrentDate.getDate()),
    ].join(".") + "-" + [
        Pad(CurrentDate.getHours()),
        Pad(CurrentDate.getMinutes()),
        Pad(CurrentDate.getSeconds()),
    ].join(".");

    let RecentPlayers = JSON.stringify({
       RecentPlayers: [],
       Version: 0 
    });
    
    let AppearanceData = JSON.stringify({
        CreationState: "EArchonCharacterCreationState::NewCharacter",
        Data: [],
        AssetReferences: [],
        StringData: []
    });

    let PlayerDataRepair = JSON.stringify({
        Data: []
    });

    let CharacterFlagData = JSON.stringify({
        Flags: []
    });

    let CharacterData = JSON.stringify({
        RecentPlayers: RecentPlayers,
        AppearanceData: AppearanceData,
        PlayerAccountProgressStep: "New",
        PlayerDataRepair: PlayerDataRepair,
        CharacterFlagData: CharacterFlagData,
        LastChangelist: TARGET_CHANGELIST,
        LoginTime: InnerFormattedCurrentDate,
        LastLoginTime: InnerFormattedCurrentDate
    });

    let NewCharacter = await GetDb().insert(characters).values({
        characterId: CharacterUUID,
        userId: userId,
        name: characterName,
        createdDate: FormattedCurrentDate,
        lastModifiedDate: FormattedCurrentDate,
        updateVersion: 0,
        data: CharacterData
    }).returning();

    return TransformDbCharacterToWireCharacter(NewCharacter[0]);
}

export async function UpdateCharacterForUid(CharacterId: string, UserId: string, CharacterDataToUpdateWith: string, UpdateVersion: number){
    await GetDb().update(characters).set({
        data: CharacterDataToUpdateWith,
        updateVersion: UpdateVersion
    }).where(and(eq(characters.userId, UserId), eq(characters.characterId, CharacterId)));
}

export async function GetCharacterWithUid(CharacterId: string, UserId: string){
    const Character = await GetDb().query.characters.findFirst({where: and(eq(characters.characterId, CharacterId), eq(characters.userId, UserId))});

    if(Character == undefined){
        return undefined;
    }

    return TransformDbCharacterToWireCharacter(Character);
}