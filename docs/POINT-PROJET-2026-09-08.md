# Point projet lol-stats — 2026-09-08

> Fichier de mise en contexte pour une nouvelle conversation Claude.
> À lire **après** `CLAUDE.md` (décisions figées) et `TASKS.md` (lots).
> Ce fichier décrit l'**état d'avancement** à la date ci-dessus, pas les décisions.

---

## 0. TL;DR — à traiter en priorité

1. **🔴 L'ingestion est à l'arrêt depuis le 2026-08-26 (~13 jours).**
   - La tâche planifiée Windows **n'existe plus** (`Get-ScheduledTask` ne renvoie
     rien pour `lol-stats` / `ingest`).
   - Dernier log : `data/logs/ingest-2026-08-26.log`. Base (`data/lol-stats.db`)
     inchangée depuis le 26/08 21:18.
   - C'est exactement le risque R1/R2 de `docs/HANDOFF.md`. Chaque jour compte.
   - **Clé de dev très probablement expirée** (durée de vie 24 h) — il faut en
     recoller une fraîche dans `.env.local` avant tout run.

2. **🔴 `better-sqlite3` ne charge plus.** Node a été mis à jour sur le poste
   (`v24.19.0`, `NODE_MODULE_VERSION 137`). Le binaire natif est compilé pour
   `NODE_MODULE_VERSION 127`. Tant que ce n'est pas corrigé, `npm run ingest`,
   `npm run db:migrate` et l'accès DB du serveur échouent au démarrage.
   - Correctif : `npm rebuild better-sqlite3` (ou `npm install`).

3. **Remettre l'ingestion en route** = ordre : (a) `npm rebuild better-sqlite3`,
   (b) coller une clé Riot valide dans `.env.local`, (c) `npm run ingest` manuel
   pour rattraper, (d) ré-enregistrer la tâche : `.\scripts\windows\register-task.ps1`,
   (e) vérifier un passage `0x0` dans le Planificateur.

Le reste (travail UI en cours) est secondaire tant que ces trois points ne sont
pas réglés — c'est la hiérarchie imposée par `CLAUDE.md` § 1.

---

## 1. Avancement par lot (`TASKS.md`)

| Lot | État | Détail |
|---|---|---|
| **L0 — Amorçage** | ✅ Fait | Commit `53f1bd0`. Next 15 App Router + TS, Drizzle, `better-sqlite3`, `tsx`, `zod`, `dotenv`, Vitest. Scripts `package.json` en place, serveur lié `127.0.0.1`. |
| **L1 — Collecteur** | ✅ Fait & validé | Commits `0b1eb3e`, `e412266`. Backfill réel effectué (base = 19 Mo). Schéma complet (`src/db/schema.ts`, 14 tables dont `match_timelines` vide). Limiter + client Riot + DTO zod + `scripts/ingest/*` (lock, config, discover, run, db-helpers). Codes de sortie 0/1/2/3/4. 23 tests Vitest passent. |
| **L2 — Ordonnancement Windows** | ⚠️ Code fait, **tâche non enregistrée** | Commit `20a390d`. `scripts/windows/run-ingest.ps1` + `register-task.ps1` présents. Les logs 21→26/08 montrent des runs planifiés réussis (code 0). **Mais la tâche a disparu du Planificateur** — à ré-enregistrer. |
| **L3 — Assets Data Dragon** | ❌ Pas commencé | `scripts/sync-assets.ts` est un stub. Aucun asset local. Table `asset_versions` existe. |
| **L4 — Agrégation + état de filtre** | ❌ Pas commencé | `src/lib/filters/` et `src/db/queries/` vides (`.gitkeep`). `src/lib/stats/` contient seulement `seasons.ts` + `sanity.test.ts`. `wilson.ts`, `sessions.ts`, `buckets.ts` à écrire. Pas de vue SQL `v_ranked_participants`. |
| **L5 — Système de design** | 🔨 **En cours, non commité** | Voir § 2. |
| **L6 — Vue personnelle** | ❌ Pas commencé | Dépend de L3+L4+L5. |
| **L7 — Comparatif** | ❌ Pas commencé | Table `player_lookups` existe. |
| **L8 — Filtres + perf** | ❌ Pas commencé | |
| **L9 — Finition** | ❌ Pas commencé | |
| **L10 — Timelines (v2)** | ❌ Reporté v2 | Colonne `timeline_fetched_at` + index partiel déjà en base. |

**Chemin critique `L0 → L1 → L2` : techniquement livré, mais L2 est cassé en
prod (tâche absente).** L'hémorragie de données n'est PAS arrêtée aujourd'hui.

