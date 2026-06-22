import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator"
import * as schema from "./db/schema"

 const db = drizzle(process.env.DB_FILENAME!, {schema});

let didMigration = false;

export function GetDb(){
    if(!didMigration){
        didMigration = true;

        migrate(db, {migrationsFolder: "./src/drizzle"});
    }

    return db;
}