import { describe, expect, it } from "vitest";
import { RiotRateLimiter } from "./limiter";

function makeClock(startMs = 0) {
  let current = startMs;
  return {
    now: () => current,
    sleep: async (ms: number) => {
      current += ms;
    },
    advance: (ms: number) => {
      current += ms;
    },
    get current() {
      return current;
    },
  };
}

describe("RiotRateLimiter", () => {
  it("laisse passer immédiatement jusqu'à la limite de la fenêtre", async () => {
    const clock = makeClock();
    const limiter = new RiotRateLimiter({
      appSeed: [{ limit: 3, windowMs: 1_000 }],
      methodSeed: [{ limit: 1_000, windowMs: 1_000 }],
      now: clock.now,
      sleep: clock.sleep,
    });

    for (let i = 0; i < 3; i++) {
      await limiter.schedule("m", async () => {});
    }

    expect(limiter.totalWaitMs).toBe(0);
  });

  it("attend une fenêtre glissante réelle (pas un délai fixe) une fois la limite atteinte", async () => {
    const clock = makeClock();
    const limiter = new RiotRateLimiter({
      appSeed: [{ limit: 2, windowMs: 1_000 }],
      methodSeed: [{ limit: 1_000, windowMs: 1_000 }],
      now: clock.now,
      sleep: clock.sleep,
    });

    await limiter.schedule("m", async () => {}); // t=0
    clock.advance(400);
    await limiter.schedule("m", async () => {}); // t=400, fenêtre pleine (2/2)
    // Le 3e appel doit attendre l'expiration du jeton le plus ancien (t=0 → 1000),
    // pas 1000ms fixes depuis maintenant.
    await limiter.schedule("m", async () => {});

    expect(limiter.totalWaitMs).toBe(600);
    expect(clock.current).toBe(1_000);
  });

  it("respecte simultanément deux fenêtres app (courte et longue)", async () => {
    const clock = makeClock();
    const limiter = new RiotRateLimiter({
      appSeed: [
        { limit: 2, windowMs: 1_000 },
        { limit: 3, windowMs: 5_000 },
      ],
      methodSeed: [{ limit: 1_000, windowMs: 1_000 }],
      now: clock.now,
      sleep: clock.sleep,
    });

    await limiter.schedule("m", async () => {}); // court 1/2, long 1/3 — t=0
    await limiter.schedule("m", async () => {}); // court 2/2, long 2/3 — t=0
    await limiter.schedule("m", async () => {}); // court plein -> attend jusqu'à t=1000 ; long 3/3
    await limiter.schedule("m", async () => {}); // court ok à nouveau, mais long plein -> attend jusqu'à t=5000

    expect(clock.current).toBe(5_000);
  });

  it("comptabilise les paliers method-level séparément par endpoint", async () => {
    const clock = makeClock();
    const limiter = new RiotRateLimiter({
      appSeed: [{ limit: 1_000, windowMs: 1_000 }],
      methodSeed: [{ limit: 1, windowMs: 1_000 }],
      now: clock.now,
      sleep: clock.sleep,
    });

    await limiter.schedule("match-ids", async () => {});
    // "match-ids" a épuisé son seau method-level ; "match-detail" est une
    // comptabilité indépendante et ne doit pas être affecté.
    await limiter.schedule("match-detail", async () => {});

    expect(limiter.totalWaitMs).toBe(0);
  });

  it("reconfigure les seaux à chaud depuis les en-têtes de réponse — aucune limite codée en dur", async () => {
    const clock = makeClock();
    const limiter = new RiotRateLimiter({
      appSeed: [{ limit: 2, windowMs: 1_000 }],
      methodSeed: [{ limit: 1_000, windowMs: 1_000 }],
      now: clock.now,
      sleep: clock.sleep,
    });

    await limiter.schedule("m", async () => {});
    limiter.updateFromHeaders("m", new Headers({ "X-App-Rate-Limit": "500:1" }));

    // Avec la graine de départ (2/1s), 50 appels supplémentaires auraient
    // massivement attendu. Avec la limite annoncée par Riot (500/1s), non.
    for (let i = 0; i < 50; i++) {
      await limiter.schedule("m", async () => {});
    }

    expect(limiter.totalWaitMs).toBe(0);
  });

  it("honore un en-tête X-Method-Rate-Limit distinct de X-App-Rate-Limit", async () => {
    const clock = makeClock();
    const limiter = new RiotRateLimiter({
      appSeed: [{ limit: 1_000, windowMs: 1_000 }],
      methodSeed: [{ limit: 2, windowMs: 1_000 }],
      now: clock.now,
      sleep: clock.sleep,
    });

    await limiter.schedule("match-by-id", async () => {});
    limiter.updateFromHeaders(
      "match-by-id",
      new Headers({ "X-Method-Rate-Limit": "1:1" }),
    );
    // La méthode est maintenant limitée à 1/1s et vient d'être utilisée à t=0.
    await limiter.schedule("match-by-id", async () => {});

    expect(limiter.totalWaitMs).toBe(1_000);
    expect(clock.current).toBe(1_000);
  });

  it("sérialise les appels : une seule requête en vol à la fois", async () => {
    const clock = makeClock();
    const limiter = new RiotRateLimiter({
      appSeed: [{ limit: 1_000, windowMs: 1_000 }],
      methodSeed: [{ limit: 1_000, windowMs: 1_000 }],
      now: clock.now,
      sleep: clock.sleep,
    });

    const order: string[] = [];
    let inFlight = 0;
    let maxInFlight = 0;

    function task(label: string) {
      return limiter.schedule("m", async () => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        order.push(`start:${label}`);
        await new Promise((resolve) => setTimeout(resolve, 0));
        order.push(`end:${label}`);
        inFlight--;
      });
    }

    await Promise.all([task("a"), task("b"), task("c")]);

    expect(maxInFlight).toBe(1);
    expect(order).toEqual(["start:a", "end:a", "start:b", "end:b", "start:c", "end:c"]);
  });
});
