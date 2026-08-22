// Rate limiter sortant vers Riot — docs/ARCHITECTURE.md § 4.
//
// Deux paliers vivent en parallèle : "app" (global à la clé) et "method"
// (par groupe d'endpoint, ex. match/detail). Chaque palier peut porter
// plusieurs fenêtres simultanées (ex. "20:1,100:120" = 20 req/1s ET
// 100 req/120s à la fois — les deux doivent être respectées).
//
// Rien n'est codé en dur : les fenêtres de départ ne sont que des graines de
// démarrage, remplacées dès la première réponse par ce que les en-têtes
// `X-App-Rate-Limit` / `X-Method-Rate-Limit` annoncent réellement. Une clé
// personnelle sera donc exploitée à son vrai débit sans toucher au code.

export interface WindowLimit {
  limit: number;
  windowMs: number;
}

/** Graine de démarrage — celle d'une clé de développement Riot standard.
 *  Remplacée à la première réponse ayant porté un en-tête de rate limit. */
export const DEFAULT_SEED_WINDOWS: WindowLimit[] = [
  { limit: 20, windowMs: 1_000 },
  { limit: 100, windowMs: 120_000 },
];

function parseRateLimitHeader(value: string | null): WindowLimit[] | undefined {
  if (!value) return undefined;
  const windows: WindowLimit[] = [];
  for (const pair of value.split(",")) {
    const [limitRaw, windowSRaw] = pair.trim().split(":");
    const limit = Number(limitRaw);
    const windowS = Number(windowSRaw);
    if (!Number.isFinite(limit) || !Number.isFinite(windowS) || limit <= 0 || windowS <= 0) {
      continue;
    }
    windows.push({ limit, windowMs: windowS * 1_000 });
  }
  return windows.length > 0 ? windows : undefined;
}

function sameWindows(a: WindowLimit[], b: WindowLimit[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((w, i) => w.limit === b[i]!.limit && w.windowMs === b[i]!.windowMs);
}

/** Une fenêtre glissante réelle : on garde les horodatages des N derniers
 *  appels et on attend que le plus ancien sorte de la fenêtre — pas un
 *  `setTimeout` fixe. */
class SlidingWindow {
  private timestamps: number[] = [];

  constructor(
    public limit: number,
    public windowMs: number,
  ) {}

  private prune(now: number): void {
    const cutoff = now - this.windowMs;
    let i = 0;
    while (i < this.timestamps.length && this.timestamps[i]! <= cutoff) i++;
    if (i > 0) this.timestamps.splice(0, i);
  }

  msUntilSlot(now: number): number {
    this.prune(now);
    if (this.timestamps.length < this.limit) return 0;
    const oldest = this.timestamps[0]!;
    return Math.max(0, oldest + this.windowMs - now);
  }

  record(now: number): void {
    this.timestamps.push(now);
  }

  reconfigure(limit: number, windowMs: number, now: number): void {
    this.limit = limit;
    this.windowMs = windowMs;
    this.prune(now);
  }
}

class WindowGroup {
  private windows: SlidingWindow[];

  constructor(seed: WindowLimit[]) {
    this.windows = seed.map((w) => new SlidingWindow(w.limit, w.windowMs));
  }

  msUntilSlot(now: number): number {
    return Math.max(0, ...this.windows.map((w) => w.msUntilSlot(now)));
  }

  record(now: number): void {
    for (const w of this.windows) w.record(now);
  }

  /** Reconfigure sans perdre l'historique des fenêtres dont la forme
   *  (limit, windowMs) n'a pas changé — sinon on repartirait à zéro à
   *  chaque réponse et on pourrait dépasser la vraie limite. */
  reconfigureFrom(target: WindowLimit[], now: number): void {
    const current = this.windows.map((w) => ({ limit: w.limit, windowMs: w.windowMs }));
    if (sameWindows(current, target)) return;

    const next: SlidingWindow[] = [];
    for (const t of target) {
      const reusable = this.windows.find((w) => w.windowMs === t.windowMs);
      if (reusable) {
        reusable.reconfigure(t.limit, t.windowMs, now);
        next.push(reusable);
      } else {
        next.push(new SlidingWindow(t.limit, t.windowMs));
      }
    }
    this.windows = next;
  }
}

export interface RiotRateLimiterOptions {
  /** Graine de démarrage pour le palier "app", avant la première réponse. */
  appSeed?: WindowLimit[];
  /** Graine de démarrage pour un palier "method" pas encore vu. */
  methodSeed?: WindowLimit[];
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Un seau à jetons par méthode + un seau "app" global, tous deux à fenêtres
 * glissantes réelles, reconfigurés à chaud depuis les en-têtes de réponse.
 * Une seule requête en vol à la fois : `schedule()` sérialise les appels.
 */
export class RiotRateLimiter {
  private readonly appSeed: WindowLimit[];
  private readonly methodSeed: WindowLimit[];
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;

  private appGroup: WindowGroup;
  private methodGroups = new Map<string, WindowGroup>();

  /** Chaîne de sérialisation : une seule requête en vol à la fois. */
  private queueTail: Promise<unknown> = Promise.resolve();

  totalWaitMs = 0;

  constructor(options: RiotRateLimiterOptions = {}) {
    this.appSeed = options.appSeed ?? DEFAULT_SEED_WINDOWS;
    this.methodSeed = options.methodSeed ?? DEFAULT_SEED_WINDOWS;
    this.now = options.now ?? Date.now;
    this.sleep = options.sleep ?? defaultSleep;
    this.appGroup = new WindowGroup(this.appSeed);
  }

  private methodGroup(methodKey: string): WindowGroup {
    let group = this.methodGroups.get(methodKey);
    if (!group) {
      group = new WindowGroup(this.methodSeed);
      this.methodGroups.set(methodKey, group);
    }
    return group;
  }

  /** Lit les en-têtes Riot d'une réponse et reconfigure les seaux concernés.
   *  Idempotent : à rappeler après chaque réponse, succès ou non. */
  updateFromHeaders(methodKey: string, headers: Headers): void {
    const now = this.now();
    const appLimits = parseRateLimitHeader(headers.get("x-app-rate-limit"));
    if (appLimits) this.appGroup.reconfigureFrom(appLimits, now);

    const methodLimits = parseRateLimitHeader(headers.get("x-method-rate-limit"));
    if (methodLimits) this.methodGroup(methodKey).reconfigureFrom(methodLimits, now);
  }

  /**
   * Attend un slot disponible sur les deux paliers puis exécute `fn`, en
   * garantissant qu'une seule requête est en vol à la fois sur l'ensemble du
   * client (peu importe la méthode).
   */
  async schedule<T>(methodKey: string, fn: () => Promise<T>): Promise<T> {
    const task = this.queueTail.then(() => this.runSlotted(methodKey, fn));
    // Ne jamais laisser un rejet interrompre la chaîne pour les appels suivants.
    this.queueTail = task.catch(() => undefined);
    return task;
  }

  private async runSlotted<T>(methodKey: string, fn: () => Promise<T>): Promise<T> {
    const app = this.appGroup;
    const method = this.methodGroup(methodKey);

    for (;;) {
      const now = this.now();
      const waitMs = Math.max(app.msUntilSlot(now), method.msUntilSlot(now));
      if (waitMs <= 0) break;
      this.totalWaitMs += waitMs;
      await this.sleep(waitMs);
    }

    const recordedAt = this.now();
    app.record(recordedAt);
    method.record(recordedAt);
    return fn();
  }
}
