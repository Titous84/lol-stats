# Modèle de données — lol-stats

Conventions de nommage : voir `CLAUDE.md` § 5.
La base ne purge **jamais** rien. Toute écriture est un `INSERT ... ON CONFLICT
DO UPDATE` sur clé naturelle.

---

## 1. Principe directeur : brut vs calculé

La règle est décidée par une seule question : **est-ce que Riot me le redonnera
si je le perds ?**

| Nature | Décision | Raison |
|---|---|---|
| Compteur renvoyé par Riot (kills, dégâts, or, CS, durée) | **Stocké brut** | Non reconstructible après 2 ans. C'est la matière première. |
| Ratio, taux, moyenne (KDA, DPM, CS/min, winrate, part de dégâts) | **Jamais stocké** | Division de deux colonnes déjà présentes. Se recalcule en SQL en quelques ms, ne vieillit pas, ne peut pas diverger. |
| Valeur dérivée d'un champ brut mais coûteuse à re-dériver et utilisée en filtre (`patch`, `season_id`) | **Stocké, dérivé à l'ingestion** | On indexe et on filtre dessus. Parser `gameVersion` sur chaque ligne à chaque requête est un gâchis. |
| Réponse JSON complète de Riot | **Stockée compressée** | Assurance. Un champ oublié aujourd'hui se rattrape sans rappeler l'API — impossible après 2 ans. |
| État courant non historisé par Riot (rang, LP) | **Stocké en snapshot horodaté** | league-v4 ne renvoie que l'instant présent. Sans cliché régulier, la courbe est perdue à jamais. |

> **La conséquence à retenir** : `match_raw` et `rank_snapshots` sont les deux
> tables qu'on ne peut pas reconstruire. Elles priment sur tout le reste.

---

## 2. Tables

### `players`
Tout joueur croisé, pas seulement le compte principal.

| Colonne | Type | Note |
|---|---|---|
| `puuid` | TEXT PK | Identifiant stable. Ne change jamais. |
| `game_name` | TEXT | Partie avant le `#`. **Change dans le temps.** |
| `tag_line` | TEXT | Partie après le `#`. |
| `platform_id` | TEXT | `NA1`, `EUW1`… |
| `is_self` | INTEGER | 1 pour `TikaSama#DME`. Un seul. |
| `is_tracked` | INTEGER | 1 → le collecteur ingère son historique complet. |
| `first_seen_ms` / `last_seen_ms` | INTEGER | |
| `updated_at` | TEXT | |

Le Riot ID affiché sur un match ancien vient de `match_participants`, pas de
cette table : c'est le nom **au moment de la partie**. `players.game_name` est
le nom **actuel**. Les deux sont utiles et différents.

### `matches`
Une ligne par partie. La table chaude : c'est elle qu'on filtre et qu'on trie.

| Colonne | Type | Note |
|---|---|---|
| `match_id` | TEXT PK | `NA1_4712345678` |
| `platform_id` | TEXT | |
| `queue_id` | INTEGER | 420 ou 440 uniquement |
| `game_version` | TEXT | Brut, ex. `15.16.712.4923` |
| `patch` | TEXT | **Dérivé** : `15.16`. Indexé, sert de filtre. |
| `season_id` | TEXT | **Dérivé** : `S15`, `S15-split2`. Voir § 4. |
| `game_creation_ms` | INTEGER | Entrée en champ select |
| `game_start_ms` | INTEGER | **Référence temporelle du site** |
| `game_end_ms` | INTEGER | |
| `game_duration_s` | INTEGER | Normalisé en secondes. Voir § 4. |
| `map_id`, `game_mode`, `game_type` | | |
| `ended_in_early_surrender` | INTEGER | |
| `ended_in_surrender` | INTEGER | |
| `is_remake` | INTEGER | **Dérivé** : `ended_in_early_surrender = 1 OR game_duration_s < 300`. Voir § 4. |
| `timeline_fetched_at` | TEXT NULL | **Le crochet du backfill v2.** |
| `ingested_at` | TEXT | |

### `match_raw`
Séparée de `matches` pour que la table chaude reste petite et que le cache
disque de SQLite serve les agrégations, pas des blobs.

| Colonne | Type |
|---|---|
| `match_id` | TEXT PK → `matches` |
| `payload_gz` | BLOB — réponse match-v5 complète, gzip |
| `payload_schema` | TEXT — version de DTO Riot observée |
| `fetched_at` | TEXT |

