// Schéma complet — L1 (docs/DATA-MODEL.md, docs/ARCHITECTURE.md).
// Conventions de nommage : CLAUDE.md § 5. Aucun ratio stocké (voir § 1).
import { sql, desc } from "drizzle-orm";
import {
  blob,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// ---------------------------------------------------------------------------
// players — tout joueur croisé, pas seulement le compte principal.
// ---------------------------------------------------------------------------
export const players = sqliteTable("players", {
  puuid: text("puuid").primaryKey(),
  gameName: text("game_name").notNull(),
  tagLine: text("tag_line").notNull(),
  platformId: text("platform_id").notNull(),
  isSelf: integer("is_self").notNull().default(0),
  isTracked: integer("is_tracked").notNull().default(0),
  firstSeenMs: integer("first_seen_ms").notNull(),
  lastSeenMs: integer("last_seen_ms").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// ---------------------------------------------------------------------------
// matches — une ligne par partie. La table chaude.
// ---------------------------------------------------------------------------
export const matches = sqliteTable(
  "matches",
  {
    matchId: text("match_id").primaryKey(),
    platformId: text("platform_id").notNull(),
    queueId: integer("queue_id").notNull(),
    gameVersion: text("game_version").notNull(),
    patch: text("patch").notNull(),
    seasonId: text("season_id").notNull(),
    gameCreationMs: integer("game_creation_ms").notNull(),
    gameStartMs: integer("game_start_ms").notNull(),
    gameEndMs: integer("game_end_ms"),
    gameDurationS: integer("game_duration_s").notNull(),
    mapId: integer("map_id").notNull(),
    gameMode: text("game_mode").notNull(),
    gameType: text("game_type").notNull(),
    endedInEarlySurrender: integer("ended_in_early_surrender").notNull().default(0),
    endedInSurrender: integer("ended_in_surrender").notNull().default(0),
    isRemake: integer("is_remake").notNull().default(0),
    timelineFetchedAt: text("timeline_fetched_at"),
    ingestedAt: text("ingested_at").notNull(),
  },
  (table) => [
    index("idx_matches_queue_start").on(table.queueId, desc(table.gameStartMs)),
    index("idx_matches_patch").on(table.patch),
    index("idx_matches_season").on(table.seasonId),
    index("idx_matches_timeline_todo")
      .on(table.queueId, table.timelineFetchedAt)
      .where(sql`${table.timelineFetchedAt} IS NULL`),
  ],
);

// ---------------------------------------------------------------------------
// match_raw — réponse match-v5 complète, gzip. Séparée pour garder `matches`
// petite et servie par le cache disque de SQLite.
// ---------------------------------------------------------------------------
export const matchRaw = sqliteTable("match_raw", {
  matchId: text("match_id")
    .primaryKey()
    .references(() => matches.matchId),
  payloadGz: blob("payload_gz", { mode: "buffer" }).notNull(),
  payloadSchema: text("payload_schema").notNull(),
  fetchedAt: text("fetched_at").notNull(),
});

// ---------------------------------------------------------------------------
// match_teams — deux lignes par match.
// ---------------------------------------------------------------------------
export const matchTeams = sqliteTable(
  "match_teams",
  {
    matchId: text("match_id")
      .notNull()
      .references(() => matches.matchId),
    teamId: integer("team_id").notNull(),
    win: integer("win").notNull(),
    baronKills: integer("baron_kills").notNull(),
    dragonKills: integer("dragon_kills").notNull(),
    heraldKills: integer("herald_kills").notNull(),
    towerKills: integer("tower_kills").notNull(),
    inhibitorKills: integer("inhibitor_kills").notNull(),
    firstBlood: integer("first_blood").notNull(),
    firstTower: integer("first_tower").notNull(),
    firstDragon: integer("first_dragon").notNull(),
    firstBaron: integer("first_baron").notNull(),
    bansJson: text("bans_json"),
  },
  (table) => [primaryKey({ columns: [table.matchId, table.teamId] })],
);

// ---------------------------------------------------------------------------
// match_participants — la table de travail. Dix lignes par match.
// ---------------------------------------------------------------------------
export const matchParticipants = sqliteTable(
  "match_participants",
  {
    matchId: text("match_id")
      .notNull()
      .references(() => matches.matchId),
    puuid: text("puuid")
      .notNull()
      .references(() => players.puuid),

    participantId: integer("participant_id").notNull(),
    teamId: integer("team_id").notNull(),
    championId: integer("champion_id").notNull(),
    championName: text("champion_name").notNull(),
    champLevel: integer("champ_level").notNull(),
    riotIdGameName: text("riot_id_game_name").notNull(),
    riotIdTagLine: text("riot_id_tag_line").notNull(),

    teamPosition: text("team_position"),
    individualPosition: text("individual_position"),
    lane: text("lane"),
    role: text("role"),

    win: integer("win").notNull(),

    kills: integer("kills").notNull(),
    deaths: integer("deaths").notNull(),
    assists: integer("assists").notNull(),

    totalDamageDealtToChampions: integer("total_damage_dealt_to_champions").notNull(),
    physicalDamageToChampions: integer("physical_damage_to_champions").notNull(),
    magicDamageToChampions: integer("magic_damage_to_champions").notNull(),
    trueDamageToChampions: integer("true_damage_to_champions").notNull(),
    totalDamageTaken: integer("total_damage_taken").notNull(),
    damageSelfMitigated: integer("damage_self_mitigated").notNull(),
    damageDealtToObjectives: integer("damage_dealt_to_objectives").notNull(),
    damageDealtToTurrets: integer("damage_dealt_to_turrets").notNull(),

    totalMinionsKilled: integer("total_minions_killed").notNull(),
    neutralMinionsKilled: integer("neutral_minions_killed").notNull(),

    goldEarned: integer("gold_earned").notNull(),
    goldSpent: integer("gold_spent").notNull(),

    visionScore: integer("vision_score").notNull(),
    wardsPlacedCount: integer("wards_placed_count").notNull(),
    wardsKilledCount: integer("wards_killed_count").notNull(),
    detectorWardsPlacedCount: integer("detector_wards_placed_count").notNull(),
    visionWardsBoughtCount: integer("vision_wards_bought_count").notNull(),

    timeCcingOthersS: integer("time_ccing_others_s").notNull(),
    totalTimeSpentDeadS: integer("total_time_spent_dead_s").notNull(),
    longestTimeLivingS: integer("longest_time_living_s").notNull(),

    turretKills: integer("turret_kills").notNull(),
    inhibitorKills: integer("inhibitor_kills").notNull(),
    dragonKills: integer("dragon_kills").notNull(),
    baronKills: integer("baron_kills").notNull(),

    largestKillingSpree: integer("largest_killing_spree").notNull(),
    largestMultiKill: integer("largest_multi_kill").notNull(),
    doubleKills: integer("double_kills").notNull(),
    tripleKills: integer("triple_kills").notNull(),
    quadraKills: integer("quadra_kills").notNull(),
    pentaKills: integer("penta_kills").notNull(),

    firstBloodKill: integer("first_blood_kill").notNull(),
    firstBloodAssist: integer("first_blood_assist").notNull(),
    firstTowerKill: integer("first_tower_kill").notNull(),

    item0: integer("item_0").notNull(),
    item1: integer("item_1").notNull(),
    item2: integer("item_2").notNull(),
    item3: integer("item_3").notNull(),
    item4: integer("item_4").notNull(),
    item5: integer("item_5").notNull(),
    item6: integer("item_6").notNull(),
    summoner1Id: integer("summoner_1_id").notNull(),
    summoner2Id: integer("summoner_2_id").notNull(),
    perkPrimaryStyle: integer("perk_primary_style"),
    perkSubStyle: integer("perk_sub_style"),
    perkKeystone: integer("perk_keystone"),
    perksJson: text("perks_json"),

    challengesJson: text("challenges_json"),
    soloKills: integer("solo_kills"),
    laneMinionsFirst10: integer("lane_minions_first_10"),
    controlWardsPlaced: integer("control_wards_placed"),

    // Dénormalisations assumées — recopiées depuis match_teams à l'ingestion.
    // Sûres : ces totaux sont immuables une fois la partie terminée.
    // (docs/DATA-MODEL.md § 2 « Dénormalisations assumées »)
    teamTotalKills: integer("team_total_kills").notNull(),
    teamTotalDamageToChampions: integer("team_total_damage_to_champions").notNull(),
    teamTotalGoldEarned: integer("team_total_gold_earned").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.matchId, table.puuid] }),
    index("idx_mp_puuid_match").on(table.puuid, table.matchId),
    index("idx_mp_puuid_champ").on(table.puuid, table.championId),
    index("idx_mp_puuid_pos").on(table.puuid, table.teamPosition),
    index("idx_mp_match_pos").on(table.matchId, table.teamPosition),
    index("idx_mp_match_team").on(table.matchId, table.teamId),
  ],
);

