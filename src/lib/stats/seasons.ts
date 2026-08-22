// Découpage des saisons — docs/DATA-MODEL.md § 4.7.
// Riot ne renvoie pas de `seasonId` dans match-v5 : on le dérive du patch.
//
// Dette assumée, volontairement localisée ici : le patch majeur suit
// l'année (`14.x` → 2024, `15.x` → 2025, `16.x` → 2026 — confirmé par
// l'exemple `15.16` de CLAUDE.md § 2.2) et chaque saison se découpe en 3
// splits d'environ 8 patches. Si Riot change la cadence, c'est ce fichier
// — et lui seul — qu'il faut ajuster.
const PATCHES_PER_SPLIT = 8;
const SPLITS_PER_SEASON = 3;

export function deriveSeasonId(patch: string): string {
  const match = /^(\d+)\.(\d+)/.exec(patch);
  if (!match) {
    console.warn(`[seasons] patch de forme inattendue : "${patch}" — season_id="unknown"`);
    return "unknown";
  }
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const split = Math.min(SPLITS_PER_SEASON, Math.max(1, Math.ceil(minor / PATCHES_PER_SPLIT)));
  return `S${major}-split${split}`;
}
