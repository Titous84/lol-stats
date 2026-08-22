// Découverte incrémentale par file — docs/ARCHITECTURE.md § 3, étape 2.
import type { LolStatsDb } from "@/db/client";
import type { RiotClient } from "@/lib/riot/client";
import { filterUnknownMatchIds } from "./db-helpers";

const PAGE_SIZE = 100;
// Marge de sécurité : une partie longue peut se terminer après le curseur.
const CURSOR_SAFETY_MARGIN_MS = 6 * 60 * 60 * 1_000;

/**
 * Pagine `match/ids` (le plus récent d'abord) jusqu'à épuisement ou jusqu'à
 * ne plus voir de match inconnu, puis renvoie les IDs inconnus en ordre
 * chronologique **croissant** — pour que la récupération qui suit reste
 * reprenable (docs/ARCHITECTURE.md § 3, étapes 2-3).
 */
export async function discoverUnknownMatchIds(
  client: RiotClient,
  db: LolStatsDb,
  puuid: string,
  queueId: number,
  lastMatchEndMs: number | null,
  maxCount = Infinity,
): Promise<string[]> {
  const startTimeS =
    lastMatchEndMs != null ? Math.floor((lastMatchEndMs - CURSOR_SAFETY_MARGIN_MS) / 1_000) : 0;

  const discoveredNewestFirst: string[] = [];
  let start = 0;

  for (;;) {
    const ids = await client.getMatchIdsByPuuid(puuid, queueId, startTimeS, start, PAGE_SIZE);
    if (ids.length === 0) break;

    // Aucun match déjà en base ne repart en fetch — vérifié en une requête SQL.
    const unknown = filterUnknownMatchIds(db, ids);
    discoveredNewestFirst.push(...unknown);

    const exhausted = ids.length < PAGE_SIZE;
    const caughtUp = lastMatchEndMs != null && unknown.length === 0;
    if (exhausted || caughtUp || discoveredNewestFirst.length >= maxCount) break;

    start += PAGE_SIZE;
  }

  const chronological = discoveredNewestFirst.reverse();
  return Number.isFinite(maxCount) ? chronological.slice(0, maxCount) : chronological;
}