≈ 8–15 Ko compressés par match. 5 000 matchs ≈ 50 Mo. Le prix de l'assurance
contre la rétention de 2 ans.

### `match_teams`
Deux lignes par match. PK `(match_id, team_id)`.

`team_id` (100 = bleu, 200 = rouge), `win`, `baron_kills`, `dragon_kills`,
`herald_kills`, `tower_kills`, `inhibitor_kills`, `first_blood`,
`first_tower`, `first_dragon`, `first_baron`, `bans_json`.

### `match_participants`
**La table de travail.** Dix lignes par match. PK `(match_id, puuid)`.

Identité : `participant_id`, `team_id`, `champion_id`, `champion_name`,
`champ_level`, `riot_id_game_name`, `riot_id_tag_line` (au moment de la partie).

Position : `team_position` (`TOP`/`JUNGLE`/`MIDDLE`/`BOTTOM`/`UTILITY`),
`individual_position`, `lane`, `role`.

Résultat : `win`.

Compteurs bruts — **tous entiers, aucun ratio** :
`kills`, `deaths`, `assists`,
`total_damage_dealt_to_champions`, `physical_damage_to_champions`,
`magic_damage_to_champions`, `true_damage_to_champions`,
`total_damage_taken`, `damage_self_mitigated`,
`damage_dealt_to_objectives`, `damage_dealt_to_turrets`,
`total_minions_killed`, `neutral_minions_killed`,
`gold_earned`, `gold_spent`,
`vision_score`, `wards_placed_count`, `wards_killed_count`,
`detector_wards_placed_count`, `vision_wards_bought_count`,
`time_ccing_others_s`, `total_time_spent_dead_s`, `longest_time_living_s`,
`turret_kills`, `inhibitor_kills`, `dragon_kills`, `baron_kills`,
`largest_killing_spree`, `largest_multi_kill`,
`double_kills`, `triple_kills`, `quadra_kills`, `penta_kills`,
`first_blood_kill`, `first_blood_assist`, `first_tower_kill`.

Build : `item_0` … `item_6`, `summoner_1_id`, `summoner_2_id`,
`perk_primary_style`, `perk_sub_style`, `perk_keystone`, `perks_json`.

Bloc `challenges` : `challenges_json` (tel quel) + trois extractions
promues en colonnes indexables parce qu'elles pilotent des filtres et des tris :
`solo_kills`, `lane_minions_first_10`, `control_wards_placed`.

**Dénormalisations assumées** (recopiées depuis `match_teams` à l'ingestion) :

| Colonne | Pourquoi |
|---|---|
| `team_total_kills` | Kill participation = `(kills+assists)/team_total_kills`. Sans ça, chaque ligne exige une jointure + agrégat sur `match_participants`. |
| `team_total_damage_to_champions` | Part de dégâts de l'équipe, même raison. |
| `team_total_gold_earned` | Ratio d'efficacité (part de dégâts ÷ part d'or). |

C'est la seule entorse à la règle « pas de valeur dérivée en base ». Elle est
sûre : ces trois totaux sont **immuables** une fois la partie terminée. Elle
divise par ~4 le coût des vues « part d'équipe » sur plusieurs milliers de
lignes.

### `rank_snapshots`
Écrit à **chaque** run d'ingestion. Irremplaçable.

`id` (PK auto), `puuid`, `queue_type` (`RANKED_SOLO_5x5` / `RANKED_FLEX_SR`),
`tier`, `rank`, `league_points`, `wins`, `losses`, `hot_streak`,
`captured_at`, `captured_ms`.

Index unique `(puuid, queue_type, captured_ms)`.
La courbe de LP est une lecture de cette table, jamais une reconstruction
depuis les matchs — Riot ne renvoie pas le LP gagné/perdu par partie.

### `ingest_runs`
`id`, `started_at`, `finished_at`, `status`
(`success` | `partial` | `expired_key` | `config_error` | `rate_limited` | `error`),
`matches_discovered_count`, `matches_written_count`, `api_call_count`,
`rate_limit_wait_ms`, `error_kind`, `error_message`.

Le dashboard affiche la santé de l'ingestion (dernier run, âge, statut) en
permanence dans le rail de gauche. Une clé expirée doit se voir sans ouvrir un
log.

### `ingest_cursors`
PK `(puuid, queue_id)` : `last_match_end_ms`, `last_match_id`, `updated_at`.

### `ingest_failures`
`match_id` PK, `kind` (`http_404` | `http_5xx` | `parse_error`),
`attempt_count`, `last_attempt_at`, `detail`.
Un `404` définitif n'est jamais redemandé ; le reste est réessayé au run suivant.

