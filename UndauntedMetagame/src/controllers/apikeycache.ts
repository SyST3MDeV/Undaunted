import crypto from "crypto";
import { logger } from "../logger";

type KeyRow = { keyHash: string | null }
type APIKeyLookup<T> = {
    find: (apiKey: string) => Promise<T | undefined>,
    has: (apiKey: string) => Promise<boolean>,
    refresh: () => Promise<void>
}

export function HashAPIKey(apiKeyToHash: string){
    return crypto.createHash("sha256").update(apiKeyToHash, "utf8").digest("hex");
}

function normalizeHash(cacheName: string, keyHash: string | null){
    if(keyHash === null){
        return undefined;
    }

    const hashBytes = Buffer.from(keyHash, "hex").length;

    if(hashBytes !== 32){
        logger.warn(`Ignoring invalid ${cacheName} API Key hash with ${hashBytes} bytes`);
        return undefined;
    }

    return keyHash.toLowerCase();
}

function cached<T>(loadFresh: () => Promise<T>){
    let cache: Promise<T> | undefined = undefined;

    function load(){
        const fresh = loadFresh().catch((error) => {
            if(cache === fresh){
                cache = undefined;
            }

            throw error;
        });

        return fresh;
    }

    return {
        get: () => cache ??= load(),
        refresh: () => cache = load()
    };
}

export function CreateAPIKeyCache<TRow extends KeyRow, TValue = boolean>(
    cacheName: string,
    loadRows: () => Promise<TRow[]>,
    select: (row: TRow) => TValue = () => true as TValue
): APIKeyLookup<TValue> {
    const keys = cached(async () => new Map(
        (await loadRows()).flatMap((row): [string, TValue][] => {
            const hash = normalizeHash(cacheName, row.keyHash);
            return hash === undefined ? [] : [[hash, select(row)]];
        })
    ));

    return {
        async find(apiKey: string){
            return (await keys.get()).get(HashAPIKey(apiKey));
        },
        async has(apiKey: string){
            return (await keys.get()).has(HashAPIKey(apiKey));
        },
        async refresh(){
            await keys.refresh();
        }
    };
}
