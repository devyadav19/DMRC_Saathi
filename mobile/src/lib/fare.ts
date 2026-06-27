// Fare calculation — DMRC token and smart-card prices.
//
// DMRC's fare is based on their internal distance system, NOT track geometry.
// The GTFS feed doesn't publish a fare table. After testing multiple
// approaches (time-based distance estimation, calibrated GTFS geometry),
// we found that STATION COUNT correlates most reliably with the actual
// published fare slabs — verified against DMRC's official fare calculator
// for representative routes across all lines.
//
// Smart card = 10% discount on token fare (always, on all days).
// Sunday/holiday = discounted slab structure (same thresholds, lower fares).
//
// Always label these as ESTIMATES in the UI — they're derived from station
// count approximation, not the official DMRC fare engine.

export interface FareSlab {
  maxStations: number;
  token: number;
  smartCard: number;
}

// Verified against DMRC's official published fare chart.
// Max token fare is ₹60 (>32 stations), not ₹64 — the old code had a typo.
export const WEEKDAY_SLABS: FareSlab[] = [
  { maxStations: 3,   token: 11, smartCard: 10 },
  { maxStations: 7,   token: 21, smartCard: 19 },
  { maxStations: 12,  token: 32, smartCard: 29 },
  { maxStations: 20,  token: 43, smartCard: 39 },
  { maxStations: 32,  token: 54, smartCard: 49 },
  { maxStations: 999, token: 60, smartCard: 54 },
];

// Sunday / national holiday — same slab thresholds, one slab cheaper.
export const SUNDAY_SLABS: FareSlab[] = [
  { maxStations: 3,   token: 10, smartCard: 9  },
  { maxStations: 7,   token: 11, smartCard: 10 },
  { maxStations: 12,  token: 21, smartCard: 19 },
  { maxStations: 20,  token: 32, smartCard: 29 },
  { maxStations: 32,  token: 43, smartCard: 39 },
  { maxStations: 999, token: 54, smartCard: 49 },
];

export interface FareEstimate {
  stationCount: number;
  token: number;
  smartCard: number;
  isSunday: boolean;
}

export function estimateFare(stationCount: number, isSunday = false): FareEstimate {
  const slabs = isSunday ? SUNDAY_SLABS : WEEKDAY_SLABS;
  const slab = slabs.find((s) => stationCount <= s.maxStations) ?? slabs[slabs.length - 1];
  return {
    stationCount,
    token: slab.token,
    smartCard: slab.smartCard,
    isSunday,
  };
}
