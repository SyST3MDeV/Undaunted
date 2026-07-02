import jwt, {JwtPayload} from "jsonwebtoken";
import { GetDb } from "../db";
import { userapikeys, userapikeystoregister } from "../db/schema";
import { logger } from "../logger";
import { CreateAPIKeyCache, HashAPIKey } from "./apikeycache";

const PRIVKEY = Buffer.from(process.env.AUTH_SIGNING_PRIVKEY_B64!, "base64").toString("utf-8");
const PUBKEY = Buffer.from(process.env.AUTH_SIGNING_PUBKEY_B64!, "base64").toString("utf-8");

const UserKeys = CreateAPIKeyCache("User", () =>
    GetDb().query.userapikeys.findMany({
        columns: {
            keyHash: true,
            userId: true
        }
    }),
    (Row) => Row.userId
);

export async function DrainAndRegisterUserAPIKeys(){
    const RegisteredAPIKeyCount = GetDb().transaction((tx) => {
        const KeysToRegister = tx.query.userapikeystoregister.findMany({
            columns: {
                userId: true,
                key: true
            }
        }).sync();

        if(KeysToRegister.length > 0){
            tx.insert(userapikeys).values(KeysToRegister.map((APIKey) => ({
                userId: APIKey.userId,
                keyHash: HashAPIKey(APIKey.key)
            }))).run();

            tx.delete(userapikeystoregister).run();
        }

        return KeysToRegister.length;
    });

    await UserKeys.refresh();

    logger.info(`Registered ${RegisteredAPIKeyCount} new User API Key(s) on boot!`);
}

export async function GetUserIDForAPIKey(UserAPIKey: string){
    return UserKeys.find(UserAPIKey);
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
