import { graph, GraphEdge, findStationByGtfsId, PhysicalStation } from "./data";

export interface JourneyLeg {
  stationName: string;
  gtfsStopId: string;
  line: string | null; // line used to arrive at this station; null for origin
  isInterchange: boolean;
}

export interface JourneyResult {
  legs: JourneyLeg[];
  totalSeconds: number;
  stationCount: number; // number of stations traveled through, excluding origin
  interchanges: { atStation: string; fromLine: string; toLine: string }[];
  linesUsed: string[];
  usesAirportExpress: boolean;
}

const INTERCHANGE_PENALTY_SEC = 180; // ~3 min walking/transfer time at an interchange
const PREMIUM_LINES = new Set(["ORANGE/AIRPORT"]);

interface PQItem {
  cost: number;
  node: string;
  line: string | null;
}

function dijkstra(
  srcId: string,
  dstId: string,
  avoidLines: Set<string> = new Set()
): { node: string; line: string | null; cost: number }[] | null {
  // Simple binary-heap-free priority queue (array + sort) - the network
  // is small (~260 stations) so this is fast enough without a heap lib.
  const dist = new Map<string, number>();
  const prev = new Map<string, { node: string; line: string | null; cost: number }>();
  const visited = new Set<string>();
  let pq: PQItem[] = [{ cost: 0, node: srcId, line: null }];

  const keyOf = (node: string, line: string | null) => `${node}|${line ?? ""}`;
  dist.set(keyOf(srcId, null), 0);

  while (pq.length) {
    pq.sort((a, b) => a.cost - b.cost);
    const cur = pq.shift()!;
    const vKey = keyOf(cur.node, cur.line);
    if (visited.has(vKey)) continue;
    visited.add(vKey);

    if (cur.node === dstId) {
      // reconstruct path
      const path: { node: string; line: string | null; cost: number }[] = [
        { node: cur.node, line: cur.line, cost: cur.cost },
      ];
      let k = vKey;
      while (prev.has(k)) {
        const p = prev.get(k)!;
        path.push(p);
        k = keyOf(p.node, p.line);
      }
      path.reverse();
      return path;
    }

    const edges: GraphEdge[] = graph[cur.node] ?? [];
    for (const e of edges) {
      if (avoidLines.has(e.line)) continue;
      const penalty = cur.line && cur.line !== e.line ? INTERCHANGE_PENALTY_SEC : 0;
      const ncost = cur.cost + e.time_sec + penalty;
      const nKey = keyOf(e.to, e.line);
      if (!dist.has(nKey) || ncost < dist.get(nKey)!) {
        dist.set(nKey, ncost);
        prev.set(nKey, { node: cur.node, line: cur.line, cost: cur.cost });
        pq.push({ cost: ncost, node: e.to, line: e.line });
      }
    }
  }
  return null;
}

function buildResult(
  path: { node: string; line: string | null; cost: number }[]
): JourneyResult {
  const legs: JourneyLeg[] = [];
  const interchanges: JourneyResult["interchanges"] = [];
  const linesUsed = new Set<string>();
  let lastLine: string | null = null;

  for (const step of path) {
    const station = findStationByGtfsId(step.node);
    const name = station?.name ?? step.node;
    if (step.line) linesUsed.add(step.line);
    const isInterchange = !!(lastLine && step.line && lastLine !== step.line);
    if (isInterchange) {
      interchanges.push({
        atStation: legs[legs.length - 1]?.stationName ?? name,
        fromLine: lastLine!,
        toLine: step.line!,
      });
    }
    legs.push({
      stationName: name,
      gtfsStopId: step.node,
      line: step.line,
      isInterchange,
    });
    if (step.line) lastLine = step.line;
  }

  const totalSeconds = path[path.length - 1]?.cost ?? 0;
  return {
    legs,
    totalSeconds,
    stationCount: Math.max(0, legs.length - 1),
    interchanges,
    linesUsed: Array.from(linesUsed),
    usesAirportExpress: Array.from(linesUsed).some((l) => PREMIUM_LINES.has(l)),
  };
}

export interface PlanJourneyOptions {
  /** Avoid the Airport Express line in the primary recommendation (it carries a separate, higher fare). Default true. */
  preferStandardFare?: boolean;
}

export interface PlanJourneyOutput {
  primary: JourneyResult | null;
  alternateViaAirportExpress: JourneyResult | null;
  error?: string;
}

export function planJourney(
  origin: PhysicalStation,
  destination: PhysicalStation,
  options: PlanJourneyOptions = {}
): PlanJourneyOutput {
  const preferStandard = options.preferStandardFare !== false;

  if (!origin.gtfsStopId || !destination.gtfsStopId) {
    return {
      primary: null,
      alternateViaAirportExpress: null,
      error:
        "One of these stations is very new and isn't in the current schedule dataset yet, so I can't compute exact timings for it.",
    };
  }
  if (origin.gtfsStopId === destination.gtfsStopId) {
    return {
      primary: null,
      alternateViaAirportExpress: null,
      error: "Origin and destination appear to be the same station.",
    };
  }

  let primaryPath = preferStandard
    ? dijkstra(origin.gtfsStopId, destination.gtfsStopId, new Set(["ORANGE/AIRPORT"]))
    : dijkstra(origin.gtfsStopId, destination.gtfsStopId);

  // If avoiding Airport Express makes the journey impossible (i.e. only
  // route is via that line), fall back to allowing it.
  if (!primaryPath) {
    primaryPath = dijkstra(origin.gtfsStopId, destination.gtfsStopId);
  }

  const airportPath = dijkstra(origin.gtfsStopId, destination.gtfsStopId); // unrestricted (may equal primary)

  if (!primaryPath) {
    return {
      primary: null,
      alternateViaAirportExpress: null,
      error: "I couldn't find a route between these two stations in the network data.",
    };
  }

  const primary = buildResult(primaryPath);
  const altResult = airportPath ? buildResult(airportPath) : null;
  const showAlternate =
    altResult &&
    altResult.usesAirportExpress &&
    altResult.totalSeconds < primary.totalSeconds - 60; // only show if meaningfully faster

  return {
    primary,
    alternateViaAirportExpress: showAlternate ? altResult : null,
  };
}

export function formatDuration(totalSeconds: number): string {
  const mins = Math.round(totalSeconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}
