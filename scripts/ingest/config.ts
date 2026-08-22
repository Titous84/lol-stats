// Lecture et validation de la configuration du collecteur — TASKS.md § L1.
export class ConfigError extends Error {}

export interface IngestConfig {
  apiKey: string;
  gameName: string;
  tagLine: string;
  /** Routage plateforme (ex. na1) — league-v4. */
  platform: string;
  /** Routage régional (ex. americas) — account-v1, match-v5. */
  region: string;
  queues: number[];
  dbPath: string;
  lockPath: string;
}

const REQUIRED_ENV = [
  "RIOT_API_KEY",
  "RIOT_GAME_NAME",
  "RIOT_TAG_LINE",
  "RIOT_PLATFORM",
  "RIOT_REGION",
] as const;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): IngestConfig {
  const missing = REQUIRED_ENV.filter((name) => !env[name]?.trim());
  if (missing.length > 0) {
    throw new ConfigError(
      `Variable(s) manquante(s) dans .env.local : ${missing.join(", ")}`,
    );
  }

  const apiKey = env.RIOT_API_KEY!;
  if (apiKey.includes("xxxx")) {
    throw new ConfigError(
      "RIOT_API_KEY dans .env.local est encore la valeur d'exemple — coller une vraie clé.",
    );
  }

  const queues = (env.INGEST_QUEUES ?? "420,440")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (queues.length === 0) {
    throw new ConfigError("INGEST_QUEUES ne contient aucune file valide.");
  }

  return {
    apiKey,
    gameName: env.RIOT_GAME_NAME!,
    tagLine: env.RIOT_TAG_LINE!,
    platform: env.RIOT_PLATFORM!,
    region: env.RIOT_REGION!,
    queues,
    dbPath: env.DATABASE_PATH ?? "./data/lol-stats.db",
    lockPath: env.INGEST_LOCK_PATH ?? "./data/.ingest.lock",
  };
}
