// Le collecteur — TASKS.md § L1, docs/ARCHITECTURE.md § 3.
// Process Node autonome, sans Next. Seul composant qui détient la clé Riot
// en dehors du serveur. Codes de sortie : docs/ARCHITECTURE.md § 9.
import { config as loadDotenv } from "dotenv";
loadDotenv({ path: ".env.local" });

import { openDb } from "@/db/client";
import { RiotClient } from "@/lib/riot/client";
import { ExpiredApiKeyError, RateLimitExhaustedError } from "@/lib/riot/errors";
import { RiotRateLimiter } from "@/lib/riot/limiter";
import { ConfigError, loadConfig } from "./ingest/config";
import { acquireLock } from "./ingest/lock";
import { runIngest } from "./ingest/run";

function parseMaxMatches(argv: string[]): number | undefined {
  for (const arg of argv) {
    const match = /^--limit=(\d+)$/.exec(arg);
    if (match) return Number(match[1]);
  }
  return undefined;
}

async function main(): Promise<void> {
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error(`Configuration invalide : ${err.message}`);
      process.exitCode = 2;
      return;
    }
    throw err;
  }

  const lock = acquireLock(config.lockPath);
  if (lock === "already-running") {
    console.log("Un run est déjà en cours (verrou frais < 2h) — sortie sans action.");
    process.exitCode = 0;
    return;
  }

  let released = false;
  const releaseOnce = (): void => {
    if (released) return;
    released = true;
    lock.release();
  };
  process.on("exit", releaseOnce);
  process.on("SIGINT", () => {
    releaseOnce();
    process.exit(130);
  });
  process.on("SIGTERM", () => {
    releaseOnce();
    process.exit(143);
  });

  const { sqlite, db } = openDb(config.dbPath);

  try {
    const apiCallCounter = { count: 0 };
    const callsByMethod = new Map<string, number>();
    let rateLimitedCount = 0;
    const limiter = new RiotRateLimiter();
    const client = new RiotClient({
      apiKey: config.apiKey,
      platform: config.platform,
      region: config.region,
      limiter,
      onApiCall: (methodKey) => {
        apiCallCounter.count++;
        callsByMethod.set(methodKey, (callsByMethod.get(methodKey) ?? 0) + 1);
      },
      onRateLimited: () => {
        rateLimitedCount++;
      },
    });

    const maxMatches = parseMaxMatches(process.argv.slice(2));
    if (maxMatches != null) {
      console.log(`Run limité à ${maxMatches} match(s) au total (--limit).`);
    }

    const progressLine = (): string => {
      const perMethod = [...callsByMethod.entries()]
        .map(([k, n]) => `${k}=${n}`)
        .join(", ");
      return `[progression] appels: ${perMethod || "aucun"} | 429: ${rateLimitedCount}`;
    };
    const progressTimer = setInterval(() => console.log(progressLine()), 5_000);

    let summary;
    try {
      summary = await runIngest({ db, client, limiter, apiCallCounter, config }, { maxMatches });
    } finally {
      clearInterval(progressTimer);
      console.log(progressLine());
    }

    console.log(
      `Run terminé (${summary.status}) — découverts: ${summary.matchesDiscovered}, ` +
        `écrits: ${summary.matchesWritten}, échecs: ${summary.matchesFailed}, ` +
        `snapshots de rang: ${summary.rankSnapshotsWritten}, ` +
        `appels Riot: ${summary.apiCallCount}, attente rate limit: ${summary.rateLimitWaitMs}ms.`,
    );
    process.exitCode = 0;
  } catch (err) {
    if (err instanceof ExpiredApiKeyError) {
      console.error(err.message);
      process.exitCode = 3;
    } else if (err instanceof RateLimitExhaustedError) {
      console.error(err.message);
      process.exitCode = 4;
    } else {
      console.error("Erreur inattendue pendant le run :", err);
      process.exitCode = 1;
    }
  } finally {
    sqlite.close();
    releaseOnce();
  }
}

main();
