# Architecture — lol-stats

## 1. Les trois processus

Le projet est **trois programmes** qui ne partagent qu'un fichier SQLite et
deux modules de code. La frontière est stricte et volontaire : le collecteur
doit survivre à n'importe quelle réécriture du front.

```
┌────────────────────────────────────────────────────────────────────┐
│  1. COLLECTEUR          scripts/ingest.ts                          │
│     Process Node autonome, sans Next.                              │
│     Déclenché par le Planificateur de tâches Windows.              │
│     Seul composant autorisé à écrire dans les tables de match.     │
│     Seul composant qui détient la clé Riot en dehors du serveur.   │
└──────────────────────────────┬─────────────────────────────────────┘
                               │ écrit
                    ┌──────────▼───────────┐
                    │  data/lol-stats.db   │   SQLite, WAL
                    │  (jamais purgée)     │
                    └──────────▲───────────┘
                               │ lit
┌──────────────────────────────┴─────────────────────────────────────┐
│  2. API INTERNE / SERVEUR    src/app/**  (React Server Components  │
│     + un petit nombre de route handlers)                           │
│     Lit SQLite en direct. N'appelle Riot que pour la recherche     │
│     d'un joueur inconnu (vue comparative).                         │
│     Lié à 127.0.0.1.                                               │
└──────────────────────────────┬─────────────────────────────────────┘
                               │ HTML + JSON, jamais de clé
┌──────────────────────────────▼─────────────────────────────────────┐
│  3. FRONT                    Client components                     │
│     Ne connaît que l'état de filtre (dans l'URL) et des données    │
│     déjà agrégées. Aucun accès direct à Riot.                      │
└────────────────────────────────────────────────────────────────────┘
```

Modules partagés — et eux seuls :

- `src/lib/riot/` : client HTTP, rate limiter, types de DTO, erreurs typées.
- `src/db/` : schéma Drizzle, connexion, migrations.

`scripts/ingest.ts` **n'importe jamais** quoi que ce soit sous `src/app/`.
Un `import` dans ce sens est un bug d'architecture, pas un détail de style.

---

## 2. Arborescence

```
lol-stats/
├─ CLAUDE.md              décisions figées (visuel + technique)
├─ README.md              démarrage
├─ TASKS.md               lots livrables, ordonnés
├─ TODO.md                ce qui incombe à l'utilisateur
├─ .env.example
├─ .gitignore
├─ .claude/
│  ├─ agents/             frontend-critic, perf-auditor, qa-tester
│  └─ settings.json
├─ docs/
│  ├─ ARCHITECTURE.md     ce fichier
│  ├─ DATA-MODEL.md       tables et raisonnement brut/calculé
│  └─ HANDOFF.md          audit de mise en place
├─ data/                  lol-stats.db (git-ignoré) + logs d'ingestion
├─ drizzle/               migrations SQL générées
├─ scripts/
│  ├─ ingest.ts           le collecteur
│  ├─ sync-assets.ts      téléchargement Data Dragon
│  ├─ backfill-timelines.ts   (v2)
│  └─ windows/
│     ├─ run-ingest.ps1        wrapper appelé par le Planificateur
│     └─ register-task.ps1     enregistre la tâche planifiée
├─ public/assets/ddragon/ images servies en local
└─ src/
   ├─ app/                App Router (pages + route handlers)
   ├─ components/         UI (dont la Faille)
   ├─ db/                 schema.ts, client.ts, queries/
   ├─ lib/
   │  ├─ riot/            client, limiter, dto, errors
   │  ├─ stats/           agrégations pures, testables sans DB
   │  └─ filters/         parsing/sérialisation de l'état de filtre
   └─ styles/             tokens, thème
```

---

## 3. Flux d'ingestion

`npm run ingest` — un run complet, idempotent, réentrant.

