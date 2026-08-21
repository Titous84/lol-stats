// Applique les migrations SQL générées par `npm run db:generate` sous drizzle/.
import { config } from "dotenv";
import Database from "better-sqlite3";

config({ path: ".env.local" });
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

const dbPath = process.env.DATABASE_PATH ?? "./data/lol-stats.db";
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");

const db = drizzle(sqlite);
migrate(db, { migrationsFolder: "./drizzle" });

console.log(`Migrations appliquées sur ${dbPath}.`);
sqlite.close();
