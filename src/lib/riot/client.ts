// Client HTTP Riot — docs/ARCHITECTURE.md § 3-4.
// Toute requête passe par le rate limiter (une seule en vol à la fois).
import {
  type AccountDto,
  accountDtoSchema,
  type LeagueEntryDto,
  leagueEntriesDtoSchema,
  type MatchDto,
  matchDtoSchema,
  matchIdsDtoSchema,
} from "./dto";
import {
  ExpiredApiKeyError,
  NotFoundError,
  RateLimitExhaustedError,
  RiotHttpError,
  RiotServerError,
  UnexpectedShapeError,
} from "./errors";
import type { RiotRateLimiter } from "./limiter";
import type { z } from "zod";

const MAX_429_RETRIES = 3;
const BACKOFF_5XX_MS = [1_000, 2_000, 4_000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// `S extends z.ZodTypeAny` (plutôt qu'un `ZodType<T>` générique) laisse zod
// calculer lui-même le type de sortie — évite un faux conflit TS entre le
// type d'entrée et de sortie sur les schémas avec `.default()` imbriqués.
function parseOrThrow<S extends z.ZodTypeAny>(schema: S, json: unknown, url: string): z.infer<S> {
  const result = schema.safeParse(json);
  if (result.success) return result.data;
  console.warn(
    `[riot] réponse de forme inattendue sur ${url} :`,
    result.error.issues.slice(0, 5),
  );
  throw new UnexpectedShapeError(url, result.error.issues.map((i) => i.path.join(".")).join(", "));
}

export interface RiotClientOptions {
  apiKey: string;
  /** Routage plateforme (ex. na1) — utilisé pour league-v4. */
  platform: string;
  /** Routage régional (ex. americas) — utilisé pour account-v1 et match-v5. */
  region: string;
  limiter: RiotRateLimiter;
  fetchImpl?: typeof fetch;
  /** Appelé une fois par requête HTTP effectivement envoyée (compteur d'appels). */
  onApiCall?: (methodKey: string) => void;
}

export class RiotClient {
  constructor(private readonly opts: RiotClientOptions) {}

  private platformBase(): string {
    return `https://${this.opts.platform}.api.riotgames.com`;
  }

  private regionBase(): string {
    return `https://${this.opts.region}.api.riotgames.com`;
  }

  private async requestJson(url: string, methodKey: string): Promise<unknown> {
    return this.opts.limiter.schedule(methodKey, async () => {
      let attempt429 = 0;
      let attempt5xx = 0;

      for (;;) {
        this.opts.onApiCall?.(methodKey);

        let res: Response;
        try {
          res = await (this.opts.fetchImpl ?? fetch)(url, {
            headers: { "X-Riot-Token": this.opts.apiKey },
          });
        } catch {
          attempt5xx++;
          if (attempt5xx > BACKOFF_5XX_MS.length) {
            throw new RiotServerError(url, undefined, attempt5xx);
          }
          await sleep(BACKOFF_5XX_MS[attempt5xx - 1]!);
          continue;
        }

        this.opts.limiter.updateFromHeaders(methodKey, res.headers);

        if (res.status === 403) throw new ExpiredApiKeyError(url);
        if (res.status === 404) throw new NotFoundError(url);

        if (res.status === 429) {
          attempt429++;
          if (attempt429 > MAX_429_RETRIES) throw new RateLimitExhaustedError(url, attempt429);
          const retryAfterS = Number(res.headers.get("retry-after") ?? "1");
          await sleep(retryAfterS * 1_000 + 250);
          continue;
        }

        if (res.status >= 500) {
          attempt5xx++;
          if (attempt5xx > BACKOFF_5XX_MS.length) {
            throw new RiotServerError(url, res.status, attempt5xx);
          }
          await sleep(BACKOFF_5XX_MS[attempt5xx - 1]!);
          continue;
        }

        if (!res.ok) throw new RiotHttpError(url, res.status);

        return res.json();
      }
    });
  }

  async getAccountByRiotId(gameName: string, tagLine: string): Promise<AccountDto> {
    const url =
      `${this.regionBase()}/riot/account/v1/accounts/by-riot-id/` +
      `${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
    const json = await this.requestJson(url, "account-by-riot-id");
    return parseOrThrow(accountDtoSchema, json, url);
  }

  async getMatchIdsByPuuid(
    puuid: string,
    queue: number,
    startTime: number,
    start: number,
    count = 100,
  ): Promise<string[]> {
    const url =
      `${this.regionBase()}/lol/match/v5/matches/by-puuid/${puuid}/ids` +
      `?queue=${queue}&startTime=${startTime}&start=${start}&count=${count}`;
    const json = await this.requestJson(url, "match-ids-by-puuid");
    return parseOrThrow(matchIdsDtoSchema, json, url);
  }

  /** `raw` est le JSON brut, avant validation — c'est lui qui va, tel quel,
   *  compressé, dans `match_raw` (docs/DATA-MODEL.md § 2). */
  async getMatchById(matchId: string): Promise<{ dto: MatchDto; raw: unknown }> {
    const url = `${this.regionBase()}/lol/match/v5/matches/${matchId}`;
    const json = await this.requestJson(url, "match-by-id");
    return { dto: parseOrThrow(matchDtoSchema, json, url), raw: json };
  }

  async getLeagueEntriesByPuuid(puuid: string): Promise<LeagueEntryDto[]> {
    const url = `${this.platformBase()}/lol/league/v4/entries/by-puuid/${puuid}`;
    const json = await this.requestJson(url, "league-entries-by-puuid");
    return parseOrThrow(leagueEntriesDtoSchema, json, url);
  }
}
