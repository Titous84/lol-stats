# HANDOFF — mise en place de lol-stats

Document destiné à être relu dans une conversation Claude normale, sans accès
au disque. Il se suffit à lui-même.

Date : 21 août 2026 · Workspace : `S:\Claude`

> **Note de portée.** Le brief indiquait `S:\Projects\Perso\lol-stats\`. Seul
> `S:\Claude` était monté, et la racine `S:\` n'est pas accessible depuis cette
> session. Les projets existants et le `CLAUDE.md` qui définit la convention
> sont à la racine de `S:\Claude` : c'est donc `S:\Claude` qui est le workspace
> visé par la règle `Projects\Pro | Perso | AI-Experiments`. Le projet a été
> créé à **`S:\Claude\Projects\Perso\lol-stats\`**. Si l'intention était bien
> `S:\Projects\`, il suffit de déplacer le dossier `Projects\` d'un niveau —
> rien dans le projet ne dépend de son chemin absolu.

---

## 1. État du workspace

### 1.1 Skills au mauvais emplacement — **diagnostiqué, correctif fourni, non appliqué**

**Constat.** Les 8 skills verrouillés par `skills-lock.json`
(`animation-vocabulary`, `apple-design`, `design-motion-principles`,
`emil-design-eng`, `find-animation-opportunities`, `improve-animations`,
`pick-ui-library`, `review-animations`) sont dans `S:\Claude\.agents\skills\`.
**Aucun dossier `.claude\skills\` n'existe** — ni à la racine du workspace, ni
ailleurs. Il n'y a ni lien, ni redirection, ni réglage qui rende
`.agents\skills` visible.

**Vérification faite** contre la documentation officielle de Claude Code. Les
seuls emplacements de découverte sont :

| Niveau | Chemin | Portée |
|---|---|---|
| Personnel | `~\.claude\skills\<nom>\SKILL.md` | Tous les projets |
| Projet | `.claude\skills\<nom>\SKILL.md` (dossier de démarrage **et** dossiers parents jusqu'à la racine du dépôt) | Ce projet |
| Plugin | via un marketplace | Selon le plugin |
| `--add-dir` | `.claude\skills\` du dossier ajouté | La session |

`.agents\skills` n'en fait partie d'aucune façon. **Les 8 skills ne sont donc
chargés dans aucune session aujourd'hui** — y compris `apple-design`, dont ce
projet a besoin.

Deux pièges à connaître :

- `permissions.additionalDirectories` dans `settings.json` accorde l'accès aux
  fichiers mais **ne charge ni skills, ni commandes, ni sous-agents**. Seul le
  drapeau `--add-dir` le fait.
- Le nom de dossier `synced` est réservé par Claude Code.

**Solution retenue : des jonctions au niveau personnel.**
La documentation précise qu'une entrée de `~\.claude\skills\` peut être un
**lien vers un dossier ailleurs sur le disque** : Claude Code suit le lien et
lit le `SKILL.md` de la cible. Une jonction par skill, de
`~\.claude\skills\<nom>` vers `S:\Claude\.agents\skills\<nom>`, donne :

- une seule copie sur le disque — `skills-lock.json` reste la source de vérité
  et rien ne peut diverger ;
- une disponibilité dans **tous** les projets, quel que soit le dossier
  d'ouverture — ce qui compte ici, puisque Claude Code est ouvert directement
  dans chaque projet ;
- aucun droit administrateur requis (les jonctions de répertoire n'en
  demandent pas, contrairement aux liens symboliques).

Écarté : **copier les skills dans le `.claude\skills\` de chaque projet.** Ça
duplique ~300 Ko de skills tiers dans chaque dépôt, il faut le refaire à chaque
nouveau projet, et surtout les copies **divergent silencieusement** de
`skills-lock.json` dès la première mise à jour via `npx skills`. La lock perd
alors sa raison d'être.

**Livré** : `S:\Claude\Scripts\maintenance\9-Lier-Skills.ps1` (numérotation
alignée sur les 8 scripts existants). Idempotent, `-WhatIf` pour prévisualiser,
`-Force` pour remplacer, `-Mode Copy` en repli si la source passait un jour sur
un volume réseau.

**Non appliqué, et pourquoi** : `~\.claude\` est hors des dossiers connectés à
cette session, et l'environnement d'exécution local de la machine n'a pas
démarré (`device_bash` renvoie « Workspace unavailable ») — aucune commande n'a
pu être lancée sur le poste. **Une commande à taper**, c'est le point 1 de
`TODO.md` :

```powershell
S:\Claude\Scripts\maintenance\9-Lier-Skills.ps1
```

Contrôle : `/skills` dans Claude Code doit lister les 8 noms.

### 1.2 Convention d'arborescence — **écart confirmé, non corrigé (comme demandé)**

Le `CLAUDE.md` racine impose « un projet = un dossier sous `Projects\Pro`,
`Projects\Perso` ou `Projects\AI-Experiments`. Jamais à la racine du
workspace. »

Contenu réel de `S:\Claude\` avant intervention :

```
.agents\  .claude\  .gitignore  AmongLegendNew\  Application-Couple-Distance\
Arborescence.txt  Bon-matin-Charlote\  CLAUDE.md  README.md  Scripts\
skills-lock.json  Templates\
```

Aucun dossier `Projects\`. Trois projets à la racine :
`AmongLegendNew`, `Application-Couple-Distance`, `Bon-matin-Charlote`.

**Fait** : création de `S:\Claude\Projects\Perso\` et du projet dedans.
**Non fait, comme demandé** : aucun projet existant n'a été déplacé.
Recommandation de migration : § 4, question C.

Détail annexe : `.gitignore` racine contient `application-couple/` et
`Bon-matin-Charlote` — des motifs qui ne correspondent pas exactement aux noms
réels de dossiers (`Application-Couple-Distance`). Une migration devra les
mettre à jour, sinon des fichiers ignorés aujourd'hui cesseront de l'être.

### 1.3 Permissions périmées — **signalé, non corrigé (comme demandé)**

`S:\Claude\.claude\settings.local.json` :

```json
"Read(//c/Users/natha/**)"
"Bash(find /c -maxdepth 3 -iname \"*skills*\" -type d)"
```

Ces deux entrées désignent l'**ancien workspace, sur une autre machine**
(`C:\Users\natha\`). Elles n'accordent rien sur le poste actuel : le chemin
n'existe pas. **Aucun risque de sécurité, seulement du bruit** — mais du bruit
qui laisse croire qu'un accès existe.

Deux autres entrées méritent votre attention, indépendamment du déménagement :

| Entrée | Remarque |
|---|---|
| `Bash(git push *)` | Autorise tout `git push`, y compris `--force`, sur n'importe quel dépôt, sans confirmation. Le `CLAUDE.md` racine classe pourtant `git push --force` parmi les actions à passer en mode Plan : la permission contredit la consigne. |
| `Bash(git commit -m ' *)` | Le guillemet simple ouvrant rend le motif fragile ; un message formé autrement passe à côté et redemande confirmation. |
| `Read(//tmp/**)` | Sans objet sous Windows. |

**Rien n'a été modifié.** Recommandation : § 4, question B.

### 1.4 Sous-agents non hérités — **diagnostiqué, correctif fourni, non appliqué**

**Constat confirmé.** `frontend-critic`, `perf-auditor` et `qa-tester` sont dans
`S:\Claude\.claude\agents\`. Claude Code étant ouvert directement dans chaque
projet, et `S:\Claude\Projects\Perso\lol-stats` étant destiné à devenir son
propre dépôt Git, la remontée vers les dossiers parents s'arrête à la racine du
dépôt : ces trois sous-agents ne seraient **pas** chargés.

**Non appliqué, et pourquoi** : le pont de fichiers distant **refuse toute
écriture dans un dossier `.claude`**, quel qu'il soit. Le message est explicite
(« Writing to .claude is not permitted via remote tools »). Les 21 autres
fichiers du projet ont été écrits ; ces quatre-là ont été rejetés :
`.claude\settings.json` et les trois sous-agents.

**Livré à la place** : `Projects\Perso\lol-stats\scripts\init-claude-dir.ps1`.
Il crée `.claude\agents\`, y copie les trois sous-agents depuis
`S:\Claude\.claude\agents\`, et écrit `.claude\settings.json` (permissions du
projet : npm / tsx / drizzle-kit / vitest / playwright / sqlite3, et un `deny`
sur la lecture de `.env.local`). Idempotent, `-Force` pour écraser, `-WhatIf`
pour prévisualiser.

**Une commande à taper**, c'est le point 2 de `TODO.md` :

```powershell
cd S:\Claude\Projects\Perso\lol-stats
.\scripts\init-claude-dir.ps1
```

Contrôle : `/agents` dans Claude Code doit lister les trois noms.

Conséquence à connaître une fois l'étape faite : ce seront **deux copies**. Une
modification du `frontend-critic` du workspace ne se propagera pas au projet.
C'est acceptable pour trois fichiers courts et stables — et c'est même
souhaitable, un projet transportant ses propres auditeurs dans son dépôt. Si
vous les faites évoluer souvent, le même mécanisme de jonction que pour les
skills s'applique.

---

## 2. Ce qui a été créé — fichier par fichier

### Dans `S:\Claude\Scripts\maintenance\`

| Fichier | Contenu |
|---|---|
| `9-Lier-Skills.ps1` | Crée les jonctions `~\.claude\skills\<nom>` → `.agents\skills\<nom>`. Idempotent, `-WhatIf`, `-Force`, `-Mode Copy`. |

### Dans `S:\Claude\Projects\Perso\lol-stats\`

```
lol-stats\
├─ CLAUDE.md                    Décisions figées, autonome. 354 lignes.
├─ README.md                    Démarrage, scripts, règles non négociables.
├─ TASKS.md                     11 lots (L0-L10) + graphe de dépendances.
├─ TODO.md                      7 actions utilisateur, ordonnées.
├─ .env.example                 Placeholders uniquement, aucun secret.
├─ .gitignore                   .env*, *.db, logs, assets, node_modules, .next
├─ scripts\
│  └─ init-claude-dir.ps1       Pose .claude\agents\ (3 sous-agents) et
│                               .claude\settings.json. À lancer une fois —
│                               le pont distant ne peut pas écrire dans .claude
├─ docs\
│  ├─ ARCHITECTURE.md           3 processus, flux d'ingestion en 5 étapes,
│  │                            rate limiting entrant et sortant, cache,
│  │                            assets, sécurité, ordonnancement Windows.
│  ├─ DATA-MODEL.md             11 tables, règle brut/calculé, index,
│  │                            8 pièges de la donnée Riot, 12 métriques
│  │                            proposées, correction de Wilson.
│  └─ HANDOFF.md                ce fichier
├─ data\                        (.gitkeep) base SQLite + logs, git-ignorés
├─ drizzle\                     (.gitkeep) migrations générées
├─ scripts\windows\             (.gitkeep) run-ingest.ps1, register-task.ps1
│                               (à écrire au lot L2)
├─ public\assets\ddragon\       (.gitkeep) assets Data Dragon locaux
└─ src\
   ├─ app\                      (.gitkeep) App Router
   ├─ components\               (.gitkeep) UI, dont La Faille
   ├─ db\queries\               (.gitkeep) une fonction par module d'UI
   ├─ lib\riot\                 (.gitkeep) client, limiter, dto, errors
   ├─ lib\stats\                (.gitkeep) wilson, seasons, sessions, buckets
   ├─ lib\filters\              (.gitkeep) état de filtre ↔ URL
   └─ styles\                   (.gitkeep) tokens, thème
```

**Aucun code applicatif**, conformément au brief. Les `.gitkeep` matérialisent
le squelette ; `scripts\ingest.ts` et les autres sont décrits dans
`docs/ARCHITECTURE.md` § 2 mais pas écrits. Les deux `.ps1` livrés
(`9-Lier-Skills.ps1`, `init-claude-dir.ps1`) sont des scripts de mise en place
du poste, pas du code applicatif.

**Non créé, à faire par vous en une commande** :
`.claude\agents\{frontend-critic,perf-auditor,qa-tester}.md` et
`.claude\settings.json` — voir § 1.4.

---

## 3. Décisions prises et pourquoi

### 3.1 Techniques

| Décision | Alternative écartée | Raison |
|---|---|---|
| **Next.js App Router + TypeScript** | Template `Templates\site-vite-react` | Le template n'a pas de backend ; le proxy de clé et les agrégations serveur en exigent un. Le template n'a **pas** été modifié en place. |
| **SQLite + Drizzle (WAL)** | Supabase / Postgres | Projet local ; aucune dépendance à un service distant. WAL permet au collecteur d'écrire pendant que le site lit. |
| **Collecteur = process Node séparé** | `node-cron` dans le serveur Next | L'ingestion doit tourner **site fermé**. Un cron dans le serveur web ne tourne que si le serveur tourne. |
| **Planificateur de tâches, toutes les 30 min** | 1×/jour | Une clé de dev expire toutes les 24 h : à 30 min, l'expiration est visible en moins d'une heure. Un verrou (lockfile) empêche l'empilement. |
| **1 requête Riot à la fois** | Parallélisme | Sur 100 req/2 min, le parallélisme n'apporte aucun débit et casse la comptabilité des en-têtes. |
| **En-têtes de réponse > configuration locale** | Limites codées en dur | Le passage à une clé personnelle sera exploité **sans changement de code**. |
| **`match_raw` : JSON complet compressé** | Ne garder que les colonnes utiles | ~50 Mo pour 5 000 matchs. Un champ oublié se rattrape sans rappeler l'API — impossible après 2 ans de rétention. |
| **`rank_snapshots` à chaque run** | Déduire le LP des matchs | league-v4 ne renvoie que l'instant présent. Riot ne donne pas le LP par partie. Sans cliché, la courbe est perdue définitivement. |
| **`timeline_fetched_at` dès la v1** | Ajouter la colonne en v2 | Le backfill v2 devient `WHERE timeline_fetched_at IS NULL`, sans re-parcourir l'historique via l'API. Coût aujourd'hui : une colonne nullable. |
| **Aucun ratio en base** | Stocker KDA, DPM, CS/min | Divisions de colonnes déjà présentes ; se recalculent en SQL, ne peuvent pas diverger. |
| **3 totaux d'équipe dénormalisés** | Jointure + agrégat à chaque requête | Seule entorse à la règle ci-dessus. Ces totaux sont immuables après la partie et divisent par ~4 le coût des vues « part d'équipe ». |
| **Agrégation en SQL, pas en JS** | Charger et réduire en mémoire | Quelques ms avec les bons index ; le JS serait plus lent et non paginable. |
| **Tri par borne basse de Wilson** | Tri par winrate brut | Sinon un champion joué 3 fois à 100 % domine tout classement et le rend inutile. |
| **Assets Data Dragon téléchargés** | Hotlink CDN Riot | Le site fonctionne hors ligne ; pas de dépendance réseau à l'affichage. |
| **Timelines en v2** | v1 complète | Double le nombre d'appels sur une clé à 100 req/2 min. |

### 3.2 Visuelles

Direction retenue : **« La Faille »**. Densité d'op.gg, rigueur d'exécution de
Linear / Vercel Analytics ; `apple-design` mobilisé pour la finition
(espacement, hiérarchie, matière), **pas** pour l'aération d'une page produit.

Détail complet dans `CLAUDE.md` § 2. Résumé :

- **Palette** — 6 neutres (`--void #0B0F17` → `--frost #E6EAF2`) + 7 accents
  strictement sémantiques : `--self #E9B64C` (moi), `--rival #A88FF5`,
  `--win #45C08D` / `--loss #E8837A` (écarts agrégés),
  `--side-blue #5AA2F0` / `--side-red #F0655A` (côté de carte uniquement),
  `--focus #E6EAF2`. Contrastes vérifiés par calcul : tous ≥ 4.5:1 sur les
  trois surfaces, le plus serré à 5.16:1.
- **Typographie, 3 rôles** — Archivo Expanded (display, capitales, tracking
  **+0.06em**), Inter 13–14px avec `tabular-nums` pour tout le corps **y
  compris les chiffres de tableaux**, JetBrains Mono réservé aux identifiants
  à largeur fixe (ID de match, patch, `mm:ss`).
- **Layout** — un seul état de filtre sérialisé dans l'URL, dont tout est une
  fonction ; rail d'identité 280px à gauche ; canvas dense à droite ; *scope
  override* local, badgé et réinitialisable, autorisé par exception.
- **Élément signature** — le carré de la Faille tourné à 45°, demi-plans
  bleu/rouge à faible alpha, 5 nœuds de rôle à leur position géographique
  réelle, aire ∝ parties jouées, remplissage = winrate divergent, hachure si
  l'intervalle de Wilson contient 50 %. Comparaison en **mode delta**.

**`frontend-critic` a été invoqué sur la direction avant de la figer. Verdict
initial : RETRAVAILLER**, 9 problèmes dont 3 bloquants. Tous traités :

| Problème relevé | Correction appliquée |
|---|---|
| **(bloquant)** Le cliché « noir + accent néon unique » était bien là : hors module « côté », seul l'or subsistait comme chroma | Ajout de `--raised` ; bleu/rouge rendus **structurels** (demi-plans du fond de la signature, module dédié) ; échelle divergente jade↔corail présente sur toutes les vues agrégées |
| **(bloquant)** L'or portait trois sens (victoire + moi + valeur saillante) : en comparatif une cellule dorée devenait illisible | L'or ne signifie plus que « moi ». Victoire/défaite unitaire encodée par la **forme** (pastille pleine / évidée) ; `--win`/`--loss` réservés aux écarts agrégés |
| **(bloquant)** Le diagramme était un radar déguisé : bot et support au même endroit, jungle sans position, polygones superposés sur des axes non équidistants → comparaison d'aire fausse | Plus aucun polygone. Support décalé le long de la voie bot, jungle au barycentre du quadrant. Comparaison en mode **delta** (recoloration + barrettes de volume) |
| `--defeat #5E6B85` à 3.4:1, échec AA sur le texte 13px | Couple `--win`/`--loss` recalculé et vérifié ; plancher à 5.16:1 |
| `--rival` et `--side-blue` proches en deutéranopie | `--rival` porte **aussi** une hachure / un trait pointillé, jamais la teinte seule |
| Archivo **Expanded** + capitales + tracking serré : contradiction typographique | Tracking **+0.06em** imposé sur les capitales |
| JetBrains Mono partout en aurait fait une famille décorative | Mono réservé aux identifiants ; tableaux en Inter `tabular-nums` |
| Le dogme « aucun filtre local » rendait l'analyse de matchup impossible | *Scope override* par module, badgé, réinitialisable en un clic |
| Tween de valeurs à chaque filtre = jank sur des milliers de lignes | Tween limité aux ≤ 8 KPI d'en-tête (200–300 ms) ; tableaux → flash de surlignage 400 ms ; stagger au premier montage seulement |
| Manquants : token de focus, échelle de densité, échelle divergente, états vide/erreur, virtualisation, raccourcis clavier | Tous ajoutés — `CLAUDE.md` § 2.1/2.3/2.5, `TASKS.md` L5, L8, L9 |

Un second passage de `frontend-critic` est prévu sur les primitives (fin de L5)
puis sur la vue personnelle (fin de L6) : la direction est figée, son exécution
ne l'est pas.

### 3.3 Métriques ajoutées à celles demandées

Toutes réalisables **sans timeline**, donc dès la v1 : winrate contre le
champion adverse de lane · performance par heure et par jour · courbe de forme
sur 20 parties glissantes · **effet de session** (winrate par rang dans une
session de moins de 3 h d'écart) · ratio d'efficacité (part de dégâts ÷ part
d'or) · coût du temps mort (`total_time_spent_dead / durée`) · participation
aux objectifs · coéquipiers récurrents · indice de mono-champion (entropie du
pool) · distribution des multi-kills · progression de LP depuis
`rank_snapshots`. Détail et formules : `docs/DATA-MODEL.md` § 5.

---

## 4. Points ouverts nécessitant votre arbitrage

### Question A — Bibliothèque de graphiques

| Option | Coût | Bénéfice |
|---|---|---|
| **Recharts** *(recommandé)* | ~95 Ko gz, API déclarative, limité en personnalisation fine | Couvre 90 % des besoins immédiatement ; La Faille est de toute façon en SVG custom |
| visx | ~40 Ko selon les modules, mais chaque graphique se construit primitive par primitive | Contrôle total, cohérence visuelle parfaite ; coût de développement nettement supérieur |
| ECharts | ~350 Ko gz, thématisation par objet de configuration | Performant sur de très gros volumes, mais surdimensionné ici et son esthétique par défaut est difficile à faire disparaître |

**Recommandation : Recharts + SVG custom pour la signature.** Le poids n'est
pas un enjeu sur une application locale, et visx coûterait plusieurs jours pour
un gain visible seulement sur les graphiques les plus exotiques.
→ *Sans réponse de votre part, Recharts est appliqué.*

### Question B — Permissions périmées de `settings.local.json`

| Option | Effet |
|---|---|
| **Nettoyer** *(recommandé)* | Retirer `Read(//c/Users/natha/**)`, `Bash(find /c ...)`, `Read(//tmp/**)` ; restreindre `Bash(git push *)` à `Bash(git push origin *)` pour exclure `--force` sans confirmation |
| Remplacer par l'équivalent local | Ajouter `Read(//s/Claude/**)` si un besoin réel existe — a priori inutile, le workspace est déjà le dossier de travail |
| Ne rien faire | Aucun risque immédiat : les chemins n'existent pas sur ce poste |

**Recommandation : nettoyer.** Ce fichier est git-ignoré, donc l'opération est
locale et sans effet sur les autres machines.
→ *Rien n'a été modifié : votre accord était requis.*

### Question C — Migration des trois projets à la racine

| Option | Effet |
|---|---|
| **Migrer à la prochaine session sur chaque projet** *(recommandé)* | Un projet à la fois : `git mv` si versionné, sinon déplacement simple, puis mise à jour du `.gitignore` racine (`application-couple/` et `Bon-matin-Charlote` ne correspondent plus aux noms réels) et vérification des chemins absolus dans les scripts de maintenance |
| Migrer les trois d'un coup | Rapide, mais casse potentiellement plusieurs projets simultanément — `Application-Couple-Distance` contient un `node_modules` volumineux, dont le déplacement est lent et peut échouer sur les chemins longs |
| Assouplir la convention | Modifier le `CLAUDE.md` racine pour autoriser la racine. Honnête, mais fait perdre le bénéfice d'un rangement Pro/Perso/AI-Experiments |

**Recommandation : migrer un projet à la fois, au moment où vous y travaillez.**
→ *Aucun projet n'a été déplacé, conformément au brief.*

### Question D — Emplacement racine `S:\Claude` ou `S:\`

Voir la note de portée en tête de document. Le projet est à
`S:\Claude\Projects\Perso\lol-stats\`.
**Recommandation : conserver `S:\Claude` comme racine du workspace** — c'est là
que vivent `CLAUDE.md`, `.claude\`, `Scripts\`, `Templates\` et
`skills-lock.json`. Si vous préférez `S:\Projects\`, déplacer le dossier
`Projects\` d'un niveau suffit : rien dans le projet ne dépend de son chemin
absolu, hormis les valeurs par défaut de `9-Lier-Skills.ps1`.

### Question E — Ingestion des joueurs comparés

Comparer un joueur sans historique commun demande d'ingérer **son** historique,
ce qui consomme le même quota Riot.

| Option | Effet |
|---|---|
| **Marquer `is_tracked = 1`, ingérer au run suivant** *(recommandé, et déjà écrit dans l'architecture)* | Zéro appel Riot depuis le navigateur ; la comparaison est disponible sous 30 minutes ; l'UI l'annonce |
| Ingérer à la demande, en direct | Comparaison immédiate, mais une recherche peut bloquer plusieurs minutes et affamer l'ingestion du compte principal |
| Se limiter aux matchs communs | Aucun coût, mais la comparaison se réduit aux parties jouées ensemble — inutile pour comparer deux joueurs qui ne se croisent pas |

→ *Sans réponse, l'option recommandée reste en place.*

---

## 5. Risques, du plus grave au moins grave

### R1 — Perte de données irréversible (gravité : critique)

La rétention de l'API Riot est d'environ **2 ans glissants**. Chaque jour sans
ingestion efface définitivement une journée de l'extrémité ancienne de la
fenêtre. Aucun développement futur ne rattrape ça.

Aggravants : la clé de développement expire toutes les 24 h ; la tâche
planifiée n'existe pas tant que L2 n'est pas fait ; une clé non renouvelée est
un arrêt silencieux si l'on ne regarde pas.

*Atténuation* : L1 + L2 en priorité absolue ; demande de clé personnelle
lancée **aujourd'hui** ; `403` traité comme un code de sortie distinct (3) et
affiché en permanence dans le rail de gauche ; ingestion toutes les 30 min pour
détecter l'expiration en moins d'une heure.

**C'est le seul risque qui peut faire échouer le projet de façon définitive.**

### R2 — Le projet s'arrête avant que le collecteur tourne (gravité : critique)

Le risque le plus banal et le plus probable : commencer par l'interface parce
qu'elle est plus gratifiante, et ne jamais finir le collecteur. Le résultat
serait un joli dashboard sur trois semaines de données.

*Atténuation* : `TASKS.md` interdit explicitement de commencer L2 avant un
backfill complet réel ; L5 (design system) est le **seul** lot d'interface
autorisé en parallèle, et il ne dépend que de L0.

### R3 — LP jamais collecté (gravité : élevée)

league-v4 ne renvoie que l'état courant. Si le snapshot de rang n'est pas
implémenté dans L1, la courbe de progression n'existera jamais, même en
rattrapant les matchs. C'est le sous-risque le plus facile à oublier de R1,
parce que rien ne signale son absence.

*Atténuation* : le snapshot est une étape **obligatoire** du run d'ingestion
(`docs/ARCHITECTURE.md` § 3, étape 4), pas une option.

### R4 — Blocage de clé par dépassement de quota (gravité : élevée)

Un rate limiter naïf (`setTimeout` fixe, en-têtes ignorés) déclenche des `429`
en rafale, puis une suspension temporaire de la clé.

*Atténuation* : fenêtres glissantes réelles, en-têtes faisant autorité,
comptabilité séparée par méthode, `Retry-After` honoré, une seule requête à la
fois, et un rate limiting sur les endpoints internes pour qu'un
rafraîchissement compulsif ne se propage jamais jusqu'à Riot.

### R5 — Erreurs silencieuses dans le modèle de données (gravité : moyenne)

Quatre pièges connus faussent les statistiques sans jamais lever d'erreur :
l'unité de `gameDuration` (secondes ou millisecondes selon l'âge du match),
les remakes comptés comme des défaites, `teamPosition` vide, `challenges`
absent sur les matchs anciens.

*Atténuation* : tous normalisés **à l'ingestion**, jamais à l'affichage ;
`is_remake` dérivé et exclu par défaut via une vue SQL unique
(`docs/DATA-MODEL.md` § 4).

### R6 — Statistiques trompeuses sur petits échantillons (gravité : moyenne)

Sur plusieurs milliers de matchs, il y aura toujours un champion joué 3 fois à
100 % de winrate. Un classement naïf le met en tête et le tableau devient
inutilisable — pire, il induit de mauvaises décisions de jeu.

*Atténuation* : tri par borne basse de l'intervalle de Wilson à 95 %, `n`
affiché à côté de chaque pourcentage, hachure sur les échantillons dont
l'intervalle contient 50 %, aucune moyenne affichée sous `n = 5`.

### R7 — Fuite de la clé API (gravité : moyenne, probabilité faible)

Un `NEXT_PUBLIC_RIOT_API_KEY` posé « juste pour tester » suffirait. La clé est
personnelle et liée au compte Riot.

*Atténuation* : aucun appel Riot côté client par construction ; test
automatisé vérifiant qu'aucun bundle client ne contient `RGAPI-` ; `.env.local`
git-ignoré ; `.claude/settings.json` interdit la lecture de `.env.local`.

### R8 — Dérive de la table des saisons (gravité : faible)

`season_id` est dérivé d'une correspondance patch → saison/split maintenue à la
main : Riot ne renvoie pas de `seasonId` dans match-v5. Un nouveau split non
déclaré ferait tomber les matchs récents dans la mauvaise saison.

*Atténuation* : dette localisée dans un seul fichier
(`src/lib/stats/seasons.ts`), documentée comme telle.

### R9 — Performance sur plusieurs milliers de matchs (gravité : faible)

Un `SCAN TABLE` sur `match_participants` dans un chemin chaud, ou un tableau
non virtualisé, rendrait l'interface poussive au fil des saisons.

*Atténuation* : index définis à l'avance (`docs/DATA-MODEL.md` § 3), critère de
sortie de L4 exprimé en `EXPLAIN QUERY PLAN`, virtualisation au-delà de
200 lignes, tri en SQL, `perf-auditor` en L8.

### R10 — Skills et sous-agents non chargés (gravité : faible, mais immédiate)

Tant que `9-Lier-Skills.ps1` n'est pas exécuté, `apple-design` et les skills
d'animation ne sont pas disponibles, et la qualité d'exécution visuelle
attendue ne sera pas atteinte.

De la même façon, tant que `init-claude-dir.ps1` n'est pas exécuté,
`frontend-critic` n'est **pas invocable dans ce projet** — alors que `CLAUDE.md`
et `TASKS.md` l'exigent à la fin des lots L5, L6 et L9. Une direction visuelle
figée sans son auditeur est exactement le scénario que le workspace cherche à
éviter.

*Atténuation* : points 1 et 2 de `TODO.md`, une commande chacun, moins de trois
minutes au total.

---

## 6. Prérequis avant la première session Claude Code

À faire dans cet ordre.

- [ ] **1.** Lancer `S:\Claude\Scripts\maintenance\9-Lier-Skills.ps1`.
      Vérifier avec `/skills` : les 8 noms doivent apparaître.
- [ ] **2.** Depuis `S:\Claude\Projects\Perso\lol-stats`, lancer
      `.\scripts\init-claude-dir.ps1`. Vérifier avec `/agents` :
      `frontend-critic`, `perf-auditor`, `qa-tester`.
- [ ] **3.** Créer une clé de développement sur
      https://developer.riotgames.com/ et la copier.
- [ ] **4.** Déposer la demande de **clé personnelle** (formulaire prérempli
      dans `TODO.md` point 4). À faire maintenant : le délai court en
      parallèle du développement.
- [ ] **5.** Ouvrir Claude Code dans `S:\Claude\Projects\Perso\lol-stats`,
      faire lire `CLAUDE.md`, puis `TASKS.md`.
- [ ] **6.** Répondre aux questions A à E du § 4 — ou laisser les
      recommandations par défaut s'appliquer.
- [ ] **7.** Lancer **L0** (amorçage). Vérifier que `npm run dev` répond sur
      `http://127.0.0.1:3000` et **pas** sur l'IP de la machine.
- [ ] **8.** Créer `.env.local` depuis `.env.example`, y coller la clé.
      Confirmer qu'il est bien git-ignoré (`git check-ignore -v .env.local`).
- [ ] **9.** Lancer **L1** (le collecteur). Critère de sortie : deux runs
      consécutifs donnent le même nombre de lignes et le second ne fait aucun
      appel `match/detail`.
- [ ] **10.** Lancer un **backfill complet réel** (15–25 min). Vérifier le
      nombre de matchs et la présence d'au moins un `rank_snapshots`.
- [ ] **11.** Lancer **L2** et enregistrer la tâche planifiée **le jour même**.
      Vérifier un passage en `0x0` dans le Planificateur.
- [ ] **12.** À partir de là seulement, l'hémorragie de données est arrêtée.
      Le reste (L3 à L9) peut suivre au rythme voulu.

Un rappel utile : tant que la clé personnelle n'est pas accordée, la clé de
développement est à recoller **chaque jour** dans `.env.local`.
