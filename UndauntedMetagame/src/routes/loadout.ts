import { Router } from "express";
import { HasUndauntedMetagameAuth } from "../middleware/HasUndauntedMetagameAuth";
import { GetAllLoadoutsForUserIdAndCharacterId } from "../controllers/loadout";
import { logger } from "../logger";

export const loadoutRouter = Router();

loadoutRouter.get("/loadout/:userId/:characterId/all", HasUndauntedMetagameAuth, async (req: any, res) => {
    const RequestorAccountId = req.AuthData.IsGameserver ? req.params.userId : req.AuthData.userId;
    const CharacterId = req.params.characterId;

    const Loadouts: any[] = await GetAllLoadoutsForUserIdAndCharacterId(RequestorAccountId, CharacterId);

    logger.info(`Fetched ${Loadouts.length} loadout(s) for userId ${RequestorAccountId} and characterId ${CharacterId}`);

    res.status(200);
    res.json({
        code: null,
        message: "OK",
        payload: {
            loadouts: Loadouts,
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
            }, // TODO: Properly support persistent loadouts
            num_account_slots: 1, // TODO: Make these loadout slots add-able, support multiple loadouts
            max_account_slots: 1,
            num_character_slots: 1,
            max_character_slots: 1,
            active_index: 0, // TODO: Make this support multi-loadouts
            needs_migration: false
        }
    });
});