// Normalisation à l'ingestion, jamais à l'affichage — docs/DATA-MODEL.md § 4.
// Fonctions pures : un DTO Riot entre, des lignes prêtes pour Drizzle sortent.
// Testées sans base (src/lib/riot/normalize.test.ts).
import { deriveSeasonId } from "@/lib/stats/seasons";
import type { MatchDto, ParticipantDto } from "./dto";

function bool01(value: boolean | undefined): number {
  return value ? 1 : 0;
}

/**
 * Depuis le patch 11.20, quand `gameEndTimestamp` est présent, `gameDuration`
 * est en secondes ; sur des parties plus anciennes il est en millisecondes.
 * docs/DATA-MODEL.md § 4.1 — piège n°1.
 */
export function normalizeGameDurationS(
  gameDuration: number,
  gameEndTimestamp: number | undefined,
): number {
  if (gameEndTimestamp != null) return Math.round(gameDuration);
  return Math.round(gameDuration / 1_000);
}

/** `"15.16.712.4923"` → `"15.16"`. */
export function derivePatch(gameVersion: string): string {
  const parts = gameVersion.split(".");
  if (parts.length < 2) return gameVersion;
  return `${parts[0]}.${parts[1]}`;
}

/** Une partie annulée est une défaite comptable sans contenu — exclue par
 *  défaut de toute statistique (docs/DATA-MODEL.md § 4.2, piège n°2). */
export function deriveIsRemake(endedInEarlySurrender: boolean, gameDurationS: number): boolean {
  return endedInEarlySurrender || gameDurationS < 300;
}

export interface TeamTotals {
  kills: number;
  damageToChampions: number;
  goldEarned: number;
}

/** Les compteurs d'équipe ne sont pas dans le DTO participant — calculés ici
 *  depuis les 10 participants, puis dénormalisés sur chaque ligne
 *  (docs/DATA-MODEL.md § 2 « Dénormalisations assumées », § 4.8). */
export function computeTeamTotals(participants: ParticipantDto[]): Map<number, TeamTotals> {
  const totals = new Map<number, TeamTotals>();
  for (const p of participants) {
    const t = totals.get(p.teamId) ?? { kills: 0, damageToChampions: 0, goldEarned: 0 };
    t.kills += p.kills;
    t.damageToChampions += p.totalDamageDealtToChampions;
    t.goldEarned += p.goldEarned;
    totals.set(p.teamId, t);
  }
  return totals;
}

export interface NormalizedMatch {
  matchId: string;
  platformId: string;
  queueId: number;
  gameVersion: string;
  patch: string;
  seasonId: string;
  gameCreationMs: number;
  gameStartMs: number;
  gameEndMs: number | null;
  gameDurationS: number;
  mapId: number;
  gameMode: string;
  gameType: string;
  endedInEarlySurrender: number;
  endedInSurrender: number;
  isRemake: number;
  ingestedAt: string;
}

export function normalizeMatch(dto: MatchDto, ingestedAt: string): NormalizedMatch {
  const info = dto.info;
  const gameDurationS = normalizeGameDurationS(info.gameDuration, info.gameEndTimestamp);
  const patch = derivePatch(info.gameVersion);
  // Les 10 participants d'une même partie portent le même indicateur de
  // surrender : n'importe lequel fait référence (docs/DATA-MODEL.md § 4).
  const firstParticipant = info.participants[0];
  const endedInEarlySurrender = firstParticipant?.gameEndedInEarlySurrender ?? false;
  const endedInSurrender = firstParticipant?.gameEndedInSurrender ?? false;

  return {
    matchId: dto.metadata.matchId,
    platformId: info.platformId,
    queueId: info.queueId,
    gameVersion: info.gameVersion,
    patch,
    seasonId: deriveSeasonId(patch),
    gameCreationMs: info.gameCreation,
    gameStartMs: info.gameStartTimestamp,
    gameEndMs: info.gameEndTimestamp ?? null,
    gameDurationS,
    mapId: info.mapId,
    gameMode: info.gameMode,
    gameType: info.gameType,
    endedInEarlySurrender: bool01(endedInEarlySurrender),
    endedInSurrender: bool01(endedInSurrender),
    isRemake: bool01(deriveIsRemake(endedInEarlySurrender, gameDurationS)),
    ingestedAt,
  };
}

