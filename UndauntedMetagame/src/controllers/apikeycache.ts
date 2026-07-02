import crypto from "crypto";
import { logger } from "../logger";

type KeyRow = { keyHash?: string | null }
type APIKeyLookup<T> = {
    find: (apiKey: string) => Promise<T | undefined>,
    has: (apiKey: string) => Promise<boolean>,
    refresh: () => Promise<void>
}

export function HashAPIKey(apiKeyToHash: string){
    return crypto.createHash("sha256").update(apiKeyToHash, "utf8").digest("hex");
}

function normalizeHash(cacheName: string, keyHash: string){
    const hash = Buffer.from(keyHash, "hex");

    if(hash.length !== 32){
        logger.warn(`Ignoring invalid ${cacheName} API Key hash with ${hash.length} bytes`);
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
    const keys = cached(async () => {
        const fresh = new Map<string, TValue>();

        for(const row of await loadRows()){
            const hash = row.keyHash == null ? undefined : normalizeHash(cacheName, row.keyHash);

            if(hash !== undefined){
                fresh.set(hash, select(row));
            }
        }

        return fresh;
    });

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
