import { schedules, PhysicalStation } from "./data";

export type DayType = "weekday" | "saturday" | "sunday";

export function dayTypeFor(date: Date = new Date()): DayType {
  const d = date.getDay(); // 0=Sun..6=Sat
  if (d === 0) return "sunday";
  if (d === 6) return "saturday";
  return "weekday";
}

function fmtGtfsTime(t: string): string {
  // GTFS times can exceed 24:00:00 for past-midnight trips.
  let [h, m] = t.split(":").map(Number);
  const suffix = h >= 24 ? " (next day)" : "";
  h = h % 24;
  const period = h < 12 ? "AM" : "PM";
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}${suffix}`;
}

export interface StationScheduleInfo {
  line: string;
  dayType: DayType;
  first: string | null;
  last: string | null;
  isFallback: boolean; // true if dayType data was missing and we fell back to weekday
}

export function getSchedule(
  station: PhysicalStation,
  dayType: DayType = dayTypeFor()
): StationScheduleInfo[] {
  if (!station.gtfsStopId) return [];
  const byLine = schedules[station.gtfsStopId];
  if (!byLine) return [];

  const out: StationScheduleInfo[] = [];
  for (const line of station.linesServed) {
    let entry = byLine[line]?.[dayType];
    let isFallback = false;
    if (!entry && dayType !== "weekday") {
      // This GTFS feed doesn't publish a distinct schedule for every
      // line/day combination - weekday timings are the most reliable
      // fallback rather than showing nothing.
      entry = byLine[line]?.["weekday"];
      isFallback = !!entry;
    }
    out.push({
      line,
      dayType,
      first: entry ? fmtGtfsTime(entry.first) : null,
      last: entry ? fmtGtfsTime(entry.last) : null,
      isFallback,
    });
  }
  return out;
}