export interface NormalizedTeam {
  matchId: string;
  teamId: number;
  win: number;
  baronKills: number;
  dragonKills: number;
  heraldKills: number;
  towerKills: number;
  inhibitorKills: number;
  firstBlood: number;
  firstTower: number;
  firstDragon: number;
  firstBaron: number;
  bansJson: string | null;
}

export function normalizeTeams(dto: MatchDto): NormalizedTeam[] {
  return dto.info.teams.map((t) => ({
    matchId: dto.metadata.matchId,
    teamId: t.teamId,
    win: bool01(t.win),
    baronKills: t.objectives?.baron?.kills ?? 0,
    dragonKills: t.objectives?.dragon?.kills ?? 0,
    heraldKills: t.objectives?.riftHerald?.kills ?? 0,
    towerKills: t.objectives?.tower?.kills ?? 0,
    inhibitorKills: t.objectives?.inhibitor?.kills ?? 0,
    firstBlood: bool01(t.objectives?.champion?.first),
    firstTower: bool01(t.objectives?.tower?.first),
    firstDragon: bool01(t.objectives?.dragon?.first),
    firstBaron: bool01(t.objectives?.baron?.first),
    bansJson: t.bans ? JSON.stringify(t.bans) : null,
  }));
}

function extractPerkStyle(perks: ParticipantDto["perks"], styleIndex: number): number | null {
  return perks?.styles?.[styleIndex]?.style ?? null;
}

function extractKeystone(perks: ParticipantDto["perks"]): number | null {
  return perks?.styles?.[0]?.selections?.[0]?.perk ?? null;
}

// Bloc `challenges` : forme non figée côté Riot, on ne type que ce qu'on
// promeut en colonne (docs/DATA-MODEL.md § 4.4 — piège n°4).
interface ChallengesShape {
  soloKills?: number;
  laneMinionsFirst10Minutes?: number;
  controlWardsPlaced?: number;
}

export interface NormalizedParticipant {
  matchId: string;
  puuid: string;
  participantId: number;
  teamId: number;
  championId: number;
  championName: string;
  champLevel: number;
  riotIdGameName: string;
  riotIdTagLine: string;

  teamPosition: string;
  individualPosition: string;
  lane: string;
  role: string;

  win: number;

  kills: number;
  deaths: number;
  assists: number;

  totalDamageDealtToChampions: number;
  physicalDamageToChampions: number;
  magicDamageToChampions: number;
  trueDamageToChampions: number;
  totalDamageTaken: number;
  damageSelfMitigated: number;
  damageDealtToObjectives: number;
  damageDealtToTurrets: number;

  totalMinionsKilled: number;
  neutralMinionsKilled: number;

  goldEarned: number;
  goldSpent: number;

  visionScore: number;
  wardsPlacedCount: number;
  wardsKilledCount: number;
  detectorWardsPlacedCount: number;
  visionWardsBoughtCount: number;

  timeCcingOthersS: number;
  totalTimeSpentDeadS: number;
  longestTimeLivingS: number;

  turretKills: number;
  inhibitorKills: number;
  dragonKills: number;
  baronKills: number;

  largestKillingSpree: number;
  largestMultiKill: number;
  doubleKills: number;
  tripleKills: number;
  quadraKills: number;
  pentaKills: number;

  firstBloodKill: number;
  firstBloodAssist: number;
  firstTowerKill: number;

  item0: number;
  item1: number;
  item2: number;
  item3: number;
  item4: number;
  item5: number;
  item6: number;
  summoner1Id: number;
  summoner2Id: number;
  perkPrimaryStyle: number | null;
  perkSubStyle: number | null;
  perkKeystone: number | null;
  perksJson: string | null;

