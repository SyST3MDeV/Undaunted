import jwt, {JwtPayload} from "jsonwebtoken";
import crypto from "crypto";
import { GetDb } from "../db";
import { userapikeys, userapikeystoregister } from "../db/schema";
import { logger } from "../logger";

const PRIVKEY = Buffer.from(process.env.AUTH_SIGNING_PRIVKEY_B64!, "base64").toString("utf-8");
const PUBKEY = Buffer.from(process.env.AUTH_SIGNING_PUBKEY_B64!, "base64").toString("utf-8");

function HashUserAPIKey(UserAPIKeyToHash: string){
    return crypto.createHash("sha256").update(UserAPIKeyToHash, "utf8").digest("hex");
}

export async function DrainAndRegisterUserAPIKeys(){
    const APIKeysToRegister = await GetDb().query.userapikeystoregister.findMany();

    await GetDb().delete(userapikeystoregister);

    for(const APIKey of APIKeysToRegister){
        await GetDb().insert(userapikeys).values({
            userId: APIKey.userId,
            keyHash: HashUserAPIKey(APIKey.key)
        });
    }

    logger.info(`Registered ${APIKeysToRegister.length} new User API Key(s) on boot!`);
}

export async function GetUserIDForAPIKey(UserAPIKey: string){
    const AllAPIKeyHashes = await GetDb().query.userapikeys.findMany();

    const IncomingUserAPIKeyHashBuffer = Buffer.from(HashUserAPIKey(UserAPIKey), "hex");

    let UserId: string | undefined = undefined;

    for(const CmpAPIKeyHash of AllAPIKeyHashes){
        const CmpAPIKeyHashBuffer = Buffer.from(CmpAPIKeyHash.keyHash!, "hex");

        if(CmpAPIKeyHashBuffer.length !== IncomingUserAPIKeyHashBuffer.length){
            continue;
        }

        if(crypto.timingSafeEqual(IncomingUserAPIKeyHashBuffer, CmpAPIKeyHashBuffer)){
            UserId = CmpAPIKeyHash.userId;
        }
    }

    return UserId;
}

function SignMetagameJWTForUid(userId: string){
    return jwt.sign({
        userId: userId
    }, PRIVKEY, {
        algorithm: "RS256",
        expiresIn: "24h",
        issuer: "undaunted-metagame",
        audience: "undaunted-metagame"
    });
}

function ValidateMetagameJWTAndGetPayload(token: string){
    return jwt.verify(token, PUBKEY, {
        algorithms: ["RS256"],
        issuer: "undaunted-metagame",
        audience: "undaunted-metagame"
    });
}

export { SignMetagameJWTForUid, ValidateMetagameJWTAndGetPayload }