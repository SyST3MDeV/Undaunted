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

export async function GetAllLoadoutsForUserIdAndCharacterId(UserId: string, CharacterId: string){
    let LoadoutDbRow = await GetDb().query.loadouts.findFirst({where: and(eq(loadouts.characterId, CharacterId), eq(loadouts.userId, UserId))});

    let Loadouts;

    if(LoadoutDbRow == undefined){
        logger.info(`Creating new loadout set for userId ${UserId} and characterId ${CharacterId}`);

        const NewLoadoutSlot = {
            weapon: {
                instance_id: "WP_EB_TRAINING",
                instance_data: DEFAULT_INSTANCE_DATA
            },
            helmet: {
                instance_id: "AR_UNEQUIPPED_HELM",
                instance_data: DEFAULT_INSTANCE_DATA
            },
            chest: {
                instance_id: "AR_BEGINNER_CHEST",
                instance_data: DEFAULT_INSTANCE_DATA
            },
            arms: {
                instance_id: "AR_BEGINNER_ARMS",
                instance_data: DEFAULT_INSTANCE_DATA
            },
            legs: {
                instance_id: "AR_BEGINNER_LEGS",
                instance_data: DEFAULT_INSTANCE_DATA
            },
            lantern: {
                instance_id: "LT_BASIC",
                instance_data: DEFAULT_INSTANCE_DATA
            },
            player_role: {
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
            persistent: {
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
            }
        };

        const NewLoadoutData = [NewLoadoutSlot];

        await GetDb().insert(loadouts).values({
            characterId: CharacterId,
            userId: UserId,
            loadouts: JSON.stringify(NewLoadoutData) 
        });

        Loadouts = NewLoadoutData;
    }
    else{
        Loadouts = JSON.parse(LoadoutDbRow.loadouts);
    }

    return Loadouts;
}