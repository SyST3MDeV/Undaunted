import { randomBytes, randomUUID } from "node:crypto";
import { GetDb } from "../db";
import { GetUserIDForAPIKey, HashUserAPIKey } from "./auth";
import { invitecodes, userapikeys, users } from "../db/schema";
import { and, eq, gt, or, sql } from "drizzle-orm";

const AUTH_MODE = process.env.AUTH_MODE;
const NODE_ENV = process.env.NODE_ENV;

export const VALID_REGISTRATION_MODES = ["NONE", "INVITECODE", "OPEN"] as const;
export type RegistrationMode = typeof VALID_REGISTRATION_MODES[number];

export let REGISTRATION_MODE = process.env.REGISTRATION_MODE!; // In memory only for now, might wanna move to DB at some point

export type UserInfo = {
    UserId: string;
    Username: string;
    IsAdmin: boolean;
}

type PlayerActivity = { // TODO: Track more stuff from the game's native telemetry here
    Map: string;
    LastUpdatedTime: number
}

type PlayerLocation = { // TODO: Track more stuff from our matchmaking telemetry here
    HuntId: string,
    EnteredTime: number
}

export type PlayerData = {
    UserId: string,
    Map: string,
    HuntId: string | undefined,
    EnteredHuntAt: number | undefined
};

let PlayerActivityMap: Map<string, PlayerActivity> = new Map<string, PlayerActivity>();
let PlayerLocationMap: Map<string, PlayerLocation> = new Map<string, PlayerLocation>();

export function IsRegistrationMode(Value: unknown): Value is RegistrationMode {
    return typeof Value === "string" && VALID_REGISTRATION_MODES.includes(Value as RegistrationMode);
}

export function SetRegistrationMode(Value: unknown){
    if(!IsRegistrationMode(Value)){
        return false;
    }

    REGISTRATION_MODE = Value;
    return true;
}

export async function GetInviteCodes(){
    return await GetDb().query.invitecodes.findMany();
}

export async function GetAllUserIds(){
    const UsersFromDb = await GetDb().query.users.findMany();

    return UsersFromDb.map((user) => ({
        Username: user.name,
        UserId: user.userId
    }));
}

export async function RegisterInviteCode(NewInviteCode: unknown, Uses: unknown, InfiniteUses: boolean){
    if(typeof NewInviteCode !== "string" || NewInviteCode.trim().length === 0){
        return false;
    }

    const ParsedUses = Number(Uses);
    if(!InfiniteUses && (!Number.isInteger(ParsedUses) || ParsedUses < 1)){
        return false;
    }

    await GetDb().insert(invitecodes).values({
        inviteCode: NewInviteCode.trim(),
        usesRemaining: InfiniteUses ? 0 : ParsedUses,
        infiniteUses: InfiniteUses
    });

    return true;
}

export async function DeleteInviteCode(InviteCodeToDelete: string){
    await GetDb().delete(invitecodes).where(eq(
        invitecodes.inviteCode, InviteCodeToDelete
    ));
}

export async function IsUserIdAdmin(UserId: string){
    const UserFromDb = await GetDb().query.users.findFirst({where: eq(users.userId, UserId)});

    return UserFromDb != undefined && UserFromDb.isAdmin;
}

export async function RegisterUser(Username: string){
    const UID = `UID-${randomUUID()}`;
    const UUK = `UUK_${randomBytes(24).toString("hex")}`;

    const UUKHash = HashUserAPIKey(UUK);

    await GetDb().insert(users).values({
        userId: UID,
        name: Username,
        notes: 0
    });

    await GetDb().insert(userapikeys).values({
        userId: UID,
        keyHash: UUKHash
    });

    return UUK;
}

export async function ValidateAndConsumeInviteCode(InviteCode: unknown){
    if(typeof InviteCode !== "string" || InviteCode.length === 0){
        return false;
    }

    const NormalizedInviteCode = InviteCode.trim();
    if(NormalizedInviteCode.length === 0){
        return false;
    }

    // Avoid TOCTOU by decrement in DB statement
    const UsableInviteCode = await GetDb().update(invitecodes).set({
        usesRemaining: sql`case when ${invitecodes.infiniteUses} then ${invitecodes.usesRemaining} else ${invitecodes.usesRemaining} - 1 end`
    }).where(and(
        eq(invitecodes.inviteCode, NormalizedInviteCode),
        or(
            eq(invitecodes.infiniteUses, true),
            gt(invitecodes.usesRemaining, 0)
        )
    )).returning({
        inviteCode: invitecodes.inviteCode
    });

    return UsableInviteCode.length === 1;
}

export async function UpdatePlayerActivity(UserId: string, Map: string){
    PlayerActivityMap.set(UserId, {
        Map: Map,
        LastUpdatedTime: Date.now()
    });
}

export async function UpdatePlayerLocation(UserId: string, HuntId: string){
    PlayerLocationMap.set(UserId, {
        HuntId: HuntId,
        EnteredTime: Date.now()
    });
}

export async function GetRecentPlayerData(){
    let PlayerDataToReturn: PlayerData[] = [];

    PlayerActivityMap.forEach((value, key, map) => {
        if(Date.now() - value.LastUpdatedTime <= 90 * 1000){ // If entry is < 90s old
            const PlayerLocationData: PlayerLocation | undefined = PlayerLocationMap.get(key);

            PlayerDataToReturn.push({
                UserId: key,
                Map: value.Map,
                HuntId: PlayerLocationData?.HuntId,
                EnteredHuntAt: PlayerLocationData?.EnteredTime
            });
        }
    });

    return PlayerDataToReturn;
}

export async function GetUserInfoForApiKey(UserApiKey: string): Promise<UserInfo | undefined>{
    let UserId;
    if(AUTH_MODE === "NONE" && NODE_ENV !== "production"){
        UserId = UserApiKey;
    }
    else if(AUTH_MODE === "APIKEY"){
        UserId = await GetUserIDForAPIKey(UserApiKey);
    }
    else{
        throw new Error("Unsupported Auth Mode!");
    }

    if(UserId == undefined){
        return undefined;
    }

    const UserFromDb = await GetDb().query.users.findFirst({where: eq(users.userId, UserId)});
    if(UserFromDb == undefined){
        return undefined;
    }

    return {
        UserId: UserId,
        Username: UserFromDb.name,
        IsAdmin: UserFromDb.isAdmin
    };
}