---

## 2. L5 — Système de design : ce qui est fait (non commité)

Travail présent dans le working tree, **pas encore commité, pas encore audité
par `frontend-critic`** (obligatoire avant L6 selon `TASKS.md` L5).

Fichiers nouveaux / modifiés :

```
 M src/app/layout.tsx        → importe fonts + globals.css, applique fontVariables sur <html>
 M eslint.config.mjs         → ignore .next/** et next-env.d.ts
?? src/app/fonts.ts          → next/font : Archivo (axe wdth, "expanded"), Inter, JetBrains Mono
?? src/styles/tokens.css     → TOUS les tokens de CLAUDE.md § 2.1/2.2/2.3/2.5
?? src/styles/globals.css    → reset + fond --void + focus-ring global --frost + tabular-nums
?? src/app/design-system/    → page.tsx : démo de chaque primitive (données factices, 0 requête DB)
?? src/components/primitives/ → Module, StatTile, DataTable, Skeleton (+ ModuleSkeleton),
                                EmptyState, ErrorState, ConfidenceBadge (+ index.ts)
```

Conformité observée aux décisions figées :
- Palette, échelle divergente, densité, durées de mouvement : tokens fidèles à `CLAUDE.md` § 2.1.
- `prefers-reduced-motion` traité **une seule fois** dans `tokens.css` (durées → 0ms).
- Focus ring global `--frost`, jamais un accent (§ 2.1 règle 5). ✅
- Résultat unitaire encodé par la **forme** (pastille pleine/évidée) dans la démo DataTable (§ 2.1 règle 3). ✅
- `tabular-nums` sur `body`, mono réservé aux identifiants. ✅

Restes L5 avant de le considérer terminé :
- **`frontend-critic` sur les primitives** (bloquant avant L6).
- Vérifier le rendu réel des polices (Archivo « Expanded » via axe `wdth` de la
  variable Google Font — approche à valider visuellement, cf. commentaire dans `fonts.ts`).
- `DataTable` : vérifier la virtualisation réelle au-delà de 200 lignes.
- Naviguer la page `/design-system` entièrement au clavier (critère de sortie L5).
- Commit.

---

## 3. État technique / environnement

| Point | État |
|---|---|
| Node | `v24.19.0` sur le poste. **`better-sqlite3` à recompiler** (`npm rebuild better-sqlite3`). |
| `.env.local` | Présent. Contenu non inspecté (interdit). Clé de dev = 24 h → sans doute expirée. |
| Base | `data/lol-stats.db`, 19 Mo, dernière écriture 2026-08-26. Non versionnée (git-ignorée). |
| Migrations | 1 migration : `drizzle/0000_living_rockslide.sql` + snapshot. Schéma stable. |
| Tests | Vitest : **23 tests / 3 fichiers, tous verts** (`limiter.test.ts`, `normalize.test.ts`, `stats/sanity.test.ts`). |
| Sous-agents | `.claude/agents/` contient `frontend-critic`, `perf-auditor`, `qa-tester` → `init-claude-dir.ps1` a été lancé. À confirmer avec `/agents`. |
| Skills | Statut inconnu — vérifier `/skills` (les 8 noms doivent apparaître ; sinon lancer le script de liaison, `TODO.md` point 1). `apple-design` nécessaire pour la finition L5/L6. |
| Playwright | Pas installé / pas de tests écrits (prévu L9). |
| Tâche planifiée Windows | **Absente.** |
| Assets Data Dragon | Absents. |
| Logs | Encodage encore cassé (accents illisibles, UTF-16/BOM) — dernière ligne de `TODO.md`. |

---

## 4. `TODO.md` — actions utilisateur, statut estimé

1. Lier les 8 skills → **à vérifier** (`/skills`).
2. Créer `.claude/` du projet → **fait** (agents présents).
3. Clé de dev Riot (toutes les 24 h) → **à refaire maintenant** (expirée).
4. Demande de clé **personnelle** Riot → **statut inconnu** — à confirmer avec l'utilisateur.
   Tant qu'elle n'est pas accordée, corvée quotidienne du point 3.
5. Tâche planifiée Windows → **à refaire** (`register-task.ps1`), la tâche a disparu.
6. Bibliothèque de graphiques → défaut **Recharts + SVG custom** appliqué (pas encore installé, L4/L6).
7. Permissions périmées `settings.local.json` → non traité (workspace, hors projet).
8. Migration des projets à la racine du workspace → hors projet lol-stats.

---

## 5. Décisions arrêtées — rappel condensé

