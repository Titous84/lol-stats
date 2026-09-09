# Ce qui m'incombe — actions hors périmètre de Claude Code

Ordre d'exécution. Les quatre premières bloquent le développement.

---

## 1. Rendre les 8 skills chargeables — 2 min ★ à faire en premier

Les skills verrouillés par `skills-lock.json` sont dans `.agents\skills\`.
Claude Code ne lit **que** `~\.claude\skills\` (personnel), `.claude\skills\`
(projet), et les plugins. `.agents\skills\` n'est aucun de ces trois
emplacements : les 8 skills ne sont donc **jamais chargés** aujourd'hui.

La documentation officielle précise qu'une entrée de `~\.claude\skills\` peut
être un **lien vers un dossier ailleurs sur le disque** ; Claude Code suit le
lien et lit le `SKILL.md` de la cible. C'est la solution retenue : une seule
copie sur le disque, `skills-lock.json` reste la source de vérité, et les
skills deviennent disponibles dans **tous** les projets, pas seulement
celui-ci.

```powershell
S:\Claude\Scripts\maintenance\9-Lier-Skills.ps1
```

Puis, dans Claude Code, `/skills` doit lister les 8 noms.

> Le script crée des **jonctions** (`New-Item -ItemType Junction`), qui ne
> demandent pas de droits administrateur. Si la cible est un jour sur un
> volume réseau, relancer avec `-Mode Copy`.

---

## 2. Créer le dossier `.claude\` du projet — 10 s ★ à faire en premier aussi

Le pont de fichiers distant **refuse toute écriture dans un dossier `.claude`**.
Les trois sous-agents (`frontend-critic`, `perf-auditor`, `qa-tester`) et le
`settings.json` du projet n'ont donc pas pu être posés à distance. Un script
les met en place :

```powershell
cd S:\Claude\Projects\Perso\lol-stats
.\scripts\init-claude-dir.ps1
```

Il copie les trois sous-agents depuis `S:\Claude\.claude\agents\` vers
`.claude\agents\` du projet et écrit `.claude\settings.json`.

Vérification : `/agents` dans Claude Code doit lister les trois noms.

Sans cette étape, `frontend-critic` n'est pas invocable dans ce projet — or
`CLAUDE.md` et `TASKS.md` l'exigent à la fin des lots L5, L6 et L9.

---

## 3. Créer une clé de développement Riot — 2 min, **à refaire toutes les 24 h**

1. https://developer.riotgames.com/ → se connecter avec le compte Riot.
2. Copier la clé `RGAPI-...` du tableau de bord.
3. La coller dans `S:\Claude\Projects\Perso\lol-stats\.env.local` :
   `RIOT_API_KEY=RGAPI-...`

La clé **expire toutes les 24 heures**. Tant qu'elle n'est pas remplacée par
une clé personnelle (point 4), il faut la recoller chaque jour, sinon
l'ingestion s'arrête — et l'historique perdu ne revient pas.

Le collecteur détecte l'expiration (`403`), s'arrête avec le **code 3** et
l'écrit dans `ingest_runs` ; le rail de gauche du site l'affiche.

---

## 4. Demander une clé personnelle Riot — 10 min de formulaire ★ priorité haute

Une clé personnelle **n'expire pas** et supprime la corvée quotidienne du
point 2. Riot les accorde pour les projets personnels sans processus de
vérification lourd.

1. https://developer.riotgames.com/ → **Register Product** → **Personal API Key**.
2. Champs à préparer :
   - **Product name** : `lol-stats`
   - **Product URL** : sans URL publique, indiquer un dépôt Git privé ou
     préciser « application locale, non déployée, usage personnel ».
   - **Description** : outil personnel d'analyse de mon propre historique
     ranked (queues 420 et 440) sur NA. Fonctionne uniquement en local sur
     `127.0.0.1`, aucune donnée n'est redistribuée, aucun contenu n'est
     public.
   - **Application type** : Web / Personal.
3. Délai de réponse : quelques jours à quelques semaines.
4. Une fois accordée : remplacer `RIOT_API_KEY` dans `.env.local`. **Aucun
   changement de code n'est nécessaire** — le rate limiter se reconfigure à
   partir des en-têtes de réponse.

**À faire dès aujourd'hui**, même si le développement n'a pas commencé : le
délai d'obtention court en parallèle.

---

## 5. Créer la tâche planifiée Windows — 1 min (après le lot L1)

```powershell
cd S:\Claude\Projects\Perso\lol-stats
.\scripts\windows\register-task.ps1
```

Enregistre une tâche « lol-stats — ingestion » toutes les 30 minutes, sans
fenêtre visible, avec rattrapage après un démarrage manqué.

Vérification : Planificateur de tâches → Bibliothèque → la tâche doit passer en
`0x0`. Les logs sont dans `data\logs\ingest-{date}.log`.

À faire **le jour même** où le lot L1 est terminé. Chaque jour de retard est de
la donnée définitivement perdue.

---

## 6. Trancher la bibliothèque de graphiques

Recommandation par défaut : **Recharts** pour les graphiques standards +
**SVG custom** pour La Faille. Alternatives et coûts : `docs/HANDOFF.md` § 4,
question A. Sans réponse, Recharts est appliqué.

---

## 7. Décider du sort des permissions périmées

`S:\Claude\.claude\settings.local.json` autorise `Read(//c/Users/natha/**)` —
un chemin de l'**ancienne machine**. Rien n'a été modifié, comme demandé.
Détail et recommandation : `docs/HANDOFF.md` § 1.3.

---

## 8. Décider de la migration des projets existants

`AmongLegendNew`, `Application-Couple-Distance` et `Bon-matin-Charlote` sont à
la racine du workspace alors que la convention impose `Projects\...`.
**Aucun n'a été déplacé.** Procédure de migration proposée :
`docs/HANDOFF.md` § 4, question C.


Corriger l'encodage des journaux d'ingestion (data/logs) — accents illisibles.