### `player_lookups`
Cache de la recherche par Riot ID.
PK `(game_name_lower, tag_line_lower)` : `puuid`, `resolved_at`, TTL 24 h.

### `asset_versions`
`ddragon_version` PK, `fetched_at`, `is_current`.

### `match_timelines` — **v2, vide en v1**
`match_id` PK, `payload_gz`, `fetched_at`.
Créée dès la v1 pour que la migration v2 n'ait pas à toucher au schéma existant.

---

## 3. Index

```sql
-- filtrage temporel + file : la requête de base de tout le site
CREATE INDEX idx_matches_queue_start   ON matches(queue_id, game_start_ms DESC);
CREATE INDEX idx_matches_patch         ON matches(patch);
CREATE INDEX idx_matches_season        ON matches(season_id);
-- le crochet du backfill v2
CREATE INDEX idx_matches_timeline_todo ON matches(queue_id, timeline_fetched_at)
  WHERE timeline_fetched_at IS NULL;

-- « mes parties », dans l'ordre
CREATE INDEX idx_mp_puuid_match   ON match_participants(puuid, match_id);
-- winrate par champion, par rôle
CREATE INDEX idx_mp_puuid_champ   ON match_participants(puuid, champion_id);
CREATE INDEX idx_mp_puuid_pos     ON match_participants(puuid, team_position);
-- matchup : retrouver l'adversaire de lane sans scanner la table
CREATE INDEX idx_mp_match_pos     ON match_participants(match_id, team_position);
-- analyse des coéquipiers récurrents
CREATE INDEX idx_mp_match_team    ON match_participants(match_id, team_id);

CREATE INDEX idx_rank_puuid_time  ON rank_snapshots(puuid, queue_type, captured_ms);
```

`PRAGMA journal_mode = WAL` (le collecteur écrit pendant que le site lit),
`PRAGMA synchronous = NORMAL`, `PRAGMA foreign_keys = ON`.

---

## 4. Pièges de la donnée Riot — traités à l'ingestion, pas à l'affichage

1. **`gameDuration` a deux unités.** Depuis le patch 11.20, quand
   `gameEndTimestamp` est présent, `gameDuration` est en **secondes** ; sur des
   parties plus anciennes, il est en **millisecondes**. Normalisé une fois à
   l'ingestion vers `game_duration_s`. Ne jamais refaire ce test dans une vue.
2. **Les remakes faussent tout.** Une partie annulée est une défaite comptable
   sans contenu. `is_remake` est dérivé (`ended_in_early_surrender = 1 OR
   game_duration_s < 300`) et **toutes les statistiques l'excluent par
   défaut** ; un interrupteur permet de les réintégrer. La règle est appliquée
   dans une vue SQL, pas répétée dans chaque requête.
3. **`teamPosition` peut être vide** (remakes, désynchronisations). Stocké tel
   quel ; les vues par rôle ignorent les lignes vides plutôt que d'inventer une
   position.
4. **`challenges` peut être absent** sur les matchs anciens. `challenges_json`
   est nullable, et les colonnes promues sont nullables. Une moyenne calculée
   sur un sous-ensemble doit afficher son propre `n`.
5. **`summonerName` n'existe plus** dans match-v5 : c'est `riotIdGameName` +
   `riotIdTagline`. Les endpoints `summoner-v4/by-name` sont dépréciés et ne
   doivent pas être utilisés — la résolution passe par account-v1
   `by-riot-id`.
6. **Le Riot ID change, pas le puuid.** Toute jointure se fait sur `puuid`.
   Le nom n'est que de l'affichage.
7. **Découpage des saisons.** Riot ne renvoie pas de `seasonId` dans match-v5.
   `season_id` est dérivé d'une table de correspondance patch → saison/split
   maintenue dans `src/lib/stats/seasons.ts`. Elle sera à compléter à chaque
   nouveau split : c'est une dette assumée et localisée en un seul fichier.
8. **Les compteurs d'équipe ne sont pas dans le DTO participant.** Ils sont
   calculés à l'ingestion depuis les 10 participants, puis recopiés (§ 2).

---

## 5. Métriques — ce qui se calcule, et à partir de quoi

### Demandées

