"use client";

/**
 * Interactive decision graph - a Duckle-style node canvas for the whole
 * workspace. Decisions are nodes (sized by connectivity, colored by status),
 * typed relations are edges. Supports pan (drag background), zoom (wheel),
 * node drag, hover details, and click-through to the decision.
 *
 * Rendering is plain SVG; layout comes from src/lib/graph-layout.ts. No
 * graph library - a typical workspace's decision count is small enough that a
 * hand-rolled simulation is plenty and keeps the bundle small.
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { runLayout, seedPositions, type GraphEdge } from "@/lib/graph-layout";
import { Text } from "@/components/ui/text";

export interface GraphDecision {
  id: string;
  title: string;
  status: string;
  category: string | null;
  ownerName: string | null;
}

export interface GraphRelation {
  fromDecisionId: string;
  toDecisionId: string;
  relationType: string;
}

interface DecisionGraphCanvasProps {
  decisions: GraphDecision[];
  relations: GraphRelation[];
  /** When true, decisions without any relation are hidden. */
  connectedOnly: boolean;
}

const WORLD_W = 1200;
const WORLD_H = 800;

const STATUS_FILL: Record<string, string> = {
  draft: "#94a3b8",
  proposed: "#818cf8",
  approved: "#10b981",
  active: "#10b981",
  rejected: "#f43f5e",
  superseded: "#f59e0b",
  deprecated: "#f59e0b",
  archived: "#cbd5e1",
};

const EDGE_STYLE: Record<string, { stroke: string; dash?: string; arrow: boolean; label: string }> = {
  supersedes:     { stroke: "#f43f5e", arrow: true,  label: "supersedes" },
  depends_on:     { stroke: "#6366f1", arrow: true,  label: "depends on" },
  relates_to:     { stroke: "#94a3b8", dash: "5 4", arrow: false, label: "relates to" },
  conflicts_with: { stroke: "#f59e0b", dash: "2 4", arrow: true,  label: "conflicts with" },
};