```
0. VERROU
   Lockfile data/.ingest.lock (PID + timestamp).
   Verrou présent et frais (< 2 h) → sortie code 0, log "déjà en cours".
   Le Planificateur peut déclencher toutes les 30 min sans jamais empiler
   deux runs.

1. PRÉ-VOL
   Lecture de RIOT_API_KEY. Absente → erreur de configuration, code 2.
   Un appel account-v1 sur le compte principal :
     403 → ExpiredApiKeyError, code 3, message explicite. Le run est marqué
           status='expired_key' dans ingest_runs. Pas de faux succès.
     ok  → puuid résolu et rafraîchi en base (le Riot ID peut changer,
           le puuid non).

2. DÉCOUVERTE (par file : 420 puis 440)
   GET /lol/match/v5/matches/by-puuid/{puuid}/ids
       ?queue={q}&startTime={curseur}&start={n}&count=100
   Pagination jusqu'à épuisement ou jusqu'à ne plus rien voir de nouveau.
   startTime vient de ingest_cursors.last_match_end_ms - 6 h (marge de
   sécurité : une partie longue peut apparaître après le curseur).
   Les IDs déjà présents dans matches sont filtrés en mémoire, en une seule
   requête SQL. Aucun match connu ne repart en fetch.

3. RÉCUPÉRATION
   Pour chaque ID inconnu, dans l'ordre chronologique croissant :
   GET /lol/match/v5/matches/{matchId}
   Écriture en transaction : matches + match_raw + match_teams +
   match_participants (les 10 joueurs) + players (upsert léger).
   L'ordre chronologique croissant est délibéré : si le run est interrompu,
   le curseur reste valide et la reprise ne redemande que la queue restante.

4. SNAPSHOT DE RANG   ← irremplaçable
   GET /lol/league/v4/entries/by-puuid/{puuid}   (routage na1)
   Insertion dans rank_snapshots.
   league-v4 ne renvoie que l'état COURANT : Riot ne conserve aucun
   historique de LP. Si le collecteur ne prend pas ce cliché à chaque run,
   la courbe de progression de LP est perdue à jamais — elle n'est pas
   reconstructible depuis les matchs.

5. CURSEUR & JOURNAL
   ingest_cursors mis à jour par (puuid, queue_id).
   ingest_runs clôturé : durée, matchs découverts, matchs écrits, appels API,
   temps passé en attente de rate limit, erreur éventuelle.
   Libération du verrou (y compris via un handler sur SIGINT/SIGTERM et
   process.on('exit')).
```

**Idempotence** : toutes les écritures sont des `INSERT ... ON CONFLICT DO
UPDATE` sur clés naturelles (`match_id`, `(match_id, puuid)`). Relancer un run
deux fois de suite ne produit ni doublon ni divergence.

**Premier run (backfill)** : le curseur est vide, l'historique complet est
demandé. À ~700 appels pour 2 ans de ranked et 100 req/2 min, le backfill dure
environ 15–25 min. Il est interruptible : chaque match écrit est acquis.

---

## 4. Rate limiting sortant (vers Riot)

Deux paliers simultanés, tous deux respectés :

| Palier | Limite clé de dev | Implémentation |
|---|---|---|
| Court | 20 requêtes / 1 s | Seau à jetons, fenêtre glissante 1 s |
| Long | 100 requêtes / 120 s | Seau à jetons, fenêtre glissante 120 s |

Comportement :

- **Fenêtre glissante réelle**, pas un `setTimeout` fixe : on garde les
  horodatages des N derniers appels et on attend le plus ancien.
- **Les en-têtes de réponse font autorité sur la configuration locale.**
  `X-App-Rate-Limit` / `X-App-Rate-Limit-Count` et `X-Method-Rate-Limit` /
  `X-Method-Rate-Limit-Count` sont lus à chaque réponse et **reconfigurent les
  seaux à chaud**. Une clé personnelle accordée plus tard sera donc exploitée
  à son vrai débit sans changement de code.
- **Limiteur par méthode** : les paliers method-level sont suivis séparément
  par endpoint (`match/ids`, `match/detail`, `league/entries`), parce que Riot
  les compte séparément.
- **429** : attente de `Retry-After` (secondes) + 250ms de marge, puis
  réessai. 3 tentatives, puis abandon du seul match concerné — le run
  continue, l'échec est journalisé. Un match manquant sera repris au run
  suivant : la découverte est basée sur ce qui est en base, pas sur le curseur
  seul.
- **5xx / timeout réseau** : backoff exponentiel 1s / 2s / 4s, 3 tentatives.
- **403** : jamais de réessai. `ExpiredApiKeyError` immédiate, le run s'arrête.
- **404** sur un match : journalisé, match ignoré définitivement (partie
  purgée côté Riot), inscrit dans `ingest_failures` pour ne pas le redemander
  à chaque run.

Concurrence : **1 requête à la fois**. Sur une clé à 100 req/2 min, le
parallélisme n'apporte aucun débit et complique la comptabilité des en-têtes.

---

## 5. Rate limiting entrant (mes propres endpoints)

Le seul endpoint qui peut déclencher un appel Riot depuis le navigateur est la
recherche de joueur de la vue comparative. Il est protégé à trois niveaux :

1. **Validation** avant tout : format `nom#tag`, gameName 3–16 caractères,
   tagLine 3–5, jeu de caractères restreint. Rejet en `400` sans appel Riot.
2. **Cache en base** : table `player_lookups` (`game_name`, `tag_line`) → puuid,
   TTL 24 h. Un Riot ID déjà résolu ne repart jamais chez Riot.
3. **Seau à jetons en mémoire** : 10 recherches / minute, 60 / heure, pour le
   process. Dépassement → `429` avec le délai restant. Un rafraîchissement
   compulsif dégrade l'UI locale, jamais le quota Riot.