| Métrique | Formule | Source |
|---|---|---|
| Winrate global / par file | `SUM(win)/COUNT(*)` hors remakes | `match_participants` × `matches` |
| Dégâts / partie, / min | `dmg`, `dmg*60/duration` | brut |
| Part des dégâts d'équipe | `dmg / team_total_damage_to_champions` | dénormalisé |
| CS/min | `(minions+neutral)*60/duration` | brut |
| Or/min | `gold_earned*60/duration` | brut |
| KDA | `(kills+assists)/NULLIF(deaths,0)` | brut |
| Kill participation | `(kills+assists)/team_total_kills` | dénormalisé |
| Vision score/min | `vision_score*60/duration` | brut |
| Durée moyenne | `AVG(game_duration_s)` | brut |
| Winrate par champion / rôle / côté / durée | `GROUP BY` + Wilson (§ 6) | |
| Séries en cours | fenêtre SQL sur `game_start_ms` | |

### Proposées en complément

Toutes réalisables **sans timeline**, donc dès la v1 :

1. **Winrate contre le champion adverse de ma lane.** Auto-jointure de
   `match_participants` sur `(match_id, team_position)` avec `team_id`
   différent. C'est la métrique la plus actionnable du lot : elle dit quoi
   bannir. *(Index `idx_mp_match_pos` existe pour ça.)*
2. **Performance selon l'heure et le jour.** `game_start_ms` converti en
   `America/Toronto`, croisé au winrate. Répond à « je joue mal après 23 h ».
3. **Courbe de forme sur 20 parties glissantes.** Moyenne mobile du winrate et
   du KDA — la lecture la plus honnête d'une progression, bien plus qu'un
   cumul depuis le début de saison.
4. **Effet de session.** Parties séparées de moins de 3 h = une session ;
   winrate par **rang dans la session** (1re, 2e, 3e, 4e et plus). Détection de
   tilt, et argument chiffré pour s'arrêter.
5. **Ratio d'efficacité** = part de dégâts ÷ part d'or de l'équipe. > 1 = je
   convertis mon or mieux que la moyenne de mon équipe. C'est la lecture
   « dpm.lol » et elle est neutre vis-à-vis du rôle.
6. **Coût du temps mort** = `total_time_spent_dead_s / game_duration_s`.
   Le pourcentage de la partie passé à regarder l'écran gris. Fortement
   corrélé aux défaites, et rarement affiché ailleurs.
7. **Participation aux objectifs** : `damage_dealt_to_objectives` par minute,
   `dragon_kills` + `baron_kills` + `turret_kills` par partie.
8. **Winrate à intervalle de confiance de Wilson** (§ 6) — voir plus bas,
   c'est une correction, pas un supplément.
9. **Coéquipiers récurrents** : puuid apparaissant ≥ 5 fois dans mon équipe,
   winrate avec / sans. Utile en flex.
10. **Indice de mono-champion** : entropie de Shannon du pool de champions sur
    la période. Une seule valeur qui résume « je spam un champion » vs « je
    joue tout ».
11. **Distribution des multi-kills et des séries** : penta/quadra/triple,
    plus grande série, par champion.
12. **Progression de LP** — lecture de `rank_snapshots`. Rappel : elle
    n'existe **que si le collecteur tourne**. Rien ne la rattrape après coup.

### Reportées en v2 (exigent la timeline)

CS@10, gold diff@15, XP diff@15, courbes d'or intra-partie, position des morts,
premier item complété. Backfill limité au ranked solo via
`idx_matches_timeline_todo`.

---

## 6. Honnêteté statistique — non négociable

Sur un historique de plusieurs milliers de matchs, il y aura toujours un
champion joué 3 fois avec 100 % de winrate. Un classement naïf le met en tête
et rend le tableau inutile.

**Règle du projet** : tout classement par winrate est ordonné par la **borne
inférieure de l'intervalle de Wilson à 95 %**, pas par le winrate brut.
Le winrate brut et le `n` restent affichés ; c'est le **tri** qui est corrigé.

```
p̂ = wins / n
borne_basse = (p̂ + z²/2n − z·√(p̂(1−p̂)/n + z²/4n²)) / (1 + z²/n)   avec z = 1.96
```

Conséquences visibles dans l'UI :

- Un échantillon dont l'intervalle contient 50 % est **hachuré** dans La Faille
  et grisé dans les tableaux.
- Le `n` est affiché à côté de **chaque** pourcentage, toujours.
- Aucune moyenne n'est affichée sous `n = 5` : la cellule montre le `n` brut.

Implémenté dans `src/lib/stats/wilson.ts`, testé unitairement, appliqué
partout — pas seulement là où ça arrange.
