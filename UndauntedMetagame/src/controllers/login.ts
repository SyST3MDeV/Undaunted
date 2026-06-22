import { eq } from "drizzle-orm";
import { GetDb } from "../db";
import { users } from "../db/schema";

export async function GetUsernameForUserId(userId: string){
    let UserFromDb = await GetDb().query.users.findFirst({where: eq(users.userId, userId)});

    return UserFromDb!.name;
}