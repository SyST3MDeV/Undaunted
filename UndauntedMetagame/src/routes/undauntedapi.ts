import { Router } from "express";
import { DeleteInviteCode, GetAllUserIds, GetInviteCodes, GetRecentPlayerData, IsRegistrationMode, RegisterInviteCode, RegisterUser, REGISTRATION_MODE, SetRegistrationMode, ValidateAndConsumeInviteCode } from "../controllers/undauntedapi";
import { HasUndauntedUserApiKey } from "../middleware/HasUndauntedUserApiKey";
import { HasUndauntedAdminApiKey } from "../middleware/HasUndauntedAdminApiKey";
import { SignMetagameJWTForUid } from "../controllers/auth";

export const undauntedApiRouter = Router();

undauntedApiRouter.get("/RegistrationStatus", (req, res) => {
    res.status(200);
    res.json({
        RegistrationMode: REGISTRATION_MODE
    });
});

undauntedApiRouter.post("/RegistrationStatus", HasUndauntedAdminApiKey, (req, res) => {
    const NewRegistrationStatus = req.body.RegistrationStatus;

    if(!SetRegistrationMode(NewRegistrationStatus)){
        res.status(400);
        res.send();
        return;
    }

    res.status(200);
    res.send();
});

undauntedApiRouter.get("/InviteCodes", HasUndauntedAdminApiKey, async (req, res) => {
    const InviteCodes = await GetInviteCodes();

    res.status(200);
    res.json({
        InviteCodes: InviteCodes
    });
});

undauntedApiRouter.post("/GenerateJWTForUserId", HasUndauntedAdminApiKey, async (req, res) => {
    const UserId = req.body.UserId;

    const JWT = await SignMetagameJWTForUid(UserId);

    res.status(200);
    res.send({
        JWT: JWT
    });
});

undauntedApiRouter.get("/GetAllUsers", HasUndauntedAdminApiKey, async (req, res) => {
    const AllUsers = await GetAllUserIds();

    res.status(200);
    res.send({
        Users: AllUsers
    });
})

undauntedApiRouter.post("/RegisterInviteCode", HasUndauntedAdminApiKey, async (req, res) => {    
    const NewInviteCode = req.body.NewInviteCode;
    const Uses = req.body.Uses;
    const InfiniteUses = !!req.body.InfiniteUses;

    if(!await RegisterInviteCode(NewInviteCode, Uses, InfiniteUses)){
        res.status(400);
        res.send();
        return;
    }

    res.status(200);
    res.send();
});

undauntedApiRouter.delete("/InviteCode/:inviteCodeToDelete", HasUndauntedAdminApiKey, async (req, res) => {
    const InviteCodeToDelete = req.params.inviteCodeToDelete as string;

    await DeleteInviteCode(InviteCodeToDelete);

    res.status(200);
    res.send();
});

undauntedApiRouter.post("/Register", async (req, res) => {
    if(!IsRegistrationMode(REGISTRATION_MODE)){
        res.status(500);
        res.send();
        return;
    }

    if(REGISTRATION_MODE === "NONE"){
        res.status(400);
        res.send();
        return;
    }

    const Username = req.body.Username;
    if(typeof Username !== "string" || Username.trim().length === 0){
        res.status(400);
        res.send();
        return;
    }

    if(REGISTRATION_MODE === "INVITECODE"){
        const InviteCode = req.body.InviteCode;

        if(await ValidateAndConsumeInviteCode(InviteCode)){
            const UUK = await RegisterUser(Username);

            res.status(200);
            res.json({
                UUK: UUK
            });
        }
        else{
            res.status(401);
            res.send();
        }
    }
    else if(REGISTRATION_MODE === "OPEN"){
        const UUK = await RegisterUser(Username);

        res.status(200);
        res.json({
            UUK: UUK
        });
    }
});

undauntedApiRouter.get("/GetUserInfo", HasUndauntedUserApiKey, async (req: any, res) => {
    res.status(200);
    res.json(req.UndauntedUserInfo);
});


undauntedApiRouter.get("/PrivateOnlineStats", HasUndauntedAdminApiKey, async (req, res) => {
    const PlayerData = await GetRecentPlayerData();

    res.status(200);
    res.json(PlayerData);
});

undauntedApiRouter.get("/PublicOnlineStats", HasUndauntedUserApiKey, async (req, res) => {
    const PlayerData = await GetRecentPlayerData();

    res.status(200);
    res.json({
        NumActivePlayers: PlayerData.length
    });
});
