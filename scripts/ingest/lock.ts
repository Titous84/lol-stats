// Verrou de run — docs/ARCHITECTURE.md § 3, étape 0.
// Un verrou présent et frais (< 2h) fait sortir le run en code 0 : le
// Planificateur peut déclencher toutes les 30 min sans jamais empiler deux
// runs.
import fs from "node:fs";
import path from "node:path";

const LOCK_MAX_AGE_MS = 2 * 60 * 60 * 1_000;

export interface LockHandle {
  release(): void;
}

export type AcquireLockResult = LockHandle | "already-running";

export function acquireLock(lockPath: string): AcquireLockResult {
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });

  if (fs.existsSync(lockPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(lockPath, "utf8")) as { startedAt: string };
      const ageMs = Date.now() - Date.parse(parsed.startedAt);
      if (Number.isFinite(ageMs) && ageMs >= 0 && ageMs < LOCK_MAX_AGE_MS) {
        return "already-running";
      }
    } catch {
      // Verrou illisible/corrompu : traité comme périmé, on le remplace.
    }
  }

  fs.writeFileSync(
    lockPath,
    JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }),
    "utf8",
  );

  let released = false;
  return {
    release: () => {
      if (released) return;
      released = true;
      try {
        fs.unlinkSync(lockPath);
      } catch {
        // Déjà supprimé — sans conséquence.
      }
    },
  };
}
