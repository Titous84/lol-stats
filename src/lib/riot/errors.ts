// Erreurs typées du client Riot — docs/ARCHITECTURE.md § 3-4.
// scripts/ingest.ts les traduit en codes de sortie (docs/ARCHITECTURE.md § 9).

/** 403 — clé absente, invalide ou expirée. Jamais de réessai. */
export class ExpiredApiKeyError extends Error {
  constructor(url: string) {
    super(
      `Clé Riot refusée (403) sur ${url}. Une clé de développement expire toutes ` +
        `les 24 h : recoller une clé fraîche dans .env.local depuis ` +
        `https://developer.riotgames.com/.`,
    );
    this.name = "ExpiredApiKeyError";
  }
}

/** 429 — 3 tentatives épuisées malgré le respect de Retry-After. */
export class RateLimitExhaustedError extends Error {
  constructor(url: string, attempts: number) {
    super(`Rate limit non résorbé après ${attempts} tentatives sur ${url}.`);
    this.name = "RateLimitExhaustedError";
  }
}

/** 5xx / erreur réseau — 3 tentatives de backoff exponentiel épuisées. */
export class RiotServerError extends Error {
  constructor(
    url: string,
    public readonly status: number | undefined,
    attempts: number,
  ) {
    super(`Erreur serveur Riot (${status ?? "réseau"}) après ${attempts} tentatives sur ${url}.`);
    this.name = "RiotServerError";
  }
}

/** 404 — ressource introuvable (match purgé côté Riot, par ex.). */
export class NotFoundError extends Error {
  constructor(url: string) {
    super(`Ressource introuvable (404) : ${url}`);
    this.name = "NotFoundError";
  }
}

/** Réponse dont la forme ne correspond pas au DTO attendu sur un champ
 *  jugé critique (pas une simple extension de schéma — celles-là sont
 *  journalisées et ignorées, pas levées). */
export class UnexpectedShapeError extends Error {
  constructor(url: string, detail: string) {
    super(`Réponse Riot de forme inattendue sur ${url} : ${detail}`);
    this.name = "UnexpectedShapeError";
  }
}

/** Toute autre réponse HTTP non gérée explicitement. */
export class RiotHttpError extends Error {
  constructor(
    url: string,
    public readonly status: number,
  ) {
    super(`Réponse Riot inattendue (${status}) sur ${url}.`);
    this.name = "RiotHttpError";
  }
}
