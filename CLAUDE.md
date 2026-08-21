# lol-stats — Instructions de projet

> Ce fichier est **autonome**. Il ne dépend d'aucun `CLAUDE.md` parent.
> Tout ce qui a été arrêté au démarrage est ici et fait autorité jusqu'à
> instruction contraire. Relis-le en début de chaque session.

---

## 1. Ce qu'est ce projet

Site web **strictement local** d'analyse des parties League of Legends de
l'utilisateur. Jamais déployé, jamais exposé : le serveur écoute sur
`127.0.0.1` uniquement.

Ordre de priorité, non négociable :

1. **Collecteur** — l'API Riot ne conserve que ~2 ans glissants d'historique.
   Chaque jour sans ingestion est de la donnée définitivement perdue.
2. **Base** — archive locale, ne purge **jamais** rien.
3. **Dashboard** — la lecture. Utile, mais reconstructible à tout moment ;
   la donnée non collectée, non.

Corollaire opérationnel : si un arbitrage oppose « finir une vue » et
« sécuriser l'ingestion », l'ingestion gagne toujours.

### Paramètres du compte

| Paramètre | Valeur |
|---|---|
| Riot ID principal | `TikaSama#DME` |
| Serveur | NA |
| Routage plateforme | `na1` |
| Routage régional | `americas` |
| Files ingérées | `420` (Ranked Solo/Duo), `440` (Ranked Flex) — **uniquement** |
| Fuseau d'affichage | `America/Toronto` |

Toute autre file (ARAM, normales, Arena, Swiftplay) est hors périmètre : elle
n'est ni ingérée, ni affichée, ni comptée dans une statistique.

---

## 2. Direction visuelle — arrêtée

Direction retenue : **« La Faille »**. Densité d'op.gg, rigueur d'exécution de
Linear / Vercel Analytics. Explicitement **pas** la générosité en blanc d'une
page produit Apple : le skill `apple-design` sert pour la qualité d'exécution
(espacement, hiérarchie, matière, finition), pas pour l'aération.

Cette direction a été auditée par `frontend-critic` avant d'être figée ;
les corrections issues de cet audit sont intégrées ci-dessous et les
raisons figurent en § 6.

### 2.1 Palette

**Neutres** (le châssis) :

| Token | Hex | Usage |
|---|---|---|
| `--void` | `#0B0F17` | Fond de page |
| `--surface` | `#141A26` | Panneaux, cartes, lignes de tableau |
| `--raised` | `#1E2736` | Survol, ligne active, popovers |
| `--line` | `#232C3C` | Filets 1px, grilles de graphique, séparateurs |
| `--mist` | `#98A3B5` | Texte secondaire, libellés d'axes |
| `--frost` | `#E6EAF2` | Texte primaire, chiffres saillants |

L'élévation est portée par le **filet 1px**, pas par un écart de luminance :
`--surface` et `--raised` sont volontairement proches (ratio 1.1). C'est ce
qui permet d'empiler beaucoup de modules sans que l'écran devienne un
patchwork de gris.

**Accents — chacun a un sens unique et un seul** :

| Token | Hex | Sens — et rien d'autre |
|---|---|---|
| `--self` | `#E9B64C` | **Identité : « moi ».** Or, la couleur de l'économie du jeu. |
| `--rival` | `#A88FF5` | **L'adversaire** dans la vue comparative. |
| `--win` | `#45C08D` | Au-dessus de la référence (winrate > 50 %, delta positif) |
| `--loss` | `#E8837A` | En dessous de la référence |
| `--side-blue` | `#5AA2F0` | **Côté bleu de la carte.** Jamais « victoire ». |
| `--side-red` | `#F0655A` | **Côté rouge de la carte.** Jamais « défaite ». |
| `--focus` | `#E6EAF2` | Anneau de focus clavier (2px, offset 2px) |

**Règles d'encodage — à ne jamais enfreindre :**

1. **Aucune vue ne mélange l'encodage « côté » et l'encodage « winrate ».**
   `--side-blue` / `--side-red` n'apparaissent que dans le module « côté » et
   dans les deux demi-plans de fond de l'élément signature. Partout ailleurs,
   bleu et rouge n'existent pas.
