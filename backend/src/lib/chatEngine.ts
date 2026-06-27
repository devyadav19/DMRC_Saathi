import { analyze, Intent } from "./nlu";
import { planJourney, formatDuration, JourneyResult } from "./journeyPlanner";
import { getSchedule, dayTypeFor } from "./schedule";
import { getNextDepartures } from "./nextTrain";
import { estimateFare } from "./fare";
import { getGatesForStation, PhysicalStation } from "./data";
import { searchStations, bestStationMatch } from "./stationSearch";

export type CardType =
  | "journey"
  | "schedule"
  | "next_train"
  | "fare"
  | "gates"
  | "stationInfo"
  | "suggestions"
  | "clarify";

export interface ChatCard {
  type: CardType;
  data: any;
}

/** Which intent is still waiting on a station name, and (for two-slot
 *  intents like journey/fare) whichever station we already have. */
export type PendingIntentKind =
  | "journey"
  | "fare"
  | "first_last_train"
  | "interchange_info"
  | "gates"
  | "facilities";

export interface PendingClarification {
  intent: PendingIntentKind;
  knownOrigin?: PhysicalStation;
}

export interface ChatReply {
  text: string;
  card?: ChatCard;
  quickReplies?: string[];
  /** Set when this reply is itself a clarifying question - pass it back
   *  into the next getChatReply() call so a bare follow-up answer (e.g.
   *  just a station name) resolves against THIS question instead of being
   *  re-analyzed as an unrelated new message. */
  pending?: PendingClarification;
}

const GREETING_REPLIES = [
  "Hi! I'm the DMRC Assistant. Ask me about routes, fares, first/last trains, station gates, or facilities — for example: \"Rajiv Chowk to Kashmere Gate\".",
];

const QUICK_REPLY_DEFAULTS = [
  "Rajiv Chowk to Kashmere Gate",
  "Last train from Dwarka Sector 21",
  "Fare to Noida Sector 62",
  "Gates at Hauz Khas",
];

function journeyCardText(origin: PhysicalStation, destination: PhysicalStation, j: JourneyResult): string {
  const lineWord = j.linesUsed.length > 1 ? "lines" : "line";
  const changeText =
    j.interchanges.length > 0
      ? ` with ${j.interchanges.length} interchange${j.interchanges.length > 1 ? "s" : ""} (${j.interchanges
          .map((i) => `at ${i.atStation}`)
          .join(", ")})`
      : " with no interchange";
  return `${origin.name} to ${destination.name}: about ${formatDuration(
    j.totalSeconds
  )}, ${j.stationCount} stations, via the ${j.linesUsed.join(" → ")} ${lineWord}${changeText}.`;
}

function handleJourney(origin?: PhysicalStation, destination?: PhysicalStation): ChatReply {
  if (!origin || !destination) {
    const text = origin
      ? `Got ${origin.name} as the starting point — which station are you headed to?`
      : "I couldn't quite identify both stations. Could you tell me the origin and destination station names? For example: \"Dwarka Sector 21 to Noida Electronic City\".";
    return {
      text,
      quickReplies: QUICK_REPLY_DEFAULTS,
      pending: { intent: "journey", knownOrigin: origin },
    };
  }
  const result = planJourney(origin, destination);
  if (result.error || !result.primary) {
    return {
      text: result.error ?? "I couldn't find a route between those stations.",
      quickReplies: QUICK_REPLY_DEFAULTS,
    };
  }
  const fare = estimateFare(result.primary.stationCount, dayTypeFor() === "sunday");
  const text = journeyCardText(origin, destination, result.primary);
  return {
    text,
    card: {
      type: "journey",
      data: {
        origin: origin.name,
        destination: destination.name,
        primary: result.primary,
        alternate: result.alternateViaAirportExpress,
        fare,
      },
    },
    quickReplies: ["What's the fare?", "First and last train", `Gates at ${destination.name}`],
  };
}

