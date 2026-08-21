# Lots livrables — lol-stats

Ordre imposé par une seule contrainte : **l'API Riot ne conserve que ~2 ans
d'historique**. Chaque jour sans ingestion est de la donnée perdue pour
toujours. Le collecteur passe donc avant toute interface.

Un lot est terminé quand il est **utilisable seul** — pas quand le code
compile.

```
L0 ──▶ L1 ──▶ L2 ──▶ L4 ──┬──▶ L6 ──▶ L8 ──▶ L9
        │             │    │
        └──▶ L3 ──────┘    └──▶ L7
                                  │
                            L5 ───┘
                            (L5 ne dépend que de L0)

                     L10 (v2) ──▶ dépend de L1 + L2
```

---

## L0 — Amorçage
**Dépend de** : rien. **Bloque** : tout.

- `create-next-app` (App Router, TypeScript, sans Tailwind par défaut — voir L5).
- `better-sqlite3`, `drizzle-orm`, `drizzle-kit`, `tsx`, `zod`, `dotenv`.
- Scripts `package.json` : `dev` et `start` avec `-H 127.0.0.1`, `ingest`,
  `sync-assets`, `db:generate`, `db:migrate`.
- `.env.local` depuis `.env.example`, vérification que la clé est lue.
- Vitest configuré.

**Fini quand** : `npm run dev` sert une page vide sur `http://127.0.0.1:3000`
et **refuse** de répondre sur l'IP de la machine.

---

## L1 — Le collecteur ★ premier lot livré
**Dépend de** : L0. **Bloque** : L2, L3, L4, L10.

- `src/db/schema.ts` complet (toutes les tables de `docs/DATA-MODEL.md`,
  y compris `match_timelines` vide) + première migration.
- `src/lib/riot/limiter.ts` : deux seaux à fenêtre glissante (20/1s, 100/120s),
  reconfiguration à chaud depuis `X-App-Rate-Limit` et `X-Method-Rate-Limit`,
  comptabilité séparée par méthode.
- `src/lib/riot/client.ts` : `403 → ExpiredApiKeyError`, `429 → Retry-After`,
  `5xx → backoff exponentiel`, `404 → ingest_failures`.
- `src/lib/riot/dto.ts` : schémas zod de `AccountDto`, `MatchDto`, `LeagueEntryDto`.
  Un champ inattendu ne fait pas planter le run, il est journalisé.
- `scripts/ingest.ts` : verrou → pré-vol → découverte incrémentale par file →
  récupération chronologique → snapshot de rang → curseur → `ingest_runs`.
- Normalisations à l'ingestion : `game_duration_s`, `patch`, `season_id`,
  `is_remake`, totaux d'équipe dénormalisés.
- Codes de sortie 0/1/2/3/4 (voir `docs/ARCHITECTURE.md` § 9).

**Fini quand** : deux runs consécutifs sur l'historique complet donnent le même
nombre de lignes, le second ne fait aucun appel `match/detail`, et une clé
volontairement invalidée produit le code 3 avec un message lisible.

**Ne pas commencer L2 sans avoir lancé un backfill complet réel.**

---

## L2 — Ordonnancement Windows
**Dépend de** : L1. **Bloque** : rien (mais c'est ce lot qui met fin à la perte
de données).

- `scripts/windows/run-ingest.ps1` : cwd, exécution, log daté sous
  `data/logs/`, propagation du code de sortie.
- `scripts/windows/register-task.ps1` : enregistre la tâche via
  `Register-ScheduledTask`, toutes les 30 min, « exécuter dès que possible
  après un démarrage manqué », sans fenêtre visible.
- Rotation des logs au-delà de 30 jours.
- Documentation de la désinscription.

**Fini quand** : la tâche apparaît dans le Planificateur, tourne session
verrouillée, et deux déclenchements rapprochés ne produisent qu'un seul run
(verrou).

---

## L3 — Assets Data Dragon en local
**Dépend de** : L1 (table `asset_versions`). **Bloque** : L6, L7.

- `scripts/sync-assets.ts` : version courante, `champion.json`, `item.json`,
  `summoner.json`, `runesReforged.json` + images sous
  `public/assets/ddragon/{version}/`.
- Helper `assetUrl()` unique côté front. Aucun hotlink CDN.
- Fallback visible (silhouette) si un asset manque, jamais d'image cassée.

**Fini quand** : le site rend correctement avec le réseau coupé.

---

## L4 — Couche d'agrégation et état de filtre
**Dépend de** : L1. **Bloque** : L6, L7, L8.

- `src/lib/filters/` : type `FilterState` (saison, patch, file, champion, rôle,
  plage de dates), parsing/sérialisation URL, valeurs par défaut.
- Vue SQL `v_ranked_participants` appliquant l'exclusion des remakes en un seul
  endroit.
- `src/db/queries/` : une fonction par module de l'UI, chacune prenant
  `FilterState` et renvoyant un type explicite.
- `src/lib/stats/` : `wilson.ts`, `seasons.ts`, `sessions.ts`, `buckets.ts` —
  fonctions pures, testées sans base.
- Tests Vitest sur une base de fixtures (≈ 200 matchs synthétiques).

