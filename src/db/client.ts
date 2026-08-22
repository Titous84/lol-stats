// Connexion SQLite partagée — collecteur et serveur passent tous deux par
// ici (docs/ARCHITECTURE.md § 1). WAL : le collecteur écrit pendant que le
// site lit.
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

export type LolStatsDb = ReturnType<typeof drizzle<typeof schema>>;
/** Le callback de `db.transaction()` reçoit ce type — même surface d'API que
 *  `LolStatsDb`, sans le champ `$client`. Les écritures qui doivent pouvoir
 *  tourner aussi bien en dehors qu'à l'intérieur d'une transaction (ex.
 *  `upsertPlayer`) acceptent l'union des deux. */
export type LolStatsTx = Parameters<Parameters<LolStatsDb["transaction"]>[0]>[0];

export function openDb(dbPath: string): { sqlite: Database.Database; db: LolStatsDb } {
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("synchronous = NORMAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  return { sqlite, db };
}
