import { and, eq } from "drizzle-orm";
import { GetDb } from "../db";
import { loadouts } from "../db/schema";
import { logger } from "../logger";

const DEFAULT_INSTANCE_DATA = JSON.stringify({
    SheenType: 73,
    IsPrimarySheenActive: true,
    PrimaryDyeId: "None",
    IsSecondarySheenActive: true,
    SecondaryDyeId: "None",
    IsTertiarySheenActive: false,
    TertiaryDyeId: "None",
    TransmogCatalogId: "None",
    TransmogEnabled: false,
    EquippedCells: [],
    EquippedCellsv2: [],
    SubTypeMetadataArray: {
        ItemSubType: "subtype_eblade",
        EquippedItemParts: [{
            WeaponPartId: "PART_EB_SPECIAL_DEFAULT",
            SlotIndex: 0,
        }]
    }
});

const DEFAULT_PERSISTENT = {
    manual_emotes: ["", "", "", "", "", ""],
    intro_emote: "EM_INTRO_BEGINNER_01",
    banner: "BN_BEGINNER_00",
    bannerCustomization: "{\"BannerMeshItemID\":\"BNC_MESH_BEGINNER_00\",\"FabricMaterialItemID\":\"BNC_FABRIC_BEGINNER_00\",\"SigilTextureItemID\":\"BNC_SIGIL_BEGINNER_00\",\"PlantVFXItemID\":\"\",\"PersistantStandardVFXItemID\":\"\",\"AnimationItemID\":\"BNC_ANIMATION_BEGINNER_00\",\"BackgroundColourItemID\":\"DYE_BANNER_BACKGROUND_DEFAULT\",\"BorderColourItemID\":\"DYE_BANNER_SIGIL_DEFAULT\",\"SigilColourItemID\":\"DYE_BANNER_SIGIL_DEFAULT\",\"BackgroundSheenType\":0,\"BorderSheenType\":0,\"SigilSheenType\":0}",
    flare: "QI_BASIC_FLARE_DURABLE",
    title: "",
    head_accessory: "",
    back_accessory: "",
    pet: "",
    glider: "GD_FRAME_STARTER_BASE",
    update_version: 0,
    quick_chats: ["", "", "", "", "", "", "", "", ""],
    emojis: ["", "", "", "", "", "", "", "", ""],
    quick_curiosities_items: Array.from({length: 8}, (_, item_index) => ({
        item_index,
        item_id: "",
        instance_id: "",
    })),
    quickwheel: [],
};

export async function GetAllLoadoutsForUserIdAndCharacterId(UserId: string, CharacterId: string){
    let LoadoutDbRow = await GetDb().query.loadouts.findFirst({where: and(eq(loadouts.characterId, CharacterId), eq(loadouts.userId, UserId))});

    let Loadouts;

    if(LoadoutDbRow == undefined){
        logger.info(`Creating new loadout set for userId ${UserId} and characterId ${CharacterId}`);

        const NewLoadoutSlot = {
            weapon: {
                item_id: "WP_EB_TRAINING",
                instance_id: "WP_EB_TRAINING",
                instance_data: DEFAULT_INSTANCE_DATA
            },
            helmet: {
                item_id: "AR_UNEQUIPPED_HELM",
                instance_id: "AR_UNEQUIPPED_HELM",
                instance_data: DEFAULT_INSTANCE_DATA
            },
            chest: {
                item_id: "AR_BEGINNER_CHEST",
                instance_id: "AR_BEGINNER_CHEST",
                instance_data: DEFAULT_INSTANCE_DATA
            },
            arms: {
                item_id: "AR_BEGINNER_ARMS",
                instance_id: "AR_BEGINNER_ARMS",
                instance_data: DEFAULT_INSTANCE_DATA
            },
            legs: {
                item_id: "AR_BEGINNER_LEGS",
                instance_id: "AR_BEGINNER_LEGS",
                instance_data: DEFAULT_INSTANCE_DATA
            },
            lantern: {
                item_id: "LT_BASIC",
                instance_id: "LT_BASIC",
                instance_data: DEFAULT_INSTANCE_DATA
            },
            player_role: {
                item_id: "PR_DARKNESS",
                instance_id: "PR_DARKNESS",
                instance_data: DEFAULT_INSTANCE_DATA
            },
            subweapon: null,
            appearance: "{\"CreationState\":\"EArchonCharacterCreationState::NewCharacter\",\"Data\":[],\"AssetReferences\":[],\"StringData\":[]}",
            flask: "FL_HEALING_DEFAULT",
            quick_items: [],
            slot_index: 0, // TODO: Support multi-loadout
            update_version: 0,
            custom_name: "",
            persistent: DEFAULT_PERSISTENT
        };

        const NewLoadoutData = [NewLoadoutSlot];

        await GetDb().insert(loadouts).values({
            characterId: CharacterId,
            userId: UserId,
            loadouts: JSON.stringify(NewLoadoutData),
            persistent: JSON.stringify(DEFAULT_PERSISTENT)
        });

        Loadouts = NewLoadoutData;
    }
    else{
        Loadouts = JSON.parse(LoadoutDbRow.loadouts);
    }

    return Loadouts;
}

export async function GetPersistentLoadoutForUserIdAndCharacterId(UserId: string, CharacterId: string){
    // TODO: This will break if it's not called AFTER the GetAllLoadouts call as it has no create-on-nonexistent functionality

    const LoadoutDbRow = await GetDb().query.loadouts.findFirst({where: and(eq(loadouts.characterId, CharacterId), eq(loadouts.userId, UserId))});

    return JSON.parse(LoadoutDbRow!.persistent);
}

export async function SetLoadoutDataForUserIdAndCharacterId(UserId: string, CharacterId: string, Index: string, Data: string){
    // TODO: This assumes the loadout & loadout index exists. Validate this assumption.

    logger.info(`Attempting to update loadout data Index ${Index}`);

    if(Index === "0"){
        // TODO: (?) We two-db-query this as sqlite (our current db driver) dosen't support advanced JSON merging + such. If/when we ever switch to postgres which supports JSONB, this should change

        const LoadoutDbRow = await GetDb().query.loadouts.findFirst({where: and(eq(loadouts.characterId, CharacterId), eq(loadouts.userId, UserId))});

        let ParsedLoadoutData = JSON.parse(LoadoutDbRow!.loadouts);

        ParsedLoadoutData[0] = JSON.parse(Data); // Loadout index 0

        const PackedLoadoutData = JSON.stringify(ParsedLoadoutData);

        await GetDb().update(loadouts).set({
            loadouts: PackedLoadoutData
        }).where(and(eq(loadouts.characterId, CharacterId), eq(loadouts.userId, UserId)));

        return true;
    }
    else if(Index === "persistent"){
        await GetDb().update(loadouts).set({
            persistent: Data
        }).where(and(eq(loadouts.characterId, CharacterId), eq(loadouts.userId, UserId)));

        return true;
    }
    else{
        logger.error(`Unsupported Loadout Data Index ${Index}`);
        return false;
    }
}