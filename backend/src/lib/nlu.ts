import { searchStations, bestStationMatch, matchStationsInText, suppressSubsumedStations, normalize } from "./stationSearch";
import { PhysicalStation } from "./data";

export type Intent =
  | "greeting"
  | "journey"
  | "fare"
  | "first_last_train"
  | "interchange_info"
  | "gates"
  | "facilities"
  | "smart_card"
  | "lost_found"
  | "customer_support"
  | "rules_luggage"
  | "women_coach"
  | "accessibility"
  | "emergency"
  | "nearest_station"
  | "unknown";

export interface NluResult {
  intent: Intent;
  origin?: PhysicalStation;
  destination?: PhysicalStation;
  station?: PhysicalStation;
  rawText: string;
}

// Each rule: array of regexes (English + Hinglish + Hindi variants). Order
// matters - more specific intents are checked before generic ones.
const INTENT_RULES: { intent: Intent; patterns: RegExp[] }[] = [
  {
    intent: "greeting",
    patterns: [/^(hi|hello|hey|namaste|namaskar|\u0928\u092e\u0938\u094d\u0924\u0947)\b/i],
  },
  {
    intent: "emergency",
    patterns: [/\bemergency\b/i, /\bhelp.*urgent/i, /\bsos\b/i, /\bmedical\b/i],
  },
  {
    intent: "lost_found",
    patterns: [/lost\s*(and|&)?\s*found/i, /\bi\s+lost\b/i, /\bkho gaya\b/i, /\bsaman.*chhoot/i],
  },
  {
    intent: "women_coach",
    patterns: [/women.?s?\s*coach/i, /ladies\s*coach/i, /mahila.*coach/i],
  },
  {
    intent: "accessibility",
    patterns: [/wheelchair/i, /accessib/i, /divyang/i, /disab(led|ilit)/i],
  },
  {
    intent: "smart_card",
    patterns: [
      /smart\s*card/i,
      /\btokens?\b/i,
      /qr\s*ticket/i,
      /recharge/i,
      /\bcard.*balance/i,
      /metro card kaise/i,
    ],
  },
  {
    intent: "rules_luggage",
    patterns: [/luggage/i, /\brules?\b/i, /\bsaman\b.*allow/i, /security check/i, /banned items?/i],
  },
  {
    intent: "first_last_train",
    patterns: [
      /first\s*(train|metro)/i,
      /last\s*(train|metro)/i,
      /akhri\s*metro/i,
      /pehli\s*metro/i,
      /metro\s*timing/i,
      /operating\s*hours?/i,
      /next\s*(train|metro)/i,
      /\bkab\s*(aayegi|aayega|hai)\b/i,
      /\btiming\b/i,
      /when.*train/i,
      /\bschedule\b/i,
    ],
  },
  {
    intent: "interchange_info",
    patterns: [/interchange/i, /change.*line/i, /line.*milti/i, /transfer.*line/i],
  },
  {
    intent: "gates",
    patterns: [/\bgates?\b/i, /\bexits?\b/i, /\bentr(y|ies)\b/i, /nikalna/i, /kaunsa gate/i],
  },
  {
    intent: "facilities",
    patterns: [
      /escalator/i,
      /\blift\b/i,
      /elevator/i,
      /parking/i,
      /feeder/i,
      /facilit/i,
      /toilet|washroom/i,
    ],
  },
  {
    intent: "fare",
    patterns: [/\bfare\b/i, /\bkiraya\b/i, /how much.*cost/i, /price.*ticket/i, /\bcharge\b.*travel/i],
  },
  {
    intent: "customer_support",
    patterns: [/customer (care|support)/i, /helpline/i, /complaint/i, /contact.*dmrc/i],
  },
  {
    intent: "nearest_station",
    patterns: [/nearest (metro|station)/i, /najdeeki (metro|station)/i, /closest station/i],
  },
];

// Journey-style patterns try to capture "<origin> ... <destination>" in one go.
const JOURNEY_PATTERNS: RegExp[] = [
  /from\s+(.+?)\s+to\s+(.+?)(?:[.?!]|$)/i,
  /(.+?)\s+se\s+(.+?)\s+(?:jana|jaana|tak)\b/i,
  /(.+?)\s+to\s+(.+?)(?:[.?!]|$)/i,
  /(.+?)\s*->\s*(.+)/,
  /(.+?)\s*\u2192\s*(.+)/,
];