function handleSchedule(station?: PhysicalStation): ChatReply {
  if (!station) {
    return {
      text: "Which station would you like first/last train timings for?",
      quickReplies: QUICK_REPLY_DEFAULTS,
      pending: { intent: "first_last_train" },
    };
  }
  if (!station.hasSchedule) {
    return {
      text: `${station.name} is a newer station that isn't in the current schedule dataset yet. Please check the official DMRC app for live timings.`,
    };
  }
  const dayType = dayTypeFor();
  const entries = getSchedule(station, dayType);
  const nextDeps = getNextDepartures(station, { count: 3 });

  if (entries.length === 0) {
    return { text: `I don't have schedule data for ${station.name} right now.` };
  }

  const usedFallback = entries.some((e) => e.isFallback);
  const linesText = entries
    .map((e) => `${e.line}: first ${e.first ?? "—"}, last ${e.last ?? "—"}`)
    .join(" | ");
  const fallbackNote = usedFallback
    ? ` (weekday timings shown as reference — confirm exact ${dayType} timings via the DMRC app.)`
    : "";
  const nextNote =
    nextDeps.length > 0
      ? ` Next scheduled: ${nextDeps.slice(0, 2).map((d) => `${d.line} in ${d.minutesFromNow} min`).join(", ")}.`
      : "";

  return {
    text: `${station.name} (${dayType}) — ${linesText}${fallbackNote}${nextNote}`,
    card: {
      type: "next_train",
      data: { station: station.name, dayType, entries, departures: nextDeps },
    },
  };
}

function handleFare(origin?: PhysicalStation, destination?: PhysicalStation): ChatReply {
  if (!origin || !destination) {
    const text = origin
      ? `Got ${origin.name} as the starting point — which station are you traveling to?`
      : "Tell me both stations and I'll estimate the fare, e.g. \"fare from Rajiv Chowk to Dwarka Sector 21\". Note: this is an estimate based on standard distance slabs, not a live DMRC fare lookup — please confirm the exact amount at the gate or in the official DMRC app.";
    return {
      text,
      quickReplies: QUICK_REPLY_DEFAULTS,
      pending: { intent: "fare", knownOrigin: origin },
    };
  }
  const result = planJourney(origin, destination);
  if (!result.primary) {
    return { text: result.error ?? "I couldn't compute a route to estimate the fare." };
  }
  const fare = estimateFare(result.primary.stationCount, dayTypeFor() === "sunday");
  return {
    text: `Estimated fare ${origin.name} → ${destination.name}: ₹${fare.token} (token) / ₹${fare.smartCard} (smart card)${
      fare.isSunday ? ", Sunday/holiday rate" : ""
    }. This is an estimate from standard distance slabs — confirm the exact fare at the gate or in the DMRC app.`,
    card: { type: "fare", data: { origin: origin.name, destination: destination.name, fare } },
  };
}

function handleGates(station?: PhysicalStation): ChatReply {
  if (!station) {
    return {
      text: "Which station's gates/exits would you like to know about?",
      quickReplies: QUICK_REPLY_DEFAULTS,
      pending: { intent: "gates" },
    };
  }
  const gates = getGatesForStation(station);
  if (gates.length === 0) {
    return { text: `I don't have gate-level data for ${station.name} yet.` };
  }
  const list = gates.map((g) => `${g.gate_name}: ${g.location}`).join("; ");
  return {
    text: `${station.name} has ${gates.length} gate${gates.length > 1 ? "s" : ""} — ${list}`,
    card: { type: "gates", data: { station: station.name, gates } },
  };
}

function handleInterchange(station?: PhysicalStation): ChatReply {
  if (!station) {
    return { text: "Which station do you want interchange details for?", pending: { intent: "interchange_info" } };
  }
  if (!station.isInterchange) {
    return { text: `${station.name} is not an interchange station. It's served by: ${station.linesServed.join(", ")}.` };
  }
  return {
    text: `${station.name} is an interchange between the ${station.linesServed.join(" and ")} lines.`,
  };
}

function handleFacilities(station?: PhysicalStation): ChatReply {
  if (!station) {
    return {
      text: "Which station are you asking about?",
      quickReplies: QUICK_REPLY_DEFAULTS,
      pending: { intent: "facilities" },
    };
  }
  const gates = getGatesForStation(station);
  return {
    text: `${station.name} (${station.linesServed.join(", ")} line${
      station.linesServed.length > 1 ? "s" : ""
    }${station.isInterchange ? ", interchange" : ""}) has ${gates.length} known gate${
      gates.length === 1 ? "" : "s"
    }. For escalator/lift/parking availability at specific gates, the official DMRC station facility list or signage at the station is the authoritative source — I don't have a verified facilities table for this in the current dataset.`,
    card: { type: "stationInfo", data: { station } },
  };
}

