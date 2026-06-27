import { and, eq } from "drizzle-orm";
import { GetDb } from "../db";
import { breadcrumbs } from "../db/schema";
import { logger } from "../logger";

export async function GetBreadcrumbsForCharacterIdAndUserId(userId: string, characterId: string){
    const BreadcrumbsFromDB = await GetDb().query.breadcrumbs.findFirst({where: and(eq(breadcrumbs.userId, userId), eq(breadcrumbs.characterId, characterId))});

    if(BreadcrumbsFromDB == undefined){
        logger.info(`Creating new breadcrumbs entry for character ${characterId}`);

        // TODO: Validate userId/characterId match

        await GetDb().insert(breadcrumbs).values({
            breadcrumbs: "[]",
            updateVersion: 0,
            userId: userId,
            characterId: characterId
        });

        return {
            breadcrumbs: [],
            updateVersion: 0
        };
    }

    return {
        breadcrumbs: JSON.parse(BreadcrumbsFromDB.breadcrumbs),
        updateVersion: BreadcrumbsFromDB.updateVersion
    };
}

export async function SetBreadcrumbsForCharacterIdAndUserId(userId: string, characterId: string, breadcrumbsFromUser: any, updateVersion: number){
    const BreadcrumbsFromDB = await GetDb().query.breadcrumbs.findFirst({where: and(eq(breadcrumbs.userId, userId), eq(breadcrumbs.characterId, characterId))});

    if(BreadcrumbsFromDB == undefined){
        logger.info(`Creating new breadcrumbs entry for character ${characterId}`);

        // TODO: Validate userId/characterId match

        await GetDb().insert(breadcrumbs).values({
            breadcrumbs: JSON.stringify(breadcrumbsFromUser),
            updateVersion: updateVersion,
            userId: userId,
            characterId: characterId
        });
    }
    else{
        logger.info(`Updating breadcrumbs entry for character ${characterId} with updateVersion ${updateVersion}`);

        await GetDb().update(breadcrumbs).set({
            breadcrumbs: JSON.stringify(breadcrumbsFromUser),
            updateVersion: updateVersion
        }).where(and(eq(breadcrumbs.userId, userId), eq(breadcrumbs.characterId, characterId)));
    }

    return {
        breadcrumbs: breadcrumbsFromUser,
        updateVersion: updateVersion
    };
}