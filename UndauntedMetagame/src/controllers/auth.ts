import jwt, {JwtPayload} from "jsonwebtoken";

const PRIVKEY = Buffer.from(process.env.AUTH_SIGNING_PRIVKEY_B64!, "base64").toString("utf-8");
const PUBKEY = Buffer.from(process.env.AUTH_SIGNING_PUBKEY_B64!, "base64").toString("utf-8");

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