  challengesJson: string | null;
  soloKills: number | null;
  laneMinionsFirst10: number | null;
  controlWardsPlaced: number | null;

  teamTotalKills: number;
  teamTotalDamageToChampions: number;
  teamTotalGoldEarned: number;
}

export function normalizeParticipants(dto: MatchDto): NormalizedParticipant[] {
  const matchId = dto.metadata.matchId;
  const teamTotals = computeTeamTotals(dto.info.participants);

  return dto.info.participants.map((p) => {
    const totals = teamTotals.get(p.teamId) ?? { kills: 0, damageToChampions: 0, goldEarned: 0 };
    const challenges = p.challenges as ChallengesShape | undefined;

    return {
      matchId,
      puuid: p.puuid,
      participantId: p.participantId,
      teamId: p.teamId,
      championId: p.championId,
      championName: p.championName,
      champLevel: p.champLevel,
      riotIdGameName: p.riotIdGameName,
      riotIdTagLine: p.riotIdTagline,

      teamPosition: p.teamPosition,
      individualPosition: p.individualPosition,
      lane: p.lane,
      role: p.role,

      win: bool01(p.win),

      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,

      totalDamageDealtToChampions: p.totalDamageDealtToChampions,
      physicalDamageToChampions: p.physicalDamageDealtToChampions,
      magicDamageToChampions: p.magicDamageDealtToChampions,
      trueDamageToChampions: p.trueDamageDealtToChampions,
      totalDamageTaken: p.totalDamageTaken,
      damageSelfMitigated: p.damageSelfMitigated,
      damageDealtToObjectives: p.damageDealtToObjectives,
      damageDealtToTurrets: p.damageDealtToTurrets,

      totalMinionsKilled: p.totalMinionsKilled,
      neutralMinionsKilled: p.neutralMinionsKilled,

      goldEarned: p.goldEarned,
      goldSpent: p.goldSpent,

      visionScore: p.visionScore,
      wardsPlacedCount: p.wardsPlaced,
      wardsKilledCount: p.wardsKilled,
      detectorWardsPlacedCount: p.detectorWardsPlaced,
      visionWardsBoughtCount: p.visionWardsBoughtInGame,

      timeCcingOthersS: p.timeCCingOthers,
      totalTimeSpentDeadS: p.totalTimeSpentDead,
      longestTimeLivingS: p.longestTimeSpentLiving,

      turretKills: p.turretKills,
      inhibitorKills: p.inhibitorKills,
      dragonKills: p.dragonKills,
      baronKills: p.baronKills,

      largestKillingSpree: p.largestKillingSpree,
      largestMultiKill: p.largestMultiKill,
      doubleKills: p.doubleKills,
      tripleKills: p.tripleKills,
      quadraKills: p.quadraKills,
      pentaKills: p.pentaKills,

      firstBloodKill: bool01(p.firstBloodKill),
      firstBloodAssist: bool01(p.firstBloodAssist),
      firstTowerKill: bool01(p.firstTowerKill),

      item0: p.item0,
      item1: p.item1,
      item2: p.item2,
      item3: p.item3,
      item4: p.item4,
      item5: p.item5,
      item6: p.item6,
      summoner1Id: p.summoner1Id,
      summoner2Id: p.summoner2Id,
      perkPrimaryStyle: extractPerkStyle(p.perks, 0),
      perkSubStyle: extractPerkStyle(p.perks, 1),
      perkKeystone: extractKeystone(p.perks),
      perksJson: p.perks ? JSON.stringify(p.perks) : null,

      challengesJson: p.challenges ? JSON.stringify(p.challenges) : null,
      soloKills: challenges?.soloKills ?? null,
      laneMinionsFirst10: challenges?.laneMinionsFirst10Minutes ?? null,
      controlWardsPlaced: challenges?.controlWardsPlaced ?? null,

      teamTotalKills: totals.kills,
      teamTotalDamageToChampions: totals.damageToChampions,
      teamTotalGoldEarned: totals.goldEarned,
    };
  });
}
