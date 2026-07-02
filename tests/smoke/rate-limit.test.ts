import { rateLimit } from "../../src/lib/rate-limit";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

// No REDIS_URL in the test env, so check() exercises the in-memory backend.
export const rateLimitTests = {
  "allows up to limit, blocks beyond": async () => {
    const rl = rateLimit({ limit: 3, windowMs: 60_000, prefix: "t1" });
    const k = "ip:1.2.3.4";
    for (let i = 0; i < 3; i++) {
      const r = await rl.check(k);
      assert(r.ok, `request ${i + 1} should pass`);
    }
    const blocked = await rl.check(k);
    assert(!blocked.ok, "fourth request must be blocked");
    assert(blocked.headers["Retry-After"], "blocked response must have Retry-After");
  },

  "separate keys are isolated": async () => {
    const rl = rateLimit({ limit: 1, windowMs: 60_000, prefix: "t2" });
    assert((await rl.check("a")).ok, "key a first request ok");
    assert((await rl.check("b")).ok, "key b first request ok");
    assert(!(await rl.check("a")).ok, "key a second request blocked");
    assert(!(await rl.check("b")).ok, "key b second request blocked");
  },

  "bucket resets after window": async () => {
    const rl = rateLimit({ limit: 1, windowMs: 50, prefix: "t3" });
    const k = "ip:9.9.9.9";
    assert((await rl.check(k)).ok, "first ok");
    assert(!(await rl.check(k)).ok, "second blocked");
    await new Promise((r) => setTimeout(r, 80));
    assert((await rl.check(k)).ok, "should reset after window elapses");
  },

  "headers expose remaining count": async () => {
    const rl = rateLimit({ limit: 5, windowMs: 60_000, prefix: "t4" });
    const r1 = await rl.check("x");
    const r2 = await rl.check("x");
    assert(r1.headers["X-RateLimit-Remaining"] === "4", "first should have 4 remaining");
    assert(r2.headers["X-RateLimit-Remaining"] === "3", "second should have 3 remaining");
  },
};