// ---------------------------------------------------------------------------
// rank_snapshots — écrit à CHAQUE run d'ingestion. Irremplaçable.
// ---------------------------------------------------------------------------
export const rankSnapshots = sqliteTable(
  "rank_snapshots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    puuid: text("puuid").notNull(),
    queueType: text("queue_type").notNull(),
    tier: text("tier").notNull(),
    rank: text("rank").notNull(),
    leaguePoints: integer("league_points").notNull(),
    wins: integer("wins").notNull(),
    losses: integer("losses").notNull(),
    hotStreak: integer("hot_streak").notNull(),
    capturedAt: text("captured_at").notNull(),
    capturedMs: integer("captured_ms").notNull(),
  },
  (table) => [
    uniqueIndex("idx_rank_puuid_time").on(table.puuid, table.queueType, table.capturedMs),
  ],
);

// ---------------------------------------------------------------------------
// ingest_runs — un journal par run, jamais purgé.
// ---------------------------------------------------------------------------
export const ingestRuns = sqliteTable("ingest_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
  status: text("status").notNull(),
  matchesDiscoveredCount: integer("matches_discovered_count").notNull().default(0),
  matchesWrittenCount: integer("matches_written_count").notNull().default(0),
  apiCallCount: integer("api_call_count").notNull().default(0),
  rateLimitWaitMs: integer("rate_limit_wait_ms").notNull().default(0),
  errorKind: text("error_kind"),
  errorMessage: text("error_message"),
});