2. **L'or ne signifie que « moi ».** Il n'encode ni la victoire, ni une valeur
   remarquable. Une valeur remarquable se signale par le poids typographique
   ou la place dans la hiérarchie, pas par de l'or.
3. **Victoire / défaite d'une partie individuelle** (liste de matchs) s'encode
   par la **forme** : pastille pleine = victoire, pastille évidée = défaite,
   toutes deux en `--mist`. `--win` / `--loss` sont réservés aux **écarts
   agrégés** (échelle divergente), pas aux résultats unitaires.
4. `--rival` se distingue **aussi par le trait** (pointillé 4-2 ou hachure
   45°), jamais par la seule teinte : `--rival` et `--side-blue` sont proches
   en deutéranopie.
5. Le focus clavier est un anneau `--frost`, jamais un accent : un anneau or
   entrerait en collision avec la sémantique « moi ».

**Échelle divergente** (heatmaps de winrate, deltas), centrée sur la référence
(50 % ou la moyenne personnelle selon le module, toujours annoncée) :

`--loss #E8837A` → `#8B6E77` → `--line #232C3C` (neutre) → `#3C7C76` → `--win #45C08D`

Contrastes vérifiés : tous les accents sont ≥ 4.5:1 sur les trois surfaces
(le plus serré, `--mist` sur `--raised`, est à 5.16:1).

### 2.2 Typographie — 3 rôles

| Rôle | Famille | Réglages | Où |
|---|---|---|---|
| Display | **Archivo Expanded** 600/700 | Capitales, `letter-spacing: +0.06em` | En-têtes de section, libellés de KPI, en-têtes de colonnes |
| Texte / UI | **Inter** 400/500/600 | 13–14px, `font-variant-numeric: tabular-nums` | Tout le corps, **y compris les chiffres de tableaux** |
| Identifiants | **JetBrains Mono** 400/500 | `font-feature-settings: "zero"` | Chaînes techniques à largeur fixe **uniquement** : ID de match, numéro de patch (`15.16`), durées `mm:ss`, horodatages |

Notes d'exécution :

- Archivo **Expanded** en capitales exige un tracking **positif** (+0.06em).
  Ne jamais l'associer à un tracking serré : « expanded + serré » s'annule.
- Les colonnes chiffrées des tableaux utilisent Inter avec `tabular-nums`,
  **pas** le mono. Inter a des chiffres tabulaires ; sortir le mono pour ça en
  ferait une troisième famille décorative.
- Le mono est un choix **fonctionnel** : il sert à scanner des identifiants de
  largeur fixe, pas à « faire technique ».
- Inter est un choix assumé pour la densité 13–14px, pas un défaut. Le
  caractère du projet vient d'Archivo Expanded et du système sémantique, pas
  de la police de labeur.

### 2.3 Concept de layout — « un état, des fonctions pures »

Chaque métrique du site est une fonction du **même** état de filtre. Le layout
matérialise ça :

- **Barre de filtres globale**, collante en haut : saison · patch · file ·
  champion · rôle · plage de dates. Elle est l'unique source de vérité.
  L'état est sérialisé dans l'URL (partageable, rechargeable, historique
  navigateur fonctionnel).
- **Rail d'identité persistant à gauche**, 280px : Riot ID, rang courant par
  file, série en cours, volume de la sélection, et l'élément signature
  toujours visible.
- **Canvas d'analyse à droite**, scrollable, dense, en modules.

