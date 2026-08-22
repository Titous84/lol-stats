import { describe, expect, it } from "vitest";
import type { MatchDto } from "./dto";
import {
  computeTeamTotals,
  deriveIsRemake,
  derivePatch,
  normalizeGameDurationS,
  normalizeMatch,
  normalizeParticipants,
  normalizeTeams,
} from "./normalize";

function makeParticipant(overrides: Record<string, unknown> = {}) {
  return {
    puuid: "p1",
    participantId: 1,
    teamId: 100,
    championId: 1,
    championName: "Annie",
    champLevel: 18,
    riotIdGameName: "Player",
    riotIdTagline: "NA1",
    teamPosition: "MIDDLE",
    individualPosition: "MIDDLE",
    lane: "MIDDLE",
    role: "SOLO",
    win: true,
    kills: 5,
    deaths: 2,
    assists: 7,
    totalDamageDealtToChampions: 20_000,
    physicalDamageDealtToChampions: 5_000,
    magicDamageDealtToChampions: 14_000,
    trueDamageDealtToChampions: 1_000,
    totalDamageTaken: 15_000,
    damageSelfMitigated: 8_000,
    damageDealtToObjectives: 3_000,
    damageDealtToTurrets: 1_000,
    totalMinionsKilled: 180,
    neutralMinionsKilled: 10,
    goldEarned: 12_000,
    goldSpent: 11_000,
    visionScore: 25,
    wardsPlaced: 10,
    wardsKilled: 3,
    detectorWardsPlaced: 2,
    visionWardsBoughtInGame: 2,
    timeCCingOthers: 20,
    totalTimeSpentDead: 45,
    longestTimeSpentLiving: 500,
    turretKills: 1,
    inhibitorKills: 0,
    dragonKills: 1,
    baronKills: 0,
    largestKillingSpree: 3,
    largestMultiKill: 2,
    doubleKills: 1,
    tripleKills: 0,
    quadraKills: 0,
    pentaKills: 0,
    firstBloodKill: false,
    firstBloodAssist: true,
    firstTowerKill: false,
    item0: 1,
    item1: 2,
    item2: 3,
    item3: 4,
    item4: 5,
    item5: 6,
    item6: 7,
    summoner1Id: 4,
    summoner2Id: 7,
    perks: {
      statPerks: { offense: 5008, flex: 5008, defense: 5001 },
      styles: [
        {
          description: "primaryStyle",
          style: 8000,
          selections: [{ perk: 8005, var1: 0, var2: 0, var3: 0 }],
        },
        { description: "subStyle", style: 8100, selections: [] },
      ],
    },
    challenges: { soloKills: 2, laneMinionsFirst10Minutes: 60, controlWardsPlaced: 4 },
    gameEndedInEarlySurrender: false,
    gameEndedInSurrender: false,
    ...overrides,
  };
}

function makeMatchDto(infoOverrides: Record<string, unknown> = {}): MatchDto {
  const participants = [
    makeParticipant({ puuid: "p1", teamId: 100, participantId: 1, kills: 5, goldEarned: 12_000 }),
    makeParticipant({ puuid: "p2", teamId: 100, participantId: 2, kills: 3, goldEarned: 9_000 }),
    makeParticipant({
      puuid: "p3",
      teamId: 200,
      participantId: 3,
      kills: 4,
      goldEarned: 11_000,
      win: false,
    }),
    makeParticipant({
      puuid: "p4",
      teamId: 200,
      participantId: 4,
      kills: 2,
      goldEarned: 8_000,
      win: false,
    }),
  ];

  return {
    metadata: { matchId: "NA1_1", participants: participants.map((p) => p.puuid as string) },
    info: {
      gameCreation: 1_700_000_000_000,
      gameDuration: 1_800,
      gameEndTimestamp: 1_700_001_800_000,
      gameStartTimestamp: 1_700_000_000_000,
      gameId: 1,
      gameMode: "CLASSIC",
      gameType: "MATCHED_GAME",
      gameVersion: "15.16.712.4923",
      mapId: 11,
      platformId: "NA1",
      queueId: 420,
      participants,
      teams: [
        {
          teamId: 100,
          win: true,
          bans: [{ championId: 99, pickTurn: 1 }],
          objectives: {
            baron: { first: false, kills: 0 },
            dragon: { first: true, kills: 2 },
            champion: { first: true },
            tower: { first: true, kills: 5 },
            inhibitor: { kills: 1 },
            riftHerald: { kills: 1 },
          },
        },
        { teamId: 200, win: false, objectives: {} },
      ],
      ...infoOverrides,
    },
  } as unknown as MatchDto;
}

describe("derivePatch", () => {
  it("réduit gameVersion à major.minor", () => {
    expect(derivePatch("15.16.712.4923")).toBe("15.16");
  });

  it("renvoie la chaîne telle quelle si elle n'a pas au moins deux segments", () => {
    expect(derivePatch("15")).toBe("15");
  });
});

