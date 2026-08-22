// Écritures du collecteur — seul composant autorisé à écrire dans les tables
// de match (docs/ARCHITECTURE.md § 1). Toute écriture est un
// `INSERT ... ON CONFLICT DO UPDATE` sur clé naturelle : idempotent, jamais
// de doublon en relançant un run.
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { gzipSync } from "node:zlib";
import type { LolStatsDb, LolStatsTx } from "@/db/client";
import {
  ingestCursors,
  ingestFailures,
  ingestRuns,
  matchParticipants,
  matchRaw,
  matches,
  matchTeams,
  players,
  rankSnapshots,
} from "@/db/schema";
import type {
  NormalizedMatch,
  NormalizedParticipant,
  NormalizedTeam,
} from "@/lib/riot/normalize";

export function filterUnknownMatchIds(db: LolStatsDb, ids: string[]): string[] {
  if (ids.length === 0) return [];
  const known = db
    .select({ matchId: matches.matchId })
    .from(matches)
    .where(inArray(matches.matchId, ids))
    .all();
  const knownSet = new Set(known.map((r) => r.matchId));
  return ids.filter((id) => !knownSet.has(id));
}

/** `kind` par défaut = http_404 : c'est le seul échec définitif — les autres
 *  (5xx, parse_error) sont réessayés au run suivant (docs/DATA-MODEL.md
 *  § « ingest_failures »). */
export function isPermanentlyFailed(db: LolStatsDb, matchId: string): boolean {
  const row = db
    .select({ matchId: ingestFailures.matchId })
    .from(ingestFailures)
    .where(and(eq(ingestFailures.matchId, matchId), eq(ingestFailures.kind, "http_404")))
    .get();
  return row != null;
}

export function recordFailure(
  db: LolStatsDb,
  matchId: string,
  kind: "http_404" | "http_5xx" | "parse_error" | "rate_limited",
  detail: string | null,
  nowIso: string,
): void {
  db.insert(ingestFailures)
    .values({ matchId, kind, attemptCount: 1, lastAttemptAt: nowIso, detail })
    .onConflictDoUpdate({
      target: ingestFailures.matchId,
      set: {
        kind,
        attemptCount: sql`${ingestFailures.attemptCount} + 1`,
        lastAttemptAt: nowIso,
        detail,
      },
    })
    .run();
}

export function upsertPlayer(
  db: LolStatsDb | LolStatsTx,
  player: {
    puuid: string;
    gameName: string;
    tagLine: string;
    platformId: string;
    isSelf: boolean;
  },
  nowMs: number,
  nowIso: string,
): void {
  const isSelfInt = player.isSelf ? 1 : 0;
  db.insert(players)
    .values({
      puuid: player.puuid,
      gameName: player.gameName,
      tagLine: player.tagLine,
      platformId: player.platformId,
      isSelf: isSelfInt,
      isTracked: 0,
      firstSeenMs: nowMs,
      lastSeenMs: nowMs,
      updatedAt: nowIso,
    })
    .onConflictDoUpdate({
      target: players.puuid,
      set: {
        gameName: player.gameName,
        tagLine: player.tagLine,
        platformId: player.platformId,
        // Ne jamais redescendre is_self à 0 : une fois vu comme le compte
        // principal, il le reste (MAX avec la valeur déjà en base).
        isSelf: sql`MAX(${players.isSelf}, ${isSelfInt})`,
        lastSeenMs: nowMs,
        updatedAt: nowIso,
      },
    })
    .run();
}

export interface WriteMatchParams {
  match: NormalizedMatch;
  teams: NormalizedTeam[];
  participants: NormalizedParticipant[];
  rawJson: unknown;
  selfPuuid: string;
  nowMs: number;
  nowIso: string;
}

