// Schéma complet livré en L1 (docs/TASKS.md, docs/DATA-MODEL.md).
// Table placeholder pour que `drizzle-kit generate` ait quelque chose à
// migrer tant que L1 n'est pas commencé.
import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const assetVersions = sqliteTable("asset_versions", {
  version: text("version").primaryKey(),
  syncedAt: text("synced_at").notNull(),
});
