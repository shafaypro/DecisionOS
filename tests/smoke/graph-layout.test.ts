import { seedPositions, runLayout } from "../../src/lib/graph-layout";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const W = 1200;
const H = 800;
const IDS = ["a", "b", "c", "d", "e"];

export const graphLayoutTests = {
  "seedPositions: one node per id, inside the canvas": () => {
    const seeded = seedPositions(IDS, W, H);
    assert(seeded.length === 5, "one node per id");
    assert(
      seeded.every((n) => n.x >= 0 && n.x <= W && n.y >= 0 && n.y <= H),
      "seed positions inside canvas",
    );
  },

  "runLayout: deterministic - same input, same output": () => {
    const edges = [{ from: "a", to: "b" }];
    const run1 = runLayout(seedPositions(IDS, W, H), edges, { width: W, height: H });
    const run2 = runLayout(seedPositions(IDS, W, H), edges, { width: W, height: H });
    assert(
      run1.every((n, i) => n.x === run2[i].x && n.y === run2[i].y),
      "layout must be deterministic (no Math.random)",
    );
  },

  "runLayout: nodes respect canvas padding": () => {
    const laid = runLayout(seedPositions(IDS, W, H), [{ from: "a", to: "b" }], { width: W, height: H });
    assert(
      laid.every((n) => n.x >= 40 && n.x <= W - 40 && n.y >= 40 && n.y <= H - 40),
      "all nodes inside padded bounds",
    );
  },

  "runLayout: connected nodes end up closer than unconnected": () => {
    const edges = [
      { from: "a", to: "b" },
      { from: "b", to: "c" },
    ];
    const laid = runLayout(seedPositions(IDS, W, H), edges, { width: W, height: H });
    const pos = new Map(laid.map((n) => [n.id, n]));
    const dist = (p: string, q: string) => {
      const x = pos.get(p)!;
      const y = pos.get(q)!;
      return Math.hypot(x.x - y.x, x.y - y.y);
    };
    assert(dist("a", "b") < dist("a", "e"), "spring should pull a-b closer than a-e");
  },

  "runLayout: degree counts both directions, isolated = 0": () => {
    const edges = [
      { from: "a", to: "b" },
      { from: "b", to: "c" },
    ];
    const laid = runLayout(seedPositions(IDS, W, H), edges, { width: W, height: H });
    const pos = new Map(laid.map((n) => [n.id, n]));
    assert(pos.get("b")!.degree === 2, "b participates in two edges");
    assert(pos.get("e")!.degree === 0, "e has no edges");
  },

  "runLayout: edges with unknown endpoints are skipped, not fatal": () => {
    const laid = runLayout(
      seedPositions(["x"], 600, 400),
      [{ from: "x", to: "ghost" }],
      { width: 600, height: 400 },
    );
    assert(laid.length === 1, "single node survives");
    assert(laid[0].degree === 0, "dangling edge does not count toward degree");
  },
};