describe("normalizeGameDurationS", () => {
  it("traite gameDuration comme des secondes quand gameEndTimestamp est présent (post-11.20)", () => {
    expect(normalizeGameDurationS(1_800, 1_700_001_800_000)).toBe(1_800);
  });

  it("traite gameDuration comme des millisecondes quand gameEndTimestamp est absent (match ancien)", () => {
    expect(normalizeGameDurationS(1_800_000, undefined)).toBe(1_800);
  });
});

describe("deriveIsRemake", () => {
  it("est vrai en cas de early surrender", () => {
    expect(deriveIsRemake(true, 1_800)).toBe(true);
  });

  it("est vrai sous 300s même sans early surrender déclaré", () => {
    expect(deriveIsRemake(false, 250)).toBe(true);
  });

  it("est faux sur une partie normale", () => {
    expect(deriveIsRemake(false, 1_800)).toBe(false);
  });
});

describe("computeTeamTotals", () => {
  it("additionne kills / dégâts / or par équipe", () => {
    const dto = makeMatchDto();
    const totals = computeTeamTotals(dto.info.participants);

    expect(totals.get(100)).toEqual({ kills: 8, damageToChampions: 40_000, goldEarned: 21_000 });
    expect(totals.get(200)).toEqual({ kills: 6, damageToChampions: 40_000, goldEarned: 19_000 });
  });
});

describe("normalizeMatch", () => {
  it("dérive patch, season_id et game_duration_s sur une partie normale", () => {
    const row = normalizeMatch(makeMatchDto(), "2026-08-20T00:00:00.000Z");

    expect(row.matchId).toBe("NA1_1");
    expect(row.patch).toBe("15.16");
    expect(row.seasonId).toBe("S15-split2");
    expect(row.gameDurationS).toBe(1_800);
    expect(row.isRemake).toBe(0);
    expect(row.endedInEarlySurrender).toBe(0);
  });

  it("marque is_remake sur une partie courte, sans re-tester la règle à l'affichage", () => {
    const dto = makeMatchDto({ gameDuration: 240, gameEndTimestamp: 1_700_000_240_000 });
    const row = normalizeMatch(dto, "2026-08-20T00:00:00.000Z");

    expect(row.gameDurationS).toBe(240);
    expect(row.isRemake).toBe(1);
  });
});

describe("normalizeTeams", () => {
  it("mappe les objectifs et convertit les booléens Riot en 0/1", () => {
    const rows = normalizeTeams(makeMatchDto());
    const blue = rows.find((r) => r.teamId === 100)!;
    const red = rows.find((r) => r.teamId === 200)!;

    expect(blue.win).toBe(1);
    expect(blue.dragonKills).toBe(2);
    expect(blue.firstBlood).toBe(1);
    expect(blue.bansJson).toBe(JSON.stringify([{ championId: 99, pickTurn: 1 }]));

    expect(red.win).toBe(0);
    expect(red.dragonKills).toBe(0);
    expect(red.firstBlood).toBe(0);
    expect(red.bansJson).toBeNull();
  });
});

describe("normalizeParticipants", () => {
  it("dénormalise les totaux d'équipe et promeut les champs challenges", () => {
    const rows = normalizeParticipants(makeMatchDto());
    const p1 = rows.find((r) => r.puuid === "p1")!;

    expect(p1.teamTotalKills).toBe(8);
    expect(p1.teamTotalGoldEarned).toBe(21_000);
    expect(p1.soloKills).toBe(2);
    expect(p1.laneMinionsFirst10).toBe(60);
    expect(p1.controlWardsPlaced).toBe(4);
    expect(p1.challengesJson).toBe(
      JSON.stringify({ soloKills: 2, laneMinionsFirst10Minutes: 60, controlWardsPlaced: 4 }),
    );
  });

  it("extrait les styles de runes et la keystone depuis perks", () => {
    const rows = normalizeParticipants(makeMatchDto());
    const p1 = rows.find((r) => r.puuid === "p1")!;

    expect(p1.perkPrimaryStyle).toBe(8_000);
    expect(p1.perkSubStyle).toBe(8_100);
    expect(p1.perkKeystone).toBe(8_005);
  });

  it("copie riotIdTagline (Riot) vers riotIdTagLine (colonne) sans le perdre", () => {
    const rows = normalizeParticipants(makeMatchDto());
    expect(rows[0]!.riotIdTagLine).toBe("NA1");
  });

  it("reste correct quand challenges est absent (match ancien, docs/DATA-MODEL.md § 4.4)", () => {
    const dto = makeMatchDto();
    dto.info.participants = dto.info.participants.map((p) => ({
      ...p,
      challenges: undefined,
    })) as typeof dto.info.participants;

    const rows = normalizeParticipants(dto);
    for (const row of rows) {
      expect(row.challengesJson).toBeNull();
      expect(row.soloKills).toBeNull();
      expect(row.laneMinionsFirst10).toBeNull();
      expect(row.controlWardsPlaced).toBeNull();
    }
  });
});