// ---------------------------------------------------------------------------
// ingest_cursors — un curseur par (puuid, queue).
// ---------------------------------------------------------------------------
export const ingestCursors = sqliteTable(
  "ingest_cursors",
  {
    puuid: text("puuid").notNull(),
    queueId: integer("queue_id").notNull(),
    lastMatchEndMs: integer("last_match_end_ms"),
    lastMatchId: text("last_match_id"),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.puuid, table.queueId] })],
);

// ---------------------------------------------------------------------------
// ingest_failures — un 404 définitif n'est jamais redemandé.
// ---------------------------------------------------------------------------
export const ingestFailures = sqliteTable("ingest_failures", {
  matchId: text("match_id").primaryKey(),
  kind: text("kind").notNull(),
  attemptCount: integer("attempt_count").notNull().default(1),
  lastAttemptAt: text("last_attempt_at").notNull(),
  detail: text("detail"),
});

// ---------------------------------------------------------------------------
// player_lookups — cache de la recherche par Riot ID. TTL 24h côté requête.
// ---------------------------------------------------------------------------
export const playerLookups = sqliteTable(
  "player_lookups",
  {
    gameNameLower: text("game_name_lower").notNull(),
    tagLineLower: text("tag_line_lower").notNull(),
    puuid: text("puuid").notNull(),
    resolvedAt: text("resolved_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.gameNameLower, table.tagLineLower] })],
);

// ---------------------------------------------------------------------------
// asset_versions — version Data Dragon actuellement synchronisée en local.
// ---------------------------------------------------------------------------
export const assetVersions = sqliteTable("asset_versions", {
  ddragonVersion: text("ddragon_version").primaryKey(),
  fetchedAt: text("fetched_at").notNull(),
  isCurrent: integer("is_current").notNull().default(0),
});

// ---------------------------------------------------------------------------
// match_timelines — v2, vide en v1. Créée dès maintenant pour que la
// migration v2 n'ait pas à toucher au schéma existant.
// ---------------------------------------------------------------------------
export const matchTimelines = sqliteTable("match_timelines", {
  matchId: text("match_id")
    .primaryKey()
    .references(() => matches.matchId),
  payloadGz: blob("payload_gz", { mode: "buffer" }),
  fetchedAt: text("fetched_at"),
});
