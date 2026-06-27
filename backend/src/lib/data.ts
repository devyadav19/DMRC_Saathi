import stationsRaw from "../data/stations.json";
import gatesRaw from "../data/gates.json";
import linesRaw from "../data/lines.json";
import graphRaw from "../data/graph.json";
import schedulesRaw from "../data/schedules.json";
import gtfsStopsRaw from "../data/gtfs_stops.json";

export interface StationRow {
  code: string;
  name: string;
  commercialName: string | null;
  line: string | number;
  type: string;
  isInterchange: boolean;
  lat: number | null;
  lon: number | null;
  gtfsStopId: string | null;
  gtfsName: string | null;
}

export interface Gate {
  station_code: string;
  gate_name: string;
  location: string;
  lat: number | null;
  lon: number | null;
}

export interface GraphEdge {
  to: string;
  line: string;
  time_sec: number;
}

export interface ScheduleEntry {
  first: string;
  last: string;
  trip_count: number;
}

export const stations: StationRow[] = stationsRaw as StationRow[];
export const gates: Gate[] = gatesRaw as Gate[];
export const graph: Record<string, GraphEdge[]> = graphRaw as Record<string, GraphEdge[]>;
export const schedules: Record<string, Record<string, Record<string, ScheduleEntry>>> =
  schedulesRaw as any;
export const lines = linesRaw as Record<string, { color: string; route_ids: string[] }>;

// --- Indices -----------------------------------------------------------

// One physical station can appear multiple times in `stations` (once per
// line it serves). Group by gtfsStopId (the real physical-station key)
// so we can answer "what lines serve this station" and "is it an
// interchange" without duplicates.
export interface PhysicalStation {
  gtfsStopId: string | null;
  name: string;
  commercialName: string | null;
  linesServed: string[];
  isInterchange: boolean;
  codes: string[];
  lat: number | null;
  lon: number | null;
  hasSchedule: boolean;
}

// A station counts as a true interchange if 2+ distinct GTFS lines pass
// through its stop_id in the graph (more reliable than the xlsx Y/N flag,
// which is occasionally inconsistent in source data). Built first so it
// can also be used as the authoritative source for `linesServed` below -
// the xlsx "line" column is a numeric internal code, not a GTFS color, and
// must never be used directly for schedule/line lookups.
export interface GtfsStop {
  id: string;
  name: string;
  lat: number;
  lon: number;
}
export const gtfsStops: GtfsStop[] = gtfsStopsRaw as GtfsStop[];
const gtfsStopById = new Map<string, GtfsStop>();
for (const s of gtfsStops) gtfsStopById.set(s.id, s);

const linesAtStop = new Map<string, Set<string>>();
for (const [fromId, edges] of Object.entries(graph)) {
  for (const e of edges) {
    if (!linesAtStop.has(fromId)) linesAtStop.set(fromId, new Set());
    linesAtStop.get(fromId)!.add(e.line);
    if (!linesAtStop.has(e.to)) linesAtStop.set(e.to, new Set());
    linesAtStop.get(e.to)!.add(e.line);
  }
}

const byGtfsId = new Map<string, PhysicalStation>();
const byNameFallback = new Map<string, PhysicalStation>(); // for stations with no GTFS id yet (too new for this feed)

for (const s of stations) {
  const map = s.gtfsStopId ? byGtfsId : byNameFallback;
  const mapKey = s.gtfsStopId ?? s.name.toLowerCase();
  let existing = map.get(mapKey);
  if (!existing) {
    existing = {
      gtfsStopId: s.gtfsStopId,
      name: s.gtfsName ?? s.name,
      commercialName: s.commercialName,
      linesServed: s.gtfsStopId ? Array.from(linesAtStop.get(s.gtfsStopId) ?? []) : [],
      isInterchange: false,
      codes: [],
      lat: s.lat,
      lon: s.lon,
      hasSchedule: !!s.gtfsStopId,
    };
    map.set(mapKey, existing);
  }
  if (!existing.codes.includes(s.code)) existing.codes.push(s.code);
  if (existing.linesServed.length === 0) {
    // no graph data for this stop (e.g. isolated/unlinked) - fall back to
    // the xlsx line label so the UI still shows *something* identifiable.
    const lineLabel = String(s.line);
    if (!existing.linesServed.includes(lineLabel)) existing.linesServed.push(lineLabel);
  }
}

// Add a PhysicalStation entry for every GTFS stop that has no xlsx row at
// all (covers most NMRC Aqua Line stations and a couple of DMRC stations
// missing from the source spreadsheet) - without this, journey-planner
// results passing through these stops would show a raw numeric ID instead
// of a station name.
for (const stop of gtfsStops) {
  if (!byGtfsId.has(stop.id)) {
    byGtfsId.set(stop.id, {
      gtfsStopId: stop.id,
      name: stop.name,
      commercialName: null,
      linesServed: Array.from(linesAtStop.get(stop.id) ?? []),
      isInterchange: false,
      codes: [],
      lat: stop.lat,
      lon: stop.lon,
      hasSchedule: true,
    });
  }
}

for (const ps of [...byGtfsId.values()]) {
  const set = ps.gtfsStopId ? linesAtStop.get(ps.gtfsStopId) : undefined;
  if (set && set.size >= 2) ps.isInterchange = true;
}

export const physicalStations: PhysicalStation[] = [
  ...Array.from(byGtfsId.values()),
  ...Array.from(byNameFallback.values()),
];

export const gatesByCode = new Map<string, Gate[]>();
for (const g of gates) {
  const arr = gatesByCode.get(g.station_code) ?? [];
  arr.push(g);
  gatesByCode.set(g.station_code, arr);
}

export function getGatesForStation(station: PhysicalStation): Gate[] {
  const out: Gate[] = [];
  for (const code of station.codes) {
    const arr = gatesByCode.get(code);
    if (arr) out.push(...arr);
  }
  return out;
}

const physicalStationByGtfsId = new Map<string, PhysicalStation>();
for (const ps of physicalStations) {
  if (ps.gtfsStopId) physicalStationByGtfsId.set(ps.gtfsStopId, ps);
}

export function findStationByGtfsId(id: string): PhysicalStation | undefined {
  return physicalStationByGtfsId.get(id);
}