export function writeMatchTransaction(db: LolStatsDb, params: WriteMatchParams): void {
  const { matchId: _mId, ...matchSet } = params.match;
  const payloadGz = gzipSync(Buffer.from(JSON.stringify(params.rawJson)));

  db.transaction((tx) => {
    tx.insert(matches)
      .values(params.match)
      .onConflictDoUpdate({ target: matches.matchId, set: matchSet })
      .run();

    tx.insert(matchRaw)
      .values({
        matchId: params.match.matchId,
        payloadGz,
        payloadSchema: "match-v5",
        fetchedAt: params.nowIso,
      })
      .onConflictDoUpdate({
        target: matchRaw.matchId,
        set: { payloadGz, payloadSchema: "match-v5", fetchedAt: params.nowIso },
      })
      .run();

    for (const team of params.teams) {
      const { matchId: _tm, teamId: _tt, ...teamSet } = team;
      tx.insert(matchTeams)
        .values(team)
        .onConflictDoUpdate({ target: [matchTeams.matchId, matchTeams.teamId], set: teamSet })
        .run();
    }

    for (const participant of params.participants) {
      // players avant match_participants : la FK (match_participants.puuid
      // → players.puuid) l'exige.
      upsertPlayer(
        tx,
        {
          puuid: participant.puuid,
          gameName: participant.riotIdGameName,
          tagLine: participant.riotIdTagLine,
          platformId: params.match.platformId,
          isSelf: participant.puuid === params.selfPuuid,
        },
        params.nowMs,
        params.nowIso,
      );

      const { matchId: _pm, puuid: _pp, ...participantSet } = participant;
      tx.insert(matchParticipants)
        .values(participant)
        .onConflictDoUpdate({
          target: [matchParticipants.matchId, matchParticipants.puuid],
          set: participantSet,
        })
        .run();
    }
  });
}

/** Recalcule le curseur depuis ce qui est réellement en base — jamais depuis
 *  la mémoire du run — pour rester correct même après une reprise partielle. */
export function updateCursorFromDb(
  db: LolStatsDb,
  puuid: string,
  queueId: number,
  nowIso: string,
): void {
  const endExpr = sql<number>`COALESCE(${matches.gameEndMs}, ${matches.gameStartMs})`;
  const row = db
    .select({ matchId: matches.matchId, endMs: endExpr })
    .from(matches)
    .innerJoin(matchParticipants, eq(matchParticipants.matchId, matches.matchId))
    .where(and(eq(matches.queueId, queueId), eq(matchParticipants.puuid, puuid)))
    .orderBy(desc(endExpr))
    .limit(1)
    .get();

  if (!row) return;

  db.insert(ingestCursors)
    .values({
      puuid,
      queueId,
      lastMatchEndMs: row.endMs,
      lastMatchId: row.matchId,
      updatedAt: nowIso,
    })
    .onConflictDoUpdate({
      target: [ingestCursors.puuid, ingestCursors.queueId],
      set: { lastMatchEndMs: row.endMs, lastMatchId: row.matchId, updatedAt: nowIso },
    })
    .run();
}

export function getCursor(
  db: LolStatsDb,
  puuid: string,
  queueId: number,
): { lastMatchEndMs: number | null } | undefined {
  return db
    .select({ lastMatchEndMs: ingestCursors.lastMatchEndMs })
    .from(ingestCursors)
    .where(and(eq(ingestCursors.puuid, puuid), eq(ingestCursors.queueId, queueId)))
    .get();
}

export interface RankSnapshotInput {
  puuid: string;
  queueType: string;
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
  hotStreak: boolean;
  capturedAt: string;
  capturedMs: number;
}

/** league-v4 ne renvoie que l'instant présent — un run sans ce cliché est du
 *  LP perdu pour toujours (docs/ARCHITECTURE.md § 3, étape 4). */
export function insertRankSnapshot(db: LolStatsDb, row: RankSnapshotInput): void {
  db.insert(rankSnapshots)
    .values({ ...row, hotStreak: row.hotStreak ? 1 : 0 })
    .onConflictDoNothing()
    .run();
}

export function startRun(db: LolStatsDb, startedAtIso: string): number {
  // Statut initial pessimiste : si le process meurt avant finishRun(), la
  // ligne reste "error" — jamais un faux succès silencieux.
  const result = db.insert(ingestRuns).values({ startedAt: startedAtIso, status: "error" }).run();
  return Number(result.lastInsertRowid);
}

export interface FinishRunPatch {
  finishedAt: string;
  status: "success" | "partial" | "expired_key" | "config_error" | "rate_limited" | "error";
  matchesDiscoveredCount: number;
  matchesWrittenCount: number;
  apiCallCount: number;
  rateLimitWaitMs: number;
  errorKind?: string | null;
  errorMessage?: string | null;
}

export function finishRun(db: LolStatsDb, id: number, patch: FinishRunPatch): void {
  db.update(ingestRuns).set(patch).where(eq(ingestRuns.id, id)).run();
}
