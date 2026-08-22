// Orchestration d'un run — docs/ARCHITECTURE.md § 3.
// Pré-vol → découverte → récupération chronologique → snapshot de rang →
// curseur → journal. Chaque étape est décrite là où elle est implémentée.
import type { LolStatsDb } from "@/db/client";
import type { RiotClient } from "@/lib/riot/client";
import {
  ExpiredApiKeyError,
  NotFoundError,
  RateLimitExhaustedError,
  RiotServerError,
  UnexpectedShapeError,
} from "@/lib/riot/errors";
import type { RiotRateLimiter } from "@/lib/riot/limiter";
import { normalizeMatch, normalizeParticipants, normalizeTeams } from "@/lib/riot/normalize";
import { discoverUnknownMatchIds } from "./discover";
import {
  type FinishRunPatch,
  finishRun,
  getCursor,
  insertRankSnapshot,
  isPermanentlyFailed,
  recordFailure,
  startRun,
  updateCursorFromDb,
  upsertPlayer,
  writeMatchTransaction,
} from "./db-helpers";

const TRACKED_QUEUE_TYPES = new Set(["RANKED_SOLO_5x5", "RANKED_FLEX_SR"]);

export interface RunIngestDeps {
  db: LolStatsDb;
  client: RiotClient;
  limiter: RiotRateLimiter;
  /** Objet mutable partagé avec le RiotClient (voir scripts/ingest.ts) — le
   *  décompte d'appels vit là où la requête HTTP est vraiment envoyée. */
  apiCallCounter: { count: number };
  config: { gameName: string; tagLine: string; platform: string; queues: number[] };
}

export interface RunIngestOptions {
  /** Plafond du nombre de matchs récupérés sur ce run, tous les files
   *  confondues — réservé aux runs de test. `undefined` = illimité. */
  maxMatches?: number;
}

export interface RunIngestSummary {
  status: "success" | "partial";
  matchesDiscovered: number;
  matchesWritten: number;
  matchesFailed: number;
  apiCallCount: number;
  rateLimitWaitMs: number;
  rankSnapshotsWritten: number;
}

export async function runIngest(
  deps: RunIngestDeps,
  options: RunIngestOptions = {},
): Promise<RunIngestSummary> {
  const { db, client, limiter, apiCallCounter, config } = deps;
  const startedAtIso = new Date().toISOString();
  const runId = startRun(db, startedAtIso);

  let matchesDiscovered = 0;
  let matchesWritten = 0;
  let matchesFailed = 0;
  let rankSnapshotsWritten = 0;
  let remainingBudget = options.maxMatches ?? Infinity;

  const finish = (
    status: FinishRunPatch["status"],
    errorKind?: string,
    errorMessage?: string,
  ): void => {
    finishRun(db, runId, {
      finishedAt: new Date().toISOString(),
      status,
      matchesDiscoveredCount: matchesDiscovered,
      matchesWrittenCount: matchesWritten,
      apiCallCount: apiCallCounter.count,
      rateLimitWaitMs: Math.round(limiter.totalWaitMs),
      errorKind: errorKind ?? null,
      errorMessage: errorMessage ?? null,
    });
  };

  try {
    // 1. PRÉ-VOL — 403 ici est fatal et non réessayé (docs/ARCHITECTURE.md § 3).
    const account = await client.getAccountByRiotId(config.gameName, config.tagLine);
    const selfPuuid = account.puuid;
    const preflightNowMs = Date.now();
    upsertPlayer(
      db,
      {
        puuid: selfPuuid,
        gameName: account.gameName ?? config.gameName,
        tagLine: account.tagLine ?? config.tagLine,
        platformId: config.platform,
        isSelf: true,
      },
      preflightNowMs,
      new Date(preflightNowMs).toISOString(),
    );

    // 2-3. DÉCOUVERTE puis RÉCUPÉRATION, file par file (420 puis 440).
    for (const queueId of config.queues) {
      if (remainingBudget <= 0) break;

      const cursor = getCursor(db, selfPuuid, queueId);
      const unknownIds = await discoverUnknownMatchIds(
        client,
        db,
        selfPuuid,
        queueId,
        cursor?.lastMatchEndMs ?? null,
        remainingBudget,
      );
      matchesDiscovered += unknownIds.length;

      for (const matchId of unknownIds) {
        if (remainingBudget <= 0) break;
        // Un 404 définitif n'est jamais redemandé.
        if (isPermanentlyFailed(db, matchId)) continue;

        try {
          const { dto, raw } = await client.getMatchById(matchId);
          const nowMs = Date.now();
          const nowIso = new Date(nowMs).toISOString();
          writeMatchTransaction(db, {
            match: normalizeMatch(dto, nowIso),
            teams: normalizeTeams(dto),
            participants: normalizeParticipants(dto),
            rawJson: raw,
            selfPuuid,
            nowMs,
            nowIso,
          });
          matchesWritten++;
          remainingBudget--;
        } catch (err) {
          const nowIso = new Date().toISOString();
          if (err instanceof NotFoundError) {
            recordFailure(db, matchId, "http_404", err.message, nowIso);
          } else if (err instanceof UnexpectedShapeError) {
            recordFailure(db, matchId, "parse_error", err.message, nowIso);
          } else if (err instanceof RiotServerError) {
            recordFailure(db, matchId, "http_5xx", err.message, nowIso);
          } else if (err instanceof RateLimitExhaustedError) {
            // "Abandon du seul match concerné — le run continue"
            // (docs/ARCHITECTURE.md § 4).
            recordFailure(db, matchId, "rate_limited", err.message, nowIso);
          } else {
            // ExpiredApiKeyError et toute erreur non prévue : fatal pour le run.
            throw err;
          }
          matchesFailed++;
          continue;
        }
      }

      updateCursorFromDb(db, selfPuuid, queueId, new Date().toISOString());
    }

    // 4. SNAPSHOT DE RANG — obligatoire à chaque run, pas une option.
    const entries = await client.getLeagueEntriesByPuuid(selfPuuid);
    const capturedMs = Date.now();
    const capturedAt = new Date(capturedMs).toISOString();
    for (const entry of entries) {
      if (!TRACKED_QUEUE_TYPES.has(entry.queueType)) continue;
      insertRankSnapshot(db, {
        puuid: selfPuuid,
        queueType: entry.queueType,
        tier: entry.tier,
        rank: entry.rank,
        leaguePoints: entry.leaguePoints,
        wins: entry.wins,
        losses: entry.losses,
        hotStreak: entry.hotStreak,
        capturedAt,
        capturedMs,
      });
      rankSnapshotsWritten++;
    }

    // 5. CURSEUR & JOURNAL — le curseur est déjà à jour (mis à jour par file
    //    ci-dessus, depuis l'état réel de la base). Reste le journal.
    const status: RunIngestSummary["status"] = matchesFailed > 0 ? "partial" : "success";
    finish(status);
    return {
      status,
      matchesDiscovered,
      matchesWritten,
      matchesFailed,
      apiCallCount: apiCallCounter.count,
      rateLimitWaitMs: Math.round(limiter.totalWaitMs),
      rankSnapshotsWritten,
    };
  } catch (err) {
    if (err instanceof ExpiredApiKeyError) {
      finish("expired_key", "ExpiredApiKeyError", err.message);
    } else if (err instanceof RateLimitExhaustedError) {
      finish("rate_limited", "RateLimitExhaustedError", err.message);
    } else {
      finish(
        "error",
        err instanceof Error ? err.name : "UnknownError",
        err instanceof Error ? err.message : String(err),
      );
    }
    throw err;
  }
}