(Détail complet et raisons : `CLAUDE.md` § 2 et § 6, `docs/HANDOFF.md` § 3.)

- **Priorité absolue** : collecteur > base > dashboard. Un arbitrage « finir une
  vue » vs « sécuriser l'ingestion » → l'ingestion gagne toujours.
- **Compte** : `TikaSama#DME`, NA, `na1`/`americas`, files **420 et 440 uniquement**.
  Affichage `America/Toronto`. Toute autre file est hors périmètre partout.
- **Stack** : Next.js App Router + TS · SQLite (`better-sqlite3`, WAL) + Drizzle ·
  collecteur = script Node autonome (aucun import de Next) · Recharts + SVG custom ·
  Vitest + Playwright.
- **Direction visuelle « La Faille »** : densité op.gg + rigueur Linear/Vercel.
  Fond sombre mais **système sémantique multi-chroma** (pas un seul accent néon).
  - Neutres `--void #0B0F17` → `--frost #E6EAF2` (élévation par filet 1px, pas par luminance).
  - Accents à sens unique : `--self #E9B64C` (= « moi », jamais victoire), `--rival #A88FF5`
    (+ hachure obligatoire), `--win`/`--loss` (écarts **agrégés** seulement),
    `--side-blue`/`--side-red` (côté de carte **uniquement**), `--focus #E6EAF2`.
  - Résultat de partie unitaire = **forme** (pastille pleine/évidée en `--mist`).
  - Typo 3 rôles : Archivo Expanded (display, capitales, tracking **+0.06em**),
    Inter 13–14px `tabular-nums` (corps + chiffres de tableaux), JetBrains Mono
    (identifiants largeur fixe seulement).
  - Élément signature = carré de la Faille à 45°, 5 nœuds à leur position réelle,
    aire ∝ parties, remplissage = winrate divergent, hachure si Wilson 95 % contient 50 %.
    Comparatif = **mode delta** (recoloration), jamais de second polygone.
  - Layout : barre de filtres globale sérialisée dans l'URL (source de vérité unique),
    rail d'identité 280px à gauche, canvas dense à droite. *Scope override* local
    autorisé par exception (badgé, réinitialisable en 1 clic, n'altère pas l'état global).
  - Mouvement « marqué » mais justifié : tween réservé aux ≤ 8 KPI d'en-tête,
    flash 400ms sur cellules changées, stagger au 1er montage seulement,
    `prefers-reduced-motion` → 0ms sans exception.
- **Interdits** : les 3 rendus « IA générique », marqueurs `01/02/03`, hero centré
  + 3 cartes + CTA, la 3D, tout effet décoratif sans justification par la donnée.
- **Base** : aucun ratio stocké (kda/dpm/winrate se recalculent en SQL). Seule
  entorse : 3 totaux d'équipe dénormalisés sur `match_participants`.
- **Sécurité** : clé Riot jamais côté navigateur, aucun `NEXT_PUBLIC_*` secret,
  serveur `-H 127.0.0.1`, validation stricte du Riot ID côté serveur, rate limiting
  sur les endpoints internes.

---

## 6. Prochaines étapes recommandées (dans l'ordre)

1. **Réparer et relancer l'ingestion** (§ 0). Ré-enregistrer la tâche planifiée
   le jour même. Corriger l'encodage des logs au passage.
2. **Finir L5** : audit `frontend-critic` sur les primitives, corrections, commit.
3. **L3** (assets Data Dragon) — débloque L6/L7, indépendant de L4.
4. **L4** (agrégation + `FilterState` + `wilson.ts` + vue `v_ranked_participants`)
   — le gros morceau, tout le dashboard en dépend.
5. **L6** (vue personnelle + élément signature « La Faille »), audit `frontend-critic`.
6. L7 → L8 → L9.

---

## 7. Fichiers à lire en début de session

| Fichier | Pour quoi |
|---|---|
| `CLAUDE.md` | Décisions figées (visuel + technique). Autonome, fait autorité. |
| `TASKS.md` | Les 11 lots L0–L10 + graphe de dépendances + critères de sortie. |
| `TODO.md` | Actions hors périmètre Claude Code (clés Riot, tâche planifiée). |
| `docs/HANDOFF.md` | Audit de mise en place, 10 risques classés, arbitrages A–E. |
| `docs/ARCHITECTURE.md` | 3 processus, flux d'ingestion en 5 étapes, rate limiting, codes de sortie. |
| `docs/DATA-MODEL.md` | 14 tables, règle brut/calculé, 8 pièges de la donnée Riot, Wilson. |
| **ce fichier** | État d'avancement au 2026-09-08. |
