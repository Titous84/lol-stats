// Schémas zod des DTO Riot consommés par le collecteur — TASKS.md § L1.
//
// `.passthrough()` partout : un champ que Riot ajoute demain ne fait pas
// planter le run. Seuls les champs que le collecteur lit réellement sont
// déclarés ; le reste vit dans `match_raw` (payload complet, gzip) et n'a
// jamais besoin d'être typé.
import { z } from "zod";

export const accountDtoSchema = z
  .object({
    puuid: z.string(),
    gameName: z.string().optional(),
    tagLine: z.string().optional(),
  })
  .passthrough();
export type AccountDto = z.infer<typeof accountDtoSchema>;

export const matchIdsDtoSchema = z.array(z.string());

const teamObjectiveDtoSchema = z
  .object({
    first: z.boolean().optional(),
    kills: z.number().optional(),
  })
  .passthrough();

const teamDtoSchema = z
  .object({
    teamId: z.number(),
    win: z.boolean(),
    bans: z
      .array(z.object({ championId: z.number(), pickTurn: z.number() }).passthrough())
      .optional(),
    objectives: z
      .object({
        baron: teamObjectiveDtoSchema.optional(),
        champion: teamObjectiveDtoSchema.optional(),
        dragon: teamObjectiveDtoSchema.optional(),
        inhibitor: teamObjectiveDtoSchema.optional(),
        riftHerald: teamObjectiveDtoSchema.optional(),
        tower: teamObjectiveDtoSchema.optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();
export type TeamDto = z.infer<typeof teamDtoSchema>;

const perksDtoSchema = z
  .object({
    statPerks: z.record(z.string(), z.number()).optional(),
    styles: z
      .array(
        z
          .object({
            description: z.string().optional(),
            style: z.number().optional(),
            selections: z
              .array(
                z
                  .object({
                    perk: z.number().optional(),
                    var1: z.number().optional(),
                    var2: z.number().optional(),
                    var3: z.number().optional(),
                  })
                  .passthrough(),
              )
              .optional(),
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();

const participantDtoSchema = z
  .object({
    puuid: z.string(),
    participantId: z.number(),
    teamId: z.number(),
    championId: z.number(),
    championName: z.string(),
    champLevel: z.number(),
    riotIdGameName: z.string().optional().default(""),
    riotIdTagline: z.string().optional().default(""),

    teamPosition: z.string().optional().default(""),
    individualPosition: z.string().optional().default(""),
    lane: z.string().optional().default(""),
    role: z.string().optional().default(""),

    win: z.boolean(),

    kills: z.number(),
    deaths: z.number(),
    assists: z.number(),

    totalDamageDealtToChampions: z.number().default(0),
    physicalDamageDealtToChampions: z.number().default(0),
    magicDamageDealtToChampions: z.number().default(0),
    trueDamageDealtToChampions: z.number().default(0),
    totalDamageTaken: z.number().default(0),
    damageSelfMitigated: z.number().default(0),
    damageDealtToObjectives: z.number().default(0),
    damageDealtToTurrets: z.number().default(0),

    totalMinionsKilled: z.number().default(0),
    neutralMinionsKilled: z.number().default(0),

    goldEarned: z.number().default(0),
    goldSpent: z.number().default(0),

    visionScore: z.number().default(0),
    wardsPlaced: z.number().default(0),
    wardsKilled: z.number().default(0),
    detectorWardsPlaced: z.number().default(0),
    visionWardsBoughtInGame: z.number().default(0),

    timeCCingOthers: z.number().default(0),
    totalTimeSpentDead: z.number().default(0),
    longestTimeSpentLiving: z.number().default(0),

    turretKills: z.number().default(0),
    inhibitorKills: z.number().default(0),
    dragonKills: z.number().default(0),
    baronKills: z.number().default(0),

    largestKillingSpree: z.number().default(0),
    largestMultiKill: z.number().default(0),
    doubleKills: z.number().default(0),
    tripleKills: z.number().default(0),
    quadraKills: z.number().default(0),
    pentaKills: z.number().default(0),

    firstBloodKill: z.boolean().default(false),
    firstBloodAssist: z.boolean().default(false),
    firstTowerKill: z.boolean().default(false),

    item0: z.number().default(0),
    item1: z.number().default(0),
    item2: z.number().default(0),
    item3: z.number().default(0),
    item4: z.number().default(0),
    item5: z.number().default(0),
    item6: z.number().default(0),
    summoner1Id: z.number().default(0),
    summoner2Id: z.number().default(0),
    perks: perksDtoSchema.optional(),

    // Absent sur les matchs anciens (docs/DATA-MODEL.md § 4.4).
    challenges: z.record(z.string(), z.unknown()).optional(),

    gameEndedInEarlySurrender: z.boolean().optional(),
    gameEndedInSurrender: z.boolean().optional(),
  })
  .passthrough();
export type ParticipantDto = z.infer<typeof participantDtoSchema>;

const matchInfoDtoSchema = z
  .object({
    gameCreation: z.number(),
    gameDuration: z.number(),
    // Absent sur les matchs anciens — c'est justement ce qui signale l'unité
    // de gameDuration (docs/DATA-MODEL.md § 4.1).
    gameEndTimestamp: z.number().optional(),
    gameStartTimestamp: z.number(),
    gameId: z.number(),
    gameMode: z.string(),
    gameType: z.string(),
    gameVersion: z.string(),
    mapId: z.number(),
    platformId: z.string(),
    queueId: z.number(),
    participants: z.array(participantDtoSchema).min(1),
    teams: z.array(teamDtoSchema).min(1),
  })
  .passthrough();

export const matchDtoSchema = z
  .object({
    metadata: z
      .object({
        matchId: z.string(),
        participants: z.array(z.string()),
      })
      .passthrough(),
    info: matchInfoDtoSchema,
  })
  .passthrough();
export type MatchDto = z.infer<typeof matchDtoSchema>;

export const leagueEntryDtoSchema = z
  .object({
    puuid: z.string().optional(),
    queueType: z.string(),
    tier: z.string(),
    rank: z.string(),
    leaguePoints: z.number(),
    wins: z.number(),
    losses: z.number(),
    hotStreak: z.boolean().default(false),
  })
  .passthrough();
export type LeagueEntryDto = z.infer<typeof leagueEntryDtoSchema>;

export const leagueEntriesDtoSchema = z.array(leagueEntryDtoSchema);