export function DecisionGraphCanvas({ decisions, relations, connectedOnly }: DecisionGraphCanvasProps) {
  const router = useRouter();
  const svgRef = useRef<SVGSVGElement>(null);

  const visible = useMemo(() => {
    if (!connectedOnly) return decisions;
    const connected = new Set<string>();
    for (const r of relations) {
      connected.add(r.fromDecisionId);
      connected.add(r.toDecisionId);
    }
    return decisions.filter((d) => connected.has(d.id));
  }, [decisions, relations, connectedOnly]);

  const initial = useMemo(() => {
    const nodes = seedPositions(visible.map((d) => d.id), WORLD_W, WORLD_H);
    const edges: GraphEdge[] = relations.map((r) => ({ from: r.fromDecisionId, to: r.toDecisionId }));
    return runLayout(nodes, edges, { width: WORLD_W, height: WORLD_H });
  }, [visible, relations]);

  // Positions live in state so nodes are draggable after the initial layout.
  const [positions, setPositions] = useState<Map<string, { x: number; y: number }>>(
    () => new Map(initial.map((n) => [n.id, { x: n.x, y: n.y }])),
  );
  // Re-sync when the underlying graph changes (filter toggle).
  const [lastInitial, setLastInitial] = useState(initial);
  if (lastInitial !== initial) {
    setLastInitial(initial);
    setPositions(new Map(initial.map((n) => [n.id, { x: n.x, y: n.y }])));
  }

  const degree = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of relations) {
      m.set(r.fromDecisionId, (m.get(r.fromDecisionId) ?? 0) + 1);
      m.set(r.toDecisionId, (m.get(r.toDecisionId) ?? 0) + 1);
    }
    return m;
  }, [relations]);

  const byId = useMemo(() => new Map(visible.map((d) => [d.id, d])), [visible]);

  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const [hovered, setHovered] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const drag = useRef<
    | { kind: "pan"; startX: number; startY: number; viewX: number; viewY: number }
    | { kind: "node"; id: string; moved: boolean }
    | null
  >(null);

  const toWorld = useCallback(
    (clientX: number, clientY: number) => {
      const rect = svgRef.current!.getBoundingClientRect();
      const px = ((clientX - rect.left) / rect.width) * WORLD_W;
      const py = ((clientY - rect.top) / rect.height) * WORLD_H;
      return { x: (px - view.x) / view.scale, y: (py - view.y) / view.scale };
    },
    [view],
  );

  function onWheel(e: React.WheelEvent) {
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const next = Math.max(0.35, Math.min(3, view.scale * factor));
    if (next === view.scale) return;
    const rect = svgRef.current!.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * WORLD_W;
    const py = ((e.clientY - rect.top) / rect.height) * WORLD_H;
    // Keep the point under the cursor fixed while zooming.
    setView({
      scale: next,
      x: px - ((px - view.x) / view.scale) * next,
      y: py - ((py - view.y) / view.scale) * next,
    });
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { kind: "pan", startX: e.clientX, startY: e.clientY, viewX: view.x, viewY: view.y };
    setIsDragging(true);
  }

  function onNodePointerDown(e: React.PointerEvent, id: string) {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    drag.current = { kind: "node", id, moved: false };
    setIsDragging(true);
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    if (d.kind === "pan") {
      const rect = svgRef.current!.getBoundingClientRect();
      const dx = ((e.clientX - d.startX) / rect.width) * WORLD_W;
      const dy = ((e.clientY - d.startY) / rect.height) * WORLD_H;
      setView((v) => ({ ...v, x: d.viewX + dx, y: d.viewY + dy }));
    } else {
      d.moved = true;
      const w = toWorld(e.clientX, e.clientY);
      setPositions((prev) => {
        const next = new Map(prev);
        next.set(d.id, { x: w.x, y: w.y });
        return next;
      });
    }
  }

  function onPointerUp() {
    const d = drag.current;
    drag.current = null;
    setIsDragging(false);
    if (d?.kind === "node" && !d.moved) router.push(`/decisions/${d.id}`);
  }

  const hoveredDecision = hovered ? byId.get(hovered) : null;
  const hoveredPos = hovered ? positions.get(hovered) : null;
  const neighborIds = useMemo(() => {
    if (!hovered) return null;
    const s = new Set<string>([hovered]);
    for (const r of relations) {
      if (r.fromDecisionId === hovered) s.add(r.toDecisionId);
      if (r.toDecisionId === hovered) s.add(r.fromDecisionId);
    }
    return s;
  }, [hovered, relations]);

  return (
    <div className="relative overflow-hidden rounded-xs border" style={{borderColor:"rgba(99,102,241,0.12)",background:"#0d0d1a",boxShadow:"0 4px 24px rgba(99,102,241,0.08)"}}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WORLD_W} ${WORLD_H}`}
        className="h-[440px] w-full touch-none select-none sm:h-[560px] lg:h-[640px]"
        style={{ cursor: isDragging ? "grabbing" : "grab" }}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <defs>
          {Object.entries(EDGE_STYLE).map(([type, s]) => (
            <marker key={type} id={`arrow-${type}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 1 L 9 5 L 0 9 z" fill={s.stroke} />
            </marker>
          ))}
          <radialGradient id="node-sheen" cx="0.35" cy="0.3" r="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.55)" />
            <stop offset="45%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
        </defs>

        {/* Dot grid that pans/zooms with the world */}
        <g transform={`translate(${view.x},${view.y}) scale(${view.scale})`}>
          {Array.from({ length: 13 }, (_, i) => (
            <line key={`v${i}`} x1={i * 100} y1={0} x2={i * 100} y2={WORLD_H} stroke="rgba(99,102,241,0.07)" strokeWidth={1 / view.scale} />
          ))}
          {Array.from({ length: 9 }, (_, i) => (
            <line key={`h${i}`} x1={0} y1={i * 100} x2={WORLD_W} y2={i * 100} stroke="rgba(99,102,241,0.07)" strokeWidth={1 / view.scale} />
          ))}

          {/* Edges */}
          {relations.map((r, i) => {
            const a = positions.get(r.fromDecisionId);
            const b = positions.get(r.toDecisionId);
            if (!a || !b) return null;
            const s = EDGE_STYLE[r.relationType] ?? EDGE_STYLE.relates_to;
            const dim = neighborIds && !(neighborIds.has(r.fromDecisionId) && neighborIds.has(r.toDecisionId));
            // Pull the line end back so the arrow tip touches the node edge.
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const rB = nodeRadius(degree.get(r.toDecisionId) ?? 0) + 3;
            const ex = b.x - (dx / dist) * rB;
            const ey = b.y - (dy / dist) * rB;
            return (
              <line
                key={i}
                x1={a.x} y1={a.y} x2={ex} y2={ey}
                stroke={s.stroke}
                strokeWidth={1.6}
                strokeDasharray={s.dash}
                opacity={dim ? 0.12 : 0.8}
                markerEnd={s.arrow ? `url(#arrow-${r.relationType})` : undefined}
              />
            );
          })}

          {/* Nodes */}
          {visible.map((d) => {
            const p = positions.get(d.id);
            if (!p) return null;
            const r = nodeRadius(degree.get(d.id) ?? 0);
            const fill = STATUS_FILL[d.status] ?? "#818cf8";
            const dim = neighborIds && !neighborIds.has(d.id);
            const isHover = hovered === d.id;
            return (
              <g
                key={d.id}
                transform={`translate(${p.x},${p.y})`}
                opacity={dim ? 0.25 : 1}
                onPointerDown={(e) => onNodePointerDown(e, d.id)}
                onPointerEnter={() => setHovered(d.id)}
                onPointerLeave={() => setHovered(null)}
                style={{ cursor: "pointer" }}
              >
                {isHover && <circle r={r + 7} fill="none" stroke={fill} strokeWidth={1.5} opacity={0.5} />}
                <circle r={r} fill={fill} opacity={0.92} />
                <circle r={r} fill="url(#node-sheen)" />
                <circle r={r} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={1} />
                <text
                  y={r + 14}
                  textAnchor="middle"
                  fontSize={11}
                  fill={isHover ? "#e0e7ff" : "#94a3b8"}
                  fontWeight={isHover ? 700 : 500}
                  style={{ pointerEvents: "none" }}
                >
                  {d.title.length > 28 ? `${d.title.slice(0, 27)}…` : d.title}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Hover panel */}
      {hoveredDecision && hoveredPos && (
        <div className="pointer-events-none absolute left-4 top-4 max-w-xs rounded-xs px-4 py-3" style={{background:"rgba(15,15,31,0.92)",border:"1px solid rgba(99,102,241,0.3)",backdropFilter:"blur(8px)"}}>
          <Text as="p" size="sm" weight="semibold" color="inverse">
            {hoveredDecision.title}
          </Text>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <div className="inline-block h-2 w-2 rounded-full" style={{ background: STATUS_FILL[hoveredDecision.status] ?? "#818cf8" }} />
              <Text as="span" size="sm" color="subtle">
                {hoveredDecision.status}
              </Text>
            </span>
            {hoveredDecision.category && (
              <Text as="span" size="sm" color="subtle">{hoveredDecision.category}</Text>
            )}
            {hoveredDecision.ownerName && (
              <Text as="span" size="sm" color="subtle">{hoveredDecision.ownerName}</Text>
            )}
            <Text as="span" size="sm" color="subtle">
              {degree.get(hoveredDecision.id) ?? 0} connection{(degree.get(hoveredDecision.id) ?? 0) === 1 ? "" : "s"}
            </Text>
          </div>
          <Text as="p" size="2xs" color="brand-soft">
            Click to open · drag to reposition
          </Text>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xs px-3.5 py-2.5" style={{background:"rgba(15,15,31,0.85)",border:"1px solid rgba(99,102,241,0.18)",backdropFilter:"blur(8px)"}}>
        {Object.entries(EDGE_STYLE).map(([type, s]) => (
          <span key={type} className="inline-flex items-center gap-1.5">
            <svg width="22" height="8" viewBox="0 0 22 8">
              <line x1="1" y1="4" x2="21" y2="4" stroke={s.stroke} strokeWidth="1.8" strokeDasharray={s.dash} />
            </svg>
            <Text as="span" size="sm" color="subtle">
              {s.label}
            </Text>
          </span>
        ))}
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1">
        {([["+", 1.25], ["−", 1 / 1.25]] as const).map(([label, f]) => (
          <button
            key={label}
            type="button"
            aria-label={label === "+" ? "Zoom in" : "Zoom out"}
            onClick={() => {
              const next = Math.max(0.35, Math.min(3, view.scale * f));
              const cx = WORLD_W / 2;
              const cy = WORLD_H / 2;
              setView((v) => ({ scale: next, x: cx - ((cx - v.x) / v.scale) * next, y: cy - ((cy - v.y) / v.scale) * next }));
            }}
            className="flex h-8 w-8 items-center justify-center rounded-xs transition-colors hover:text-white"
            style={{background:"rgba(15,15,31,0.85)",border:"1px solid rgba(99,102,241,0.2)"}}
          >
            <Text as="span" size="base" weight="bold" color="subtle">{label}</Text>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setView({ x: 0, y: 0, scale: 1 })}
          className="flex h-8 w-8 items-center justify-center rounded-xs transition-colors hover:text-white"
          style={{background:"rgba(15,15,31,0.85)",border:"1px solid rgba(99,102,241,0.2)"}}
          aria-label="Reset view"
        >
          <Text as="span" size="2xs" weight="bold" color="subtle">⛶</Text>
        </button>
      </div>
    </div>
  );
}

function nodeRadius(degree: number): number {
  return 10 + Math.min(12, degree * 2.5);
}