**Exception au dogme** (correction issue de l'audit) : un module peut porter
un *scope override* local — comparer deux champions, isoler un matchup —
à trois conditions : il est **badgé visiblement** (« filtre local actif »),
il est **réinitialisable en un clic**, et il n'altère jamais l'état global.
Sans cette soupape, l'analyse de matchup est impossible.

Densité cible : hauteur de ligne de tableau 32px, gouttière de module 16px,
padding interne 12–16px, graduations d'axe tous les 4 points maximum.

### 2.4 Élément signature — « La Faille »

Un seul élément signature, et il vient de la donnée LoL, pas d'un catalogue
d'effets.

La Faille de l'Invocateur est géométriquement un **carré tourné à 45°**, coupé
par la diagonale de la rivière : moitié bleue en bas à gauche, moitié rouge en
haut à droite. Le composant reprend cette géométrie réelle.

- **Fond** : le carré à 45°. Ses deux demi-plans sont teintés `--side-blue` et
  `--side-red` à très faible alpha (≤ 8 %). **C'est le seul endroit où le côté
  s'exprime dans ce composant** — le côté est un *champ*, pas une couleur de
  nœud.
- **5 nœuds de rôle placés à leur position géographique réelle** : top sur
  l'arête haut-gauche, mid sur la diagonale centrale, bot sur l'arête
  bas-droite, support décalé le long de la voie bot vers la base bleue,
  jungle au barycentre du quadrant de jungle. **Aucun nœud ne se superpose.**
- **Aire du nœud** (pas le rayon) ∝ nombre de parties. L'aire est la grandeur
  que l'œil compare ; encoder le volume sur le rayon exagère les gros nœuds.
- **Remplissage du nœud** = winrate sur l'échelle divergente. Un nœud dont
  l'intervalle de Wilson à 95 % contient 50 % est **hachuré** au lieu d'être
  plein : l'incertitude statistique est visible, pas masquée.
- **Aucun polygone ne relie les nœuds.** Ce n'est pas un radar. Des axes non
  équidistants rendraient toute comparaison d'aire fausse.
- **Mode comparatif = mode delta.** Pas de second polygone superposé : les
  nœuds sont recolorés par l'écart (moi − rival) et portent une paire de
  barrettes internes donnant les deux volumes. `--rival` n'apparaît que sur
  les barrettes et la légende, avec sa hachure.

Trois lectures, sans confusion : répartition des rôles (aire), performance par
rôle (remplissage), fiabilité de la mesure (hachure). Le côté bleu/rouge est
le décor géographique, pas une quatrième lecture cachée.

### 2.5 Mouvement

Ambition « marquée », mais chaque animation doit servir la lecture.

- **Entrée des graphiques** : stagger court **au premier montage uniquement**,
  ≤ 300ms au total. Pas de re-stagger à chaque changement de filtre.
- **Changement de filtre** : le tween de valeur est réservé aux **KPI
  d'en-tête** (≤ 8 valeurs, 200–300ms). Dans les tableaux, un tween sur des
  milliers de lignes est du jank illisible — on utilise un **flash de
  surlignage** de 400ms sur les cellules dont la valeur a changé.
- **États de chargement** : squelettes calqués sur la forme finale du module
  (mêmes dimensions, mêmes gouttières), jamais de spinner générique, jamais de
  saut de mise en page.
- `prefers-reduced-motion: reduce` → toutes les durées à 0ms, transitions
  remplacées par un changement d'état instantané. Sans exception.
- Animer `transform` et `opacity` uniquement.

### 2.6 Ce qui est interdit

Les trois rendus « IA générique » sont exclus :

1. Fond crème + display serif + accent terracotta.
2. Fond quasi noir + un **unique** accent néon. — C'est le piège naturel de ce
   projet. Il est désamorcé par un système sémantique à plusieurs chromas et
   par des demi-plans bleu/rouge structurels, pas par un seul accent posé sur
   du noir.
3. Style « broadsheet » journal.

Également exclus : marqueurs numérotés `01/02/03` (aucun contenu du site n'est
une séquence), hero centré + 3 cartes + CTA, la 3D, tout effet décoratif sans
justification par la donnée.

---

## 3. Stack technique — arrêtée

| Couche | Choix | Raison |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | Un backend est obligatoire : proxy de clé Riot, agrégations lourdes côté serveur. |
| Base | **SQLite** (`better-sqlite3`, mode WAL) | Fichier local, zéro infrastructure, agrégations rapides sur des milliers de lignes. |
| ORM / migrations | **Drizzle ORM + drizzle-kit** | Schéma typé, migrations SQL versionnées et lisibles. |
| Collecteur | **Script Node autonome** (`npm run ingest`, via `tsx`) | Doit tourner **site fermé**, déclenché par le Planificateur de tâches Windows. |
| Graphiques | **Recharts** (standard) + **SVG custom** (signature) | Recommandation par défaut — arbitrage ouvert, voir `docs/HANDOFF.md` § 4. |
| Tests | Vitest (logique d'agrégation) + Playwright (parcours + captures) | |

Le collecteur **n'importe rien de Next.js**. La frontière est stricte :
`src/lib/riot/` et `src/db/` sont partagés, `src/app/` ne l'est pas.

### Écarts assumés

- **Écart au template `Templates\site-vite-react`** : ce template n'a pas de
  backend. Le projet en exige un. Le template n'est **pas** modifié en place.
- **Pas de Supabase** : le projet est local et ne doit dépendre d'aucun
  service distant.

---

## 4. Contraintes dures — à intégrer, pas à redécouvrir

1. **Rétention Riot ≈ 2 ans glissants.** Les saisons antérieures ne sont pas
   récupérables. Le multi-saisons n'existe que si le site archive lui-même.
2. **Clé de développement : expire toutes les 24 h**, 20 req/s et 100 req/2 min.
   - Rate limiter respectant les en-têtes `X-App-Rate-Limit`,
     `X-App-Rate-Limit-Count`, `X-Method-Rate-Limit`, `X-Method-Rate-Limit-Count`.
   - Backoff sur `429` en honorant `Retry-After`.
   - Ingestion **strictement incrémentale** : un match déjà en base n'est
     jamais retéléchargé.
   - `403` → `ExpiredApiKeyError` avec message explicite. **Jamais de
     plantage silencieux**, jamais de run marqué « succès » sur clé morte.
3. **Timelines exclues de la v1.** L'endpoint timeline double le nombre
   d'appels. CS@10, gold diff@15 et les courbes intra-partie sont reportés en
   v2. La table `matches` porte `timeline_fetched_at` (nullable) dès la v1 :
   le backfill v2 se fait par `WHERE timeline_fetched_at IS NULL AND
   queue_id = 420`, **sans re-parcourir l'historique via l'API**.
4. **op.gg et dpm.lol = références d'UI uniquement.** Pas d'API publique,
   scraping exclu. Toutes les données viennent de l'API Riot officielle.
   Assets statiques (champions, items, sorts, runes) via Data Dragon ou
   CommunityDragon, **téléchargés et servis en local** — aucun hotlink.
5. **Sécurité** :
   - La clé API ne doit **jamais** atteindre le navigateur. Aucune variable
     `NEXT_PUBLIC_*` ne contient de secret. Tous les appels Riot passent par
     le serveur.
   - Clé dans `.env.local`, jamais commité.
   - Validation stricte du Riot ID côté serveur : `nom#tag`, gameName 3–16
     caractères, tagLine 3–5 caractères, jeu de caractères restreint.
   - Rate limiting sur les endpoints internes : un rafraîchissement compulsif
     ne doit pas consommer le quota Riot.
   - Serveur lié à `127.0.0.1` uniquement (`-H 127.0.0.1` en dev comme en prod).

---

## 5. Conventions de nommage

**Tables** : `snake_case`, **pluriel** (`matches`, `match_participants`).
Les tables de jointure/détail sont préfixées par leur parent (`match_teams`,
`match_participants`, `match_raw`).

**Colonnes** : `snake_case`, **singulier**.

| Suffixe | Signification | Exemple |
|---|---|---|
| `_id` | Identifiant, interne ou Riot | `match_id`, `champion_id` |
| `_ms` | Horodatage epoch **millisecondes** (UTC) | `game_start_ms` |
| `_s` | Durée en **secondes** | `game_duration_s` |
| `_at` | Horodatage ISO-8601 texte, généré par nous | `ingested_at` |
| `_count` | Dénombrement entier | `wards_placed_count` |
| `_json` | Charge JSON stockée telle quelle | `challenges_json` |
| `is_` / `has_` | Booléen (INTEGER 0/1) | `is_tracked`, `has_remake` |

**Interdits en base** : toute colonne qui est un **ratio ou un taux**
(`kda`, `dpm`, `cs_per_min`, `winrate`). Ce sont des divisions, elles se
recalculent en SQL et vieillissent mal. On stocke les compteurs bruts.
Seule exception documentée : les totaux d'équipe dénormalisés sur la ligne du
participant (voir `docs/DATA-MODEL.md` § « Dénormalisations assumées »).

**TypeScript** : `camelCase` pour les identifiants, `PascalCase` pour les
types. La couche Drizzle fait la traduction `snake_case` ↔ `camelCase` ; les
noms de colonnes SQL ne fuient pas dans les composants.

**Fichiers** : `kebab-case.ts`. Composants React : `PascalCase.tsx`.

**Riot** : les identifiants de l'API gardent leur nom d'origine (`puuid`,
`queue_id`, `team_position`) — les renommer créerait un décalage permanent
avec la documentation Riot.

---

## 6. Décisions et rejets — mémoire du projet

| Décision | Retenu | Écarté | Pourquoi |
|---|---|---|---|
| Élément signature | Carte de la Faille (nœuds positionnés) | Radar / polygone de rôles | Bot et support partagent la même position, la jungle n'en a aucune ; deux polygones sur des axes non équidistants mentent sur les aires. |
| Comparatif | Mode **delta** (recoloration) | Second polygone superposé | Même raison : comparaison d'aire fausse, illisible en superposition. |
| Encodage côté | Demi-plans de fond, module dédié | Couleur de nœud / de ligne | Le côté joué n'a aucun rapport avec la position d'un rôle ; les mélanger crée une lecture fantôme. |
| Sémantique de l'or | Identité seule | Or = victoire + moi + valeur saillante | Triple sens : en vue comparative une cellule dorée devenait illisible. |
| Victoire/défaite unitaire | Forme (plein / évidé) | Couple de teintes dédié | Une teinte de plus entrait en collision avec `--side-red` et l'échelle divergente. |
| Chiffres de tableaux | Inter `tabular-nums` | JetBrains Mono partout | Inter a des chiffres tabulaires ; le mono partout en aurait fait une famille décorative. |
| Filtres | Global + *scope override* badgé | Dogme « aucun filtre local » | Sans soupape, comparer deux champions ou isoler un matchup est impossible. |
| Tween de valeurs | KPI d'en-tête seuls | Tween sur tout à chaque filtre | Jank et illisibilité sur des milliers de lignes. |
| Base | SQLite + Drizzle | Supabase / Postgres | Projet local ; aucune dépendance à un service distant. |
| Framework | Next.js App Router | Template Vite React | Le template n'a pas de backend ; le proxy de clé et les agrégations en exigent un. |
| Ordonnancement | Planificateur de tâches Windows | `node-cron` dans le serveur web | L'ingestion doit tourner site fermé. |
| Timelines | v2, backfill ciblé | v1 | Double le nombre d'appels sur une clé à 100 req/2 min. |
| Assets | Data Dragon téléchargé en local | Hotlink CDN Riot | Fonctionnement hors ligne, pas de dépendance réseau à l'affichage. |

---

## 7. Sous-agents

Attendus dans `.claude/agents/`, copiés depuis le workspace par
`scripts/init-claude-dir.ps1` (à lancer une fois — voir `TODO.md` point 2) :

- `frontend-critic` — à invoquer **systématiquement** après tout travail de
  design/UI significatif, avant de considérer une vue terminée.
- `qa-tester` — lance la suite Playwright, ne rapporte que les échecs.
- `perf-auditor` — performance et accessibilité avant livraison.

Si `/agents` ne les liste pas, lancer `.\scripts\init-claude-dir.ps1` avant de
poursuivre : la direction visuelle ne doit pas être exécutée sans son auditeur.

---

## 8. Posture de travail

- Ingénieur senior : décide les points mineurs, ne demande pas confirmation
  sur les actions réversibles.
- Pas de narration étape par étape. Travail, puis synthèse : ce qui a été
  fait, ce qui a été décidé, ce qui reste à valider.
- Mode Plan uniquement pour le structurant ou le destructif (migration de
  données, suppression massive, `git reset --hard`).
- Toute nouvelle décision structurante ou visuelle **s'écrit ici**, dans le
  tableau du § 6. L'utilisateur ne doit jamais avoir à réexpliquer un choix.