**Fini quand** : chaque agrégation répond en < 50 ms sur 5 000 matchs
(`EXPLAIN QUERY PLAN` sans `SCAN TABLE` sur les chemins chauds) et Wilson est
appliqué partout où un winrate est trié.

---

## L5 — Système de design
**Dépend de** : L0 seulement. **Peut être mené en parallèle de L1–L4.**
**Bloque** : L6, L7.

- Tokens CSS de `CLAUDE.md` § 2.1 (surfaces, accents, échelle divergente,
  échelle de densité).
- Polices : Archivo Expanded, Inter, JetBrains Mono, chargées localement
  (`next/font`), sous-ensembles latins.
- Primitives : `Module` (carte + filet), `StatTile`, `DataTable`
  (virtualisée, `tabular-nums`), `Skeleton` calqué sur la forme finale,
  `EmptyState`, `ErrorState`, `ConfidenceBadge`.
- Anneau de focus `--focus` global et visible sur **tous** les interactifs.
- Réglages de mouvement centralisés + `prefers-reduced-motion` traité une
  seule fois, à la racine.
- **`frontend-critic` sur les primitives avant L6.**

**Fini quand** : une page de démonstration montre chaque primitive dans ses
états (chargement / vide / erreur / dense), navigable entièrement au clavier.

---

## L6 — Vue personnelle
**Dépend de** : L3, L4, L5.

- Rail d'identité : Riot ID, rang par file (depuis `rank_snapshots`), série en
  cours, volume de la sélection, **santé de l'ingestion** (dernier run, âge,
  statut).
- **La Faille** — l'élément signature. SVG custom : demi-plans bleu/rouge à
  faible alpha, 5 nœuds à leur position réelle, aire ∝ parties, remplissage =
  winrate divergent, hachure si l'intervalle de Wilson contient 50 %.
- KPI d'en-tête (≤ 8) avec tween au changement de filtre.
- Modules : winrate global et par file, meilleurs champions (tri Wilson),
  meilleur rôle, évolution dans le temps, répartition des rôles, séries.
- Métriques : dégâts /partie et /min, part des dégâts, CS/min, or/min, KDA,
  kill participation, vision/min, durée moyenne, winrate par champion / rôle /
  côté / durée.

**Fini quand** : `frontend-critic` ne renvoie plus de problème bloquant.

---

## L7 — Comparatif
**Dépend de** : L3, L4, L5.

- Recherche par Riot ID : validation serveur stricte, cache `player_lookups`,
  seau à jetons 10/min et 60/h, `429` explicite côté UI.
- Vue côte à côte, l'adversaire en `--rival` **avec hachure**, jamais teinte
  seule.
- **La Faille en mode delta** : recoloration par écart, barrettes de volume,
  aucun second polygone.
- Un joueur sans historique commun est marqué `is_tracked = 1` ; son historique
  est ingéré par le **collecteur** au run suivant, jamais par la requête web.
  L'UI l'annonce clairement.

**Fini quand** : rechercher un joueur inexistant, un format invalide et 20 fois
d'affilée le même joueur produisent trois messages distincts et zéro appel Riot
superflu.

---

## L8 — Filtres complets et performance
**Dépend de** : L4, L6.

- Barre de filtres globale complète, état dans l'URL, historique navigateur.
- *Scope override* par module : badgé, réinitialisable en un clic, sans effet
  sur l'état global.
- Virtualisation au-delà de 200 lignes ; tri **en SQL**.
- Bornage du nombre de points de graphique (agrégation jour/semaine).
- **`perf-auditor`** sur la vue la plus dense.

**Fini quand** : changer de filtre sur 5 000 matchs repeint en < 150 ms et le
tableau reste à 60 fps au scroll.

---

## L9 — Finition
**Dépend de** : L6, L7, L8.

- Stagger d'entrée au premier montage uniquement, ≤ 300 ms.
- Flash de surlignage sur cellules modifiées (400 ms) au lieu d'un tween de
  tableau.
- Squelettes définitifs, états vide/erreur sur chaque module.
- Raccourcis clavier (`/` recherche, `f` filtres, `?` aide) — la référence
  Linear l'implique.
- Mobile propre en une colonne (secondaire, mais pas cassé).
- Playwright : parcours principaux + captures aux tailles réelles.
- `frontend-critic` **et** `perf-auditor` avant de déclarer la v1.

---

## L10 — Timelines (v2)
**Dépend de** : L1, L2. **Ne pas commencer avant que la v1 soit stable.**

- `scripts/backfill-timelines.ts`, alimenté par
  `WHERE timeline_fetched_at IS NULL AND queue_id = 420`, ordre chronologique
  décroissant (le récent d'abord).
- Budget d'appels par run explicitement plafonné, pour ne pas affamer
  l'ingestion courante — l'ingestion des nouveaux matchs reste prioritaire.
- Métriques débloquées : CS@10, gold diff@15, XP diff@15, courbes intra-partie.

---

## Chemin critique

`L0 → L1 → L2` est le seul chemin qui arrête l'hémorragie de données.
Tout le reste peut attendre. Si une seule chose est faite cette semaine, c'est
celle-là.
