import { and, eq } from "drizzle-orm";
import { GetDb } from "../db";
import { breadcrumbs, encounteredcontent } from "../db/schema";
import { logger } from "../logger";

export async function QueryEncounteredContent(userId: string, characterId: string, categoriesToQuery: number[]){
    logger.info(`Querying ${categoriesToQuery.length} categories for userId ${userId} and characterId ${characterId}`);

    const EncounteredContentFromDB = await GetDb().query.encounteredcontent.findFirst({where: and(eq(encounteredcontent.userId, userId), eq(encounteredcontent.characterId, characterId))});

    // TODO: This can be one pass not two, and much less ugly

    let ToReturnRaw: any[] = [];

    if(EncounteredContentFromDB != undefined){
        const EncounteredContent = JSON.parse(EncounteredContentFromDB!.encounteredcontent);

        for(let Content of EncounteredContent){
            if(categoriesToQuery.includes(Content.category)){
                ToReturnRaw.push(Content);
            }
        }
    }

    let ToReturn: any[] = [];

    for(let i = 0; i < 8; i++){
        if(categoriesToQuery.includes(i)){
            const Content = [];

            for(let CmpContent of ToReturnRaw){
                if(CmpContent.category === i){
                    Content.push(CmpContent.content);
                }
            }

            ToReturn.push({
                content: Content,
                content_type: i
            });
        }
    }

    return ToReturn;
}

export async function AddEncounteredContent(userId: string, characterId: string, contentType: number, contentId: string){
    const EncounteredContentFromDB = await GetDb().query.encounteredcontent.findFirst({where: and(eq(encounteredcontent.userId, userId), eq(encounteredcontent.characterId, characterId))});

    if(EncounteredContentFromDB == undefined){
        await GetDb().insert(encounteredcontent).values({userId: userId, characterId: characterId, encounteredcontent: "[]"});
    }

    let ParsedEncounteredContent = EncounteredContentFromDB != undefined ? JSON.parse(EncounteredContentFromDB!.encounteredcontent) : [];

    ParsedEncounteredContent.push({
        content: contentId,
        category: contentType
    });

    await GetDb().update(encounteredcontent).set({
        encounteredcontent: JSON.stringify(ParsedEncounteredContent),
    }).where(and(eq(encounteredcontent.userId, userId), eq(encounteredcontent.characterId, characterId)));
}

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