const STATIC_ANSWERS: Partial<Record<Intent, string>> = {
  smart_card: "DMRC Smart Cards can be bought and recharged at any station's customer care/AFC counter or via the official DMRC app/ticket vending machines. Smart card fares get a 10% discount over token fares. Exact current pricing should be confirmed at the counter or app, as it can change.",
  lost_found: "For lost items, contact the station controller's office at the station you traveled through, or DMRC's Lost & Found section. It's best to report as soon as possible with your travel date, time, and train details.",
  customer_support: "For DMRC customer support, you can reach out via the official DMRC app, the helpline number listed on delhimetrorail.com, or the customer care counter at any station.",
  rules_luggage: "DMRC allows reasonable personal luggage; large/heavy items, flammable, sharp, or hazardous materials are not allowed and are checked at security screening. Please check the official DMRC luggage policy for the full list of restricted items.",
  women_coach: "The first coach (in the direction of travel) on every DMRC train is reserved for women. Other coaches are open to all, with priority seating for women, senior citizens, and persons with disabilities.",
  accessibility: "DMRC stations are generally equipped with lifts and ramps for wheelchair access, and trains have priority/wheelchair space. Staff at the customer care counter can assist if you need help boarding or navigating a station.",
  emergency: "In an emergency on a train or at a station, use the emergency intercom/alarm available in every coach, or approach the nearest station staff/security personnel immediately. For a medical or safety emergency, please contact station staff right away rather than relying on this chat.",
  nearest_station: "I don't currently have access to your live location. Tell me a landmark, area, or address and I can try to match it to nearby stations by name, or you can enable location services for a more precise answer in a future version of this app.",
};

function resolvePending(pending: PendingClarification, station: PhysicalStation): ChatReply {
  switch (pending.intent) {
    case "first_last_train":
      return handleSchedule(station);
    case "gates":
      return handleGates(station);
    case "interchange_info":
      return handleInterchange(station);
    case "facilities":
      return handleFacilities(station);
    case "journey":
      return pending.knownOrigin ? handleJourney(pending.knownOrigin, station) : handleJourney(station, undefined);
    case "fare":
      return pending.knownOrigin ? handleFare(pending.knownOrigin, station) : handleFare(station, undefined);
  }
}

export function getChatReply(userText: string, pending?: PendingClarification): ChatReply {
  const nlu = analyze(userText);

  // If the bot just asked a clarifying question, and this message looks
  // like a direct, bare answer to it (resolves to a single station and
  // didn't itself trigger a clear, different intent), treat it as
  // completing THAT question rather than re-analyzing it as a brand new,
  // unrelated message. A message that clearly carries its own explicit
  // intent (e.g. "what's the fare to X") still takes priority below.
  if (pending && (nlu.intent === "facilities" || nlu.intent === "unknown")) {
    const station = nlu.station ?? bestStationMatch(userText);
    if (station) {
      return resolvePending(pending, station);
    }
  }

  switch (nlu.intent) {
    case "greeting":
      return { text: GREETING_REPLIES[0], quickReplies: QUICK_REPLY_DEFAULTS };
    case "journey":
      return handleJourney(nlu.origin, nlu.destination);
    case "fare":
      return handleFare(nlu.origin, nlu.destination);
    case "first_last_train":
      return handleSchedule(nlu.station ?? nlu.origin);
    case "interchange_info":
      return handleInterchange(nlu.station ?? nlu.origin);
    case "gates":
      return handleGates(nlu.station ?? nlu.origin);
    case "facilities":
      return handleFacilities(nlu.station ?? nlu.origin);
    default: {
      const staticAnswer = STATIC_ANSWERS[nlu.intent];
      if (staticAnswer) return { text: staticAnswer };

      // Try one more time: maybe it's a bare station name search.
      const matches = searchStations(userText, 3);
      if (matches.length > 0) {
        return handleFacilities(matches[0]);
      }

      return {
        text:
          "I'm not sure I understood that. I can help with journey planning, fares, first/last train timings, station gates, and general DMRC FAQs. Try something like \"Rajiv Chowk to Kashmere Gate\" or \"last train from Dwarka\".",
        quickReplies: QUICK_REPLY_DEFAULTS,
      };
    }
  }
}

/**
 * Upgrade seam for real conversational AI.
 *
 * The rule-based engine above is fast, free, fully offline, and accurate
 * for the structured DMRC tasks it covers (journey planning, schedules,
 * fares, gates). It will NOT handle truly open-ended conversation,
 * paraphrased small talk, or anything outside its intent list gracefully.
 *
 * To upgrade: call your LLM provider here (Anthropic/OpenAI/etc.) with the
 * user's message, the conversation history, and — for grounding — the
 * structured result from getChatReply() as context, then return the
 * model's natural-language response instead of (or blended with) the
 * rule-based text. Keep the rule-based engine as the source of TRUTH for
 * numbers (fares, timings, station data) and only use the LLM to phrase
 * the final sentence, to avoid hallucinated facts.
 *
 * This requires a backend call (never call a paid LLM API directly from
 * the client with an embedded key) — see /backend/src/services for where
 * this is wired up server-side.
 */
export async function generateLLMAnswer(_userText: string, _history: unknown[]): Promise<string | null> {
  return null; // not configured in this build - see comment above
}