function detectIntent(text: string): Intent {
  // Journey detection takes priority if it matches a from/to shape with two
  // plausible station mentions.
  for (const pattern of JOURNEY_PATTERNS) {
    const m = text.match(pattern);
    if (m && m[1] && m[2]) {
      const a = bestStationMatch(m[1]);
      const b = bestStationMatch(m[2]);
      if (a && b && a.gtfsStopId !== b.gtfsStopId) return "journey";
    }
  }
  for (const rule of INTENT_RULES) {
    if (rule.patterns.some((p) => p.test(text))) return rule.intent;
  }
  // fallback: if exactly two distinct known stations appear anywhere, assume journey
  const stationsFound = extractAllStations(text);
  if (stationsFound.length >= 2) return "journey";
  if (stationsFound.length === 1) return "facilities"; // generic "tell me about X station"
  return "unknown";
}

export function extractAllStations(text: string, maxCandidates = 6): PhysicalStation[] {
  // First pass: exact substring matches against the full text, ranked so
  // the most specific (longest) station name mention wins - handles
  // clean, correctly-spelled input reliably and avoids the ambiguity of
  // independently-scored sliding windows.
  const exact = matchStationsInText(text, maxCandidates);
  if (exact.length >= maxCandidates) return exact;

  const words = text.replace(/[?!.,]/g, "").split(/\s+/).filter(Boolean);
  const normalizedWords = words.map((w) => normalize(w));

  // Mark which word positions are already accounted for by an exact
  // match, so the fuzzy pass below can't re-interpret a left-over
  // FRAGMENT of an already-resolved station name as a different station.
  // E.g. for "Dwarka Sector 21", the exact pass claims all three words;
  // without this, the fuzzy pass would still try the 2-word leftover
  // window "Dwarka Sector" (number stripped) and could match a
  // completely different station like "Dwarka Sector - 9" by coincidence.
  const claimed = new Set<number>();
  for (const station of exact) {
    const nameWords = normalize(station.name).split(" ");
    for (let i = 0; i + nameWords.length <= normalizedWords.length; i++) {
      const windowJoined = normalizedWords.slice(i, i + nameWords.length).join(" ");
      if (windowJoined === nameWords.join(" ")) {
        for (let k = i; k < i + nameWords.length; k++) claimed.add(k);
      }
    }
  }

  // Second pass: sliding n-gram fuzzy scan for typos / Hinglish spellings
  // not caught above, skipping any window that overlaps already-claimed
  // word positions. Results are appended only if not already found.
  const found: PhysicalStation[] = [...exact];
  const seen = new Set<string>(exact.map((s) => s.gtfsStopId ?? s.name));
  for (let len = Math.min(4, words.length); len >= 1; len--) {
    for (let i = 0; i + len <= words.length; i++) {
      let overlapsClaimed = false;
      for (let k = i; k < i + len; k++) {
        if (claimed.has(k)) {
          overlapsClaimed = true;
          break;
        }
      }
      if (overlapsClaimed) continue;

      const phrase = words.slice(i, i + len).join(" ");
      if (phrase.length < 3) continue;
      const matches = searchStations(phrase, 1);
      if (matches[0]) {
        const key = matches[0].gtfsStopId ?? matches[0].name;
        if (!seen.has(key)) {
          seen.add(key);
          found.push(matches[0]);
        }
      }
    }
  }
  return suppressSubsumedStations(found).slice(0, maxCandidates);
}

export function analyze(text: string): NluResult {
  const intent = detectIntent(text);
  const result: NluResult = { intent, rawText: text };

  if (intent === "journey") {
    for (const pattern of JOURNEY_PATTERNS) {
      const m = text.match(pattern);
      if (m && m[1] && m[2]) {
        const a = bestStationMatch(m[1]);
        const b = bestStationMatch(m[2]);
        if (a && b && a.gtfsStopId !== b.gtfsStopId) {
          result.origin = a;
          result.destination = b;
          return result;
        }
      }
    }
    const stations = extractAllStations(text);
    if (stations.length >= 2) {
      result.origin = stations[0];
      result.destination = stations[1];
    }
    return result;
  }

  // single-station intents
  const stations = extractAllStations(text, 1);
  if (stations[0]) result.station = stations[0];
  return result;
}
