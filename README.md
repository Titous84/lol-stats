# lol-stats

Analyse locale de mes parties League of Legends — collecteur, base d'archive,
dashboard. `TikaSama#DME` · NA (`na1` / `americas`) · ranked solo (420) et
flex (440).

**Site strictement local.** Jamais déployé, écoute sur `127.0.0.1` uniquement.

> État : squelette et documentation. **Aucun code applicatif.**
> Premier lot à implémenter : le collecteur (`TASKS.md` § L1).

---

## Pourquoi le collecteur d'abord

L'API Riot ne conserve qu'environ **2 ans glissants** d'historique. Les saisons
antérieures ne seront jamais récupérables. Ce projet est donc, dans cet ordre :
un **collecteur**, une **base qui ne purge rien**, et un **dashboard**.
Chaque jour sans ingestion est de la donnée définitivement perdue.

---

## Démarrage

```powershell
# Une seule fois : pose les sous-agents et .claude\settings.json
.\scripts\init-claude-dir.ps1
```

```bash
npm install
cp .env.example .env.local     # y coller la clé Riot
npm run db:migrate             # crée data/lol-stats.db
npm run sync-assets            # images Data Dragon en local
npm run ingest                 # premier backfill : 15-25 min
npm run dev                    # http://127.0.0.1:3000
```

## Scripts

| Commande | Rôle |
|---|---|
| `npm run ingest` | Un run d'ingestion incrémental. Appelé par le Planificateur de tâches. |
| `npm run sync-assets` | Télécharge les assets Data Dragon en local. |
| `npm run db:generate` / `db:migrate` | Migrations Drizzle. |
| `npm run dev` / `npm run start` | Serveur, lié à `127.0.0.1`. |
| `npm test` | Vitest (agrégations) |
| `.\scripts\init-claude-dir.ps1` | Pose `.claude\agents\` et `.claude\settings.json` (une seule fois). |
| `npx playwright test` | Parcours et captures |

## Documentation

| Fichier | Contenu |
|---|---|
| `CLAUDE.md` | Décisions figées — visuel et technique. Autonome. À relire en début de session. |
| `TASKS.md` | Lots livrables ordonnés, avec dépendances. |
| `TODO.md` | Ce qui incombe à l'utilisateur (clés Riot, tâche planifiée). |
| `docs/ARCHITECTURE.md` | Processus, flux d'ingestion, rate limiting, cache. |
| `docs/DATA-MODEL.md` | Tables, brut vs calculé, pièges de la donnée Riot. |
| `docs/HANDOFF.md` | Audit de mise en place, risques, arbitrages ouverts. |

## Règles non négociables

- La clé Riot **n'atteint jamais le navigateur**. Tous les appels Riot passent
  par le serveur ou le collecteur.
- `.env.local` n'est jamais commité, jamais affiché.
- La base ne purge jamais rien.
- Aucune donnée ne vient d'op.gg ou dpm.lol : ce sont des références d'UI.
  Scraping exclu. Tout vient de l'API Riot officielle.
- Aucun hotlink : les assets sont téléchargés et servis en local.
