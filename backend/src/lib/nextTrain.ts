// Next train departures — IMPORTANT: this is TIMETABLE-BASED (static GTFS),
// not live GPS tracking. We can tell you when a train is SCHEDULED to depart,
// but not whether it is actually running on time right now.
//
// For live real-time tracking (actual train position, delays), DMRC would need
// to provide a GTFS-RT (real-time) feed. As of this build, DMRC does not
// publish a public GTFS-RT feed — see the README for what API key/partnership
// would be needed to enable it.

import departuresRaw from "../data/departures.json";
import { PhysicalStation } from "./data";
import { dayTypeFor, DayType } from "./schedule";

// Decode delta-encoded departure times back to absolute seconds
const departures: Record<string, number[]> = {};
for (const [key, deltas] of Object.entries(departuresRaw as Record<string, number[]>)) {
  if (!deltas.length) continue;
  const times: number[] = [deltas[0]];
  for (let i = 1; i < deltas.length; i++) {
    times.push(times[i - 1] + deltas[i]);
  }
  departures[key] = times;
}

export interface UpcomingDeparture {
  line: string;
  departureSeconds: number; // seconds since midnight, may exceed 86400 for post-midnight trains
  minutesFromNow: number;
  formattedTime: string; // e.g. "09:42 AM"
  isNextDay: boolean;
}

function nowInSeconds(): number {
  const now = new Date();
  return now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
}

function formatSec(sec: number): string {
  const h = Math.floor(sec / 3600) % 24;
  const m = Math.floor((sec % 3600) / 60);
  const period = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

/**
 * Returns the next N scheduled departures from a station on each of its
 * lines, starting from now (or a custom `fromSeconds`).
 */
export function getNextDepartures(
  station: PhysicalStation,
  options: {
    count?: number;
    fromSeconds?: number;
    dayType?: DayType;
  } = {}
): UpcomingDeparture[] {
  if (!station.gtfsStopId) return [];

  const count = options.count ?? 3;
  const nowSec = options.fromSeconds ?? nowInSeconds();
  const dayType = options.dayType ?? dayTypeFor();

  const results: UpcomingDeparture[] = [];

  for (const line of station.linesServed) {
    const key = `${station.gtfsStopId}|${line}|${dayType}`;
    const times = departures[key] ?? departures[`${station.gtfsStopId}|${line}|weekday`] ?? [];

    // Find next `count` departures from nowSec (times may exceed 86400 for
    // post-midnight trains e.g. 25:09 = 1:09 AM next morning)
    let found = 0;
    for (const sec of times) {
      if (sec >= nowSec && found < count) {
        results.push({
          line,
          departureSeconds: sec,
          minutesFromNow: Math.round((sec - nowSec) / 60),
          formattedTime: formatSec(sec),
          isNextDay: sec >= 86400,
        });
        found++;
      }
    }
  }

  results.sort((a, b) => a.minutesFromNow - b.minutesFromNow);
  return results;
}
