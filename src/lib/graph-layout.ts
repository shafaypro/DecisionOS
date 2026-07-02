/**
 * Zero-dependency force-directed graph layout for the decision graph.
 *
 * Plain Fruchterman-Reingold-style simulation: node repulsion + edge springs
 * + center gravity, run for a fixed number of iterations server- or
 * client-side. Deterministic for a given input (seeded initial positions via
 * golden-angle spiral, no Math.random) so layouts are stable across reloads
 * and the smoke tests can assert on convergence behaviour.
 */

export interface GraphNode {
  id: string;
  /** Connected component weight - more connections = stronger presence. */
  degree: number;
  x: number;
  y: number;
}

export interface GraphEdge {
  from: string;
  to: string;
}

export interface LayoutOptions {
  width: number;
  height: number;
  iterations?: number;
  /** Ideal edge length in px. */
  springLength?: number;
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** Deterministic initial placement: golden-angle spiral from the center. */
export function seedPositions(
  ids: string[],
  width: number,
  height: number,
): GraphNode[] {
  const cx = width / 2;
  const cy = height / 2;
  const spread = Math.min(width, height) * 0.38;
  return ids.map((id, i) => {
    const r = spread * Math.sqrt((i + 1) / ids.length);
    const theta = i * GOLDEN_ANGLE;
    return { id, degree: 0, x: cx + r * Math.cos(theta), y: cy + r * Math.sin(theta) };
  });
}

/**
 * Run the simulation, mutating and returning node positions.
 * Nodes stay inside [pad, width-pad] x [pad, height-pad].
 */
export function runLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  opts: LayoutOptions,
): GraphNode[] {
  const { width, height } = opts;
  const iterations = opts.iterations ?? 220;
  const springLength = opts.springLength ?? 130;
  const pad = 40;
  const cx = width / 2;
  const cy = height / 2;

  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const n of nodes) n.degree = 0;
  const resolved = edges
    .map((e) => ({ a: byId.get(e.from), b: byId.get(e.to) }))
    .filter((e): e is { a: GraphNode; b: GraphNode } => Boolean(e.a && e.b));
  for (const { a, b } of resolved) {
    a.degree += 1;
    b.degree += 1;
  }

  // Repulsion magnitude works out to k2/d (the direction vector below is
  // unnormalized). Pick k2 so that repulsion balances center gravity at a
  // target cluster radius of ~30% of the canvas, independent of node count.
  const gravity = 0.03;
  const targetR = Math.min(width, height) * 0.3;
  const k2 = (gravity * targetR * targetR) / Math.max(nodes.length - 1, 1);

  for (let iter = 0; iter < iterations; iter++) {
    // Cooling schedule: large early moves, fine settling at the end.
    const temp = (1 - iter / iterations) * Math.min(width, height) * 0.08 + 0.5;
    const fx = new Map<string, number>();
    const fy = new Map<string, number>();
    for (const n of nodes) {
      fx.set(n.id, 0);
      fy.set(n.id, 0);
    }

    // Pairwise repulsion.
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 0.01) {
          // Coincident nodes: nudge apart deterministically by index.
          dx = 0.1 * (i + 1);
          dy = 0.1 * (j + 1);
          d2 = dx * dx + dy * dy;
        }
        const f = k2 / d2;
        fx.set(a.id, fx.get(a.id)! + dx * f);
        fy.set(a.id, fy.get(a.id)! + dy * f);
        fx.set(b.id, fx.get(b.id)! - dx * f);
        fy.set(b.id, fy.get(b.id)! - dy * f);
      }
    }

    // Edge springs.
    for (const { a, b } of resolved) {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 0.1;
      const f = ((d - springLength) / d) * 0.18;
      fx.set(a.id, fx.get(a.id)! + dx * f);
      fy.set(a.id, fy.get(a.id)! + dy * f);
      fx.set(b.id, fx.get(b.id)! - dx * f);
      fy.set(b.id, fy.get(b.id)! - dy * f);
    }

    // Center gravity - isolated nodes orbit instead of flying off.
    for (const n of nodes) {
      fx.set(n.id, fx.get(n.id)! + (cx - n.x) * gravity);
      fy.set(n.id, fy.get(n.id)! + (cy - n.y) * gravity);
    }

    // Apply capped displacement.
    for (const n of nodes) {
      const dx = fx.get(n.id)!;
      const dy = fy.get(n.id)!;
      const d = Math.sqrt(dx * dx + dy * dy) || 0.1;
      const cap = Math.min(d, temp);
      n.x += (dx / d) * cap;
      n.y += (dy / d) * cap;
      n.x = Math.max(pad, Math.min(width - pad, n.x));
      n.y = Math.max(pad, Math.min(height - pad, n.y));
    }
  }

  return nodes;
}