L'ingestion de l'historique d'un joueur comparé est **hors ligne** : la
recherche ne récupère que son puuid et son rang. Ses matchs communs sont déjà
en base (il apparaît dans `match_participants` s'il a croisé le compte
principal). Comparer un joueur sans historique commun est une action explicite
qui met le joueur dans `players.is_tracked = 1`, et c'est le **collecteur**,
au run suivant, qui ingère son historique — jamais une requête web.

---

## 6. Stratégie de cache et de lecture

| Niveau | Ce qui est mis en cache | Invalidation |
|---|---|---|
| SQLite | La donnée elle-même — c'est le cache primaire | Jamais (append-only) |
| Index SQL | Voir `docs/DATA-MODEL.md` § index | — |
| RSC / `unstable_cache` | Résultat des agrégations, clé = état de filtre sérialisé | `revalidateTag('matches')` après un run d'ingestion, ou TTL 5 min |
| `player_lookups` | Riot ID → puuid | TTL 24 h |
| Assets Data Dragon | Fichiers sur disque sous `public/assets/ddragon/{version}/` | Manuelle (`npm run sync-assets`) |

**Où se fait l'agrégation** : en **SQL**, pas en JavaScript. Sur quelques
milliers de lignes, SQLite avec les bons index répond en quelques
millisecondes ; charger les lignes en mémoire pour les réduire en JS serait
plus lent et non paginable. `src/lib/stats/` contient les fonctions pures
(intervalle de Wilson, buckets de durée, détection de session) qui s'appliquent
**après** l'agrégation SQL, et qui sont testables sans base.

Vues matérialisées : **non en v1**. Si un jour un module dépasse 100ms, le
levier est une table d'agrégat rafraîchie par le collecteur, pas un cache
applicatif. C'est noté, pas fait.

**Fluidité du front** : tableaux de plus de 200 lignes virtualisés
(`@tanstack/react-virtual`), tri fait en SQL et non en JS, graphiques limités
à un nombre de points borné (agrégation par jour/semaine selon la plage).

---

## 7. Assets

`npm run sync-assets` :

1. `GET https://ddragon.leagueoflegends.com/api/versions.json` → version la
   plus récente.
2. Télécharge `champion.json`, `item.json`, `summoner.json`, `runesReforged.json`
   et les images correspondantes sous `public/assets/ddragon/{version}/`.
3. Écrit la version dans la table `asset_versions`.

Le front référence toujours `/assets/ddragon/{version}/...`. Aucune requête ne
sort vers un CDN à l'affichage : le site fonctionne hors ligne.
CommunityDragon sert de complément pour ce que Data Dragon ne publie pas
(icônes d'augments, certains splash) — même règle : téléchargé, servi local.

---

## 8. Sécurité — points de contrôle

- `RIOT_API_KEY` n'est lue que dans `scripts/ingest.ts` et dans les route
  handlers serveur. **Aucune variable `NEXT_PUBLIC_*` ne contient de secret.**
  Un test automatisé vérifie qu'aucun bundle client ne contient la sous-chaîne
  `RGAPI-`.
- Écoute sur `127.0.0.1` en dev **et** en production locale :
  `next dev -H 127.0.0.1` / `next start -H 127.0.0.1`.
- Pas de CORS, pas d'en-tête `Access-Control-Allow-Origin`.
- `.env.local` git-ignoré ; `.env.example` ne contient que des placeholders.
- La base est un fichier local sous `data/`, git-ignoré. Sauvegarde
  recommandée : copie du `.db` + `.db-wal` après arrêt propre, ou
  `VACUUM INTO`.
- Aucune donnée ne sort de la machine.

---

## 9. Ordonnancement Windows

Le Planificateur de tâches appelle `scripts/windows/run-ingest.ps1`, qui :

1. se place dans le dossier du projet ;
2. lance `npm run ingest` ;
3. redirige stdout/stderr vers `data/logs/ingest-{yyyy-MM-dd}.log` ;
4. propage le code de sortie.

Codes de sortie — le Planificateur les rend visibles dans son historique :

| Code | Sens |
|---|---|
| 0 | Succès (y compris « rien de nouveau » et « déjà en cours ») |
| 2 | Configuration invalide (clé absente, base inaccessible) |
| 3 | **Clé API expirée ou refusée** |
| 4 | Rate limit non résorbé après réessais |
| 1 | Erreur inattendue |

Cadence recommandée : **toutes les 30 minutes**, avec « Exécuter la tâche dès
que possible après un démarrage planifié manqué » activé. Le verrou rend cette
fréquence sans risque, et une clé de développement expirant toutes les 24 h
est détectée en moins d'une heure au lieu de l'être le lendemain.
