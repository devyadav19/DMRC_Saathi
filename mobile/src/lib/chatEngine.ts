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
  | "clarify"
  | "emergency_sos"
  | "help_faq"
  | "fare_table"
  | "metro_map"
  | "penalty"
  | "tourist_card"
  | "parking"
  | "feeder_bus"
  | "notices"
  | "smart_card"
  | "line_status";

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

const TRANSLATIONS = {
  EN: {
    greeting: "Hi! I'm the DMRC Assistant. Ask me about routes, fares, first/last trains, station gates, or facilities — for example: \"Rajiv Chowk to Kashmere Gate\".",
    unknown: "I'm not sure I understood that. I can help with journey planning, fares, first/last train timings, station gates, metro map, emergency contacts, penalties, and more. Try something like \"Rajiv Chowk to Kashmere Gate\" or tap the menu button for all services.",
    clarify_journey: "I couldn't quite identify both stations. Could you tell me the origin and destination station names? For example: \"Dwarka Sector 21 to Noida Electronic City\".",
    clarify_origin: (name: string) => `Got ${name} as the starting point — which station are you headed to?`,
    no_route: "I couldn't find a route between those stations.",
    gates_clarify: "Which station's gates/exits would you like to know about?",
    no_gates: (name: string) => `I don't have gate-level data for ${name} yet.`,
    schedule_clarify: "Which station would you like first/last train timings for?",
    no_schedule: (name: string) => `${name} is a newer station that isn't in the current schedule dataset yet. Please check the official DMRC app.`,
    smart_card: "DMRC Smart Card simulator opened. Check balance, transaction history, or simulate a UPI recharge below:",
  },
  HI: {
    greeting: "नमस्ते! मैं DMRC सहायक हूँ। मुझसे रूट, किराया, पहली/आखिरी ट्रेन, स्टेशन गेट, या सुविधाओं के बारे में पूछें — जैसे: \"Rajiv Chowk to Kashmere Gate\"।",
    unknown: "मुझे समझ में नहीं आया। मैं रूट प्लानिंग, किराया, पहली/आखिरी ट्रेन के समय, स्टेशन गेट, मेट्रो मैप, आपातकालीन संपर्क और जुर्माने में मदद कर सकता हूँ। \"Rajiv Chowk to Kashmere Gate\" जैसा कुछ लिखकर प्रयास करें या सभी सुविधाओं के लिए मेनू बटन दबाएं।",
    clarify_journey: "मैं दोनों स्टेशनों की पहचान नहीं कर पाया। क्या आप मुझे प्रस्थान और गंतव्य स्टेशन के नाम बता सकते हैं? जैसे: \"Dwarka Sector 21 to Noida Electronic City\"।",
    clarify_origin: (name: string) => `प्रस्थान स्टेशन ${name} मिला — आप किस स्टेशन पर जाना चाहते हैं?`,
    no_route: "मुझे उन स्टेशनों के बीच कोई रूट नहीं मिला।",
    gates_clarify: "आप किस स्टेशन के गेट/निकास की जानकारी चाहते हैं?",
    no_gates: (name: string) => `मेरे पास अभी ${name} के गेट की जानकारी नहीं है।`,
    schedule_clarify: "आप किस स्टेशन की पहली/आखिरी ट्रेन के समय की जानकारी चाहते हैं?",
    no_schedule: (name: string) => `${name} एक नया स्टेशन है जो अभी समय सारणी में शामिल नहीं है। कृपया DMRC ऐप देखें।`,
    smart_card: "स्मार्ट कार्ड सिम्युलेटर खुल गया है। नीचे बैलेंस, हालिया इतिहास देखें या यूपीआई रिचार्ज का परीक्षण करें:",
  }
};

const QUICK_REPLY_DEFAULTS = [
  "Rajiv Chowk to Kashmere Gate",
  "Last train from Dwarka Sector 21",
  "Fare to Noida Sector 62",
  "Gates at Hauz Khas",
];

const QUICK_REPLY_DEFAULTS_HI = [
  "Rajiv Chowk से Kashmere Gate",
  "Dwarka Sector 21 से आखिरी ट्रेन",
  "Noida Sector 62 का किराया",
  "Hauz Khas के गेट",
];

function formatDurationHi(totalSeconds: number): string {
  const mins = Math.round(totalSeconds / 60);
  if (mins < 60) return `${mins} मिनट`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} घंटे` : `${h} घंटे ${m} मिनट`;
}

function journeyCardText(origin: PhysicalStation, destination: PhysicalStation, j: JourneyResult, lang: "EN" | "HI" = "EN"): string {
  if (lang === "HI") {
    const interchangeText = j.interchanges.length > 0
      ? ` और ${j.interchanges.length} इंटरचेंज (${j.interchanges.map((i) => `${i.atStation} पर`).join(", ")})`
      : " और कोई इंटरचेंज नहीं";
    return `${origin.name} से ${destination.name}: लगभग ${formatDurationHi(j.totalSeconds)}, ${j.stationCount} स्टेशन, लाइन ${j.linesUsed.join(" → ")}${interchangeText}।`;
  }
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

function handleJourney(origin?: PhysicalStation, destination?: PhysicalStation, lang: "EN" | "HI" = "EN"): ChatReply {
  const t = TRANSLATIONS[lang];
  const defaults = lang === "HI" ? QUICK_REPLY_DEFAULTS_HI : QUICK_REPLY_DEFAULTS;
  if (!origin || !destination) {
    const text = origin
      ? t.clarify_origin(origin.name)
      : t.clarify_journey;
    return {
      text,
      quickReplies: defaults,
      pending: { intent: "journey", knownOrigin: origin },
    };
  }
  const result = planJourney(origin, destination);
  if (result.error || !result.primary) {
    return {
      text: lang === "HI" ? "मुझे उन स्टेशनों के बीच कोई रूट नहीं मिला।" : (result.error ?? "I couldn't find a route between those stations."),
      quickReplies: defaults,
    };
  }
  const fare = estimateFare(result.primary.stationCount, dayTypeFor() === "sunday");
  const text = journeyCardText(origin, destination, result.primary, lang);
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
    quickReplies: lang === "HI"
      ? ["किराया क्या है?", "पहली और आखिरी ट्रेन", `${destination.name} के गेट`]
      : ["What's the fare?", "First and last train", `Gates at ${destination.name}`],
  };
}

function handleSchedule(station?: PhysicalStation, lang: "EN" | "HI" = "EN"): ChatReply {
  const t = TRANSLATIONS[lang];
  const defaults = lang === "HI" ? QUICK_REPLY_DEFAULTS_HI : QUICK_REPLY_DEFAULTS;
  if (!station) {
    return {
      text: t.schedule_clarify,
      quickReplies: defaults,
      pending: { intent: "first_last_train" },
    };
  }
  if (!station.hasSchedule) {
    return {
      text: t.no_schedule(station.name),
    };
  }
  const dayType = dayTypeFor();
  const entries = getSchedule(station, dayType);
  const nextDeps = getNextDepartures(station, { count: 3 });

  if (entries.length === 0) {
    return { text: lang === "HI" ? `मेरे पास अभी ${station.name} का शेड्यूल डेटा नहीं है।` : `I don't have schedule data for ${station.name} right now.` };
  }

  const usedFallback = entries.some((e) => e.isFallback);
  const linesText = entries
    .map((e) => `${e.line}: ${lang === "HI" ? "पहली" : "first"} ${e.first ?? "—"}, ${lang === "HI" ? "आखिरी" : "last"} ${e.last ?? "—"}`)
    .join(" | ");
  const fallbackNote = usedFallback
    ? (lang === "HI" ? " (सप्ताह के दिनों का शेड्यूल दिखाया गया है — आधिकारिक ऐप से पुष्टि करें।)" : ` (weekday timings shown as reference — confirm exact ${dayType} timings via the DMRC app.)`)
    : "";
  const nextNote =
    nextDeps.length > 0
      ? ` ${lang === "HI" ? "अगली ट्रेनें" : "Next scheduled"}: ${nextDeps.slice(0, 2).map((d) => `${d.line} ${d.minutesFromNow} ${lang === "HI" ? "मिनट में" : "min"}`).join(", ")}.`
      : "";

  return {
    text: `${station.name} (${dayType}) — ${linesText}${fallbackNote}${nextNote}`,
    card: {
      type: "next_train",
      data: { station: station.name, dayType, entries, departures: nextDeps },
    },
  };
}

function handleFare(origin?: PhysicalStation, destination?: PhysicalStation, lang: "EN" | "HI" = "EN"): ChatReply {
  const t = TRANSLATIONS[lang];
  const defaults = lang === "HI" ? QUICK_REPLY_DEFAULTS_HI : QUICK_REPLY_DEFAULTS;
  if (!origin || !destination) {
    const text = origin
      ? (lang === "HI" ? `प्रस्थान स्टेशन ${origin.name} मिला — आप किस स्टेशन पर यात्रा कर रहे हैं?` : `Got ${origin.name} as the starting point — which station are you traveling to?`)
      : (lang === "HI" ? "मुझे प्रस्थान और गंतव्य दोनों स्टेशन बताएं, जैसे \"fare from Rajiv Chowk to Dwarka Sector 21\"।" : "Tell me both stations and I'll estimate the fare, e.g. \"fare from Rajiv Chowk to Dwarka Sector 21\". Note: this is an estimate based on standard distance slabs, not a live DMRC fare lookup — please confirm the exact amount at the gate or in the official DMRC app.");
    return {
      text,
      quickReplies: defaults,
      pending: { intent: "fare", knownOrigin: origin },
    };
  }
  const result = planJourney(origin, destination);
  if (!result.primary) {
    return { text: lang === "HI" ? "मैं किराए का अनुमान लगाने के लिए रूट की गणना नहीं कर सका।" : result.error ?? "I couldn't compute a route to estimate the fare." };
  }
  const fare = estimateFare(result.primary.stationCount, dayTypeFor() === "sunday");
  const text = lang === "HI"
    ? `अनुमानित किराया ${origin.name} → ${destination.name}: ₹${fare.token} (टोकन) / ₹${fare.smartCard} (स्मार्ट कार्ड)। यह दूरी स्लैब के आधार पर एक अनुमान है।`
    : `Estimated fare ${origin.name} → ${destination.name}: ₹${fare.token} (token) / ₹${fare.smartCard} (smart card)${
      fare.isSunday ? ", Sunday/holiday rate" : ""
    }. This is an estimate from standard distance slabs — confirm the exact fare at the gate or in the DMRC app.`;
  return {
    text,
    card: { type: "fare", data: { origin: origin.name, destination: destination.name, fare } },
  };
}

function handleGates(station?: PhysicalStation, lang: "EN" | "HI" = "EN"): ChatReply {
  const t = TRANSLATIONS[lang];
  const defaults = lang === "HI" ? QUICK_REPLY_DEFAULTS_HI : QUICK_REPLY_DEFAULTS;
  if (!station) {
    return {
      text: t.gates_clarify,
      quickReplies: defaults,
      pending: { intent: "gates" },
    };
  }
  const gates = getGatesForStation(station);
  if (gates.length === 0) {
    return { text: t.no_gates(station.name) };
  }
  const list = gates.map((g) => `${g.gate_name}: ${g.location}`).join("; ");
  const text = lang === "HI"
    ? `${station.name} में ${gates.length} गेट हैं — ${list}`
    : `${station.name} has ${gates.length} gate${gates.length > 1 ? "s" : ""} — ${list}`;
  return {
    text,
    card: { type: "gates", data: { station: station.name, gates } },
  };
}

function handleInterchange(station?: PhysicalStation, lang: "EN" | "HI" = "EN"): ChatReply {
  if (!station) {
    return { 
      text: lang === "HI" ? "आपको किस स्टेशन के लिए इंटरचेंज विवरण चाहिए?" : "Which station do you want interchange details for?", 
      pending: { intent: "interchange_info" } 
    };
  }
  if (!station.isInterchange) {
    return { 
      text: lang === "HI"
        ? `${station.name} कोई इंटरचेंज स्टेशन नहीं है। यहाँ ये लाइनें उपलब्ध हैं: ${station.linesServed.join(", ")}।`
        : `${station.name} is not an interchange station. It's served by: ${station.linesServed.join(", ")}.` 
    };
  }
  return {
    text: lang === "HI"
      ? `${station.name} स्टेशन ${station.linesServed.join(" और ")} लाइनों के बीच इंटरचेंज स्टेशन है।`
      : `${station.name} is an interchange between the ${station.linesServed.join(" and ")} lines.`,
  };
}

function handleFacilities(station?: PhysicalStation, lang: "EN" | "HI" = "EN"): ChatReply {
  const defaults = lang === "HI" ? QUICK_REPLY_DEFAULTS_HI : QUICK_REPLY_DEFAULTS;
  if (!station) {
    return {
      text: lang === "HI" ? "आप किस स्टेशन के बारे में पूछ रहे हैं?" : "Which station are you asking about?",
      quickReplies: defaults,
      pending: { intent: "facilities" },
    };
  }
  const gates = getGatesForStation(station);
  const text = lang === "HI"
    ? `${station.name} (${station.linesServed.join(", ")} लाइन${
        station.linesServed.length > 1 ? "ों" : ""
      }${station.isInterchange ? ", इंटरचेंज" : ""}) में ${gates.length} गेट हैं। लिफ्ट, एस्केलेटर या पार्किंग सुविधाओं की उपलब्धता के लिए स्टेशन पर लगे साइनबोर्ड या DMRC ऐप को देखें।`
    : `${station.name} (${station.linesServed.join(", ")} line${
        station.linesServed.length > 1 ? "s" : ""
      }${station.isInterchange ? ", interchange" : ""}) has ${gates.length} known gate${
        gates.length === 1 ? "" : "s"
      }. For escalator/lift/parking availability at specific gates, the official DMRC station facility list or signage at the station is the authoritative source — I don't have a verified facilities table for this in the current dataset.`;
  return {
    text,
    card: { type: "stationInfo", data: { station } },
  };
}

const STATIC_ANSWERS: Partial<Record<Intent, string>> = {
  lost_found: "For lost items, contact the station controller's office at the station you traveled through, or DMRC's Lost & Found section. It's best to report as soon as possible with your travel date, time, and train details.",
  customer_support: "For DMRC customer support, you can reach out via the official DMRC app, the helpline number listed on delhimetrorail.com, or the customer care counter at any station.",
  rules_luggage: "DMRC allows reasonable personal luggage; large/heavy items, flammable, sharp, or hazardous materials are not allowed and are checked at security screening. Please check the official DMRC luggage policy for the full list of restricted items.",
  women_coach: "The first coach (in the direction of travel) on every DMRC train is reserved for women. Other coaches are open to all, with priority seating for women, senior citizens, and persons with disabilities.",
  accessibility: "DMRC stations are generally equipped with lifts and ramps for wheelchair access, and trains have priority/wheelchair space. Staff at the customer care counter can assist if you need help boarding or navigating a station.",
  nearest_station: "I don't currently have access to your live location. Tell me a landmark, area, or address and I can try to match it to nearby stations by name, or you can enable location services for a more precise answer in a future version of this app.",
};

const STATIC_ANSWERS_HI: Partial<Record<Intent, string>> = {
  lost_found: "खोए हुए सामान के लिए, उस स्टेशन के स्टेशन नियंत्रक (स्टेशन कंट्रोलर) के कार्यालय से संपर्क करें जहां से आपने यात्रा की थी, या DMRC के खोया-पाया (Lost & Found) विभाग से संपर्क करें। यात्रा की तारीख, समय और ट्रेन के विवरण के साथ जल्द से जल्द रिपोर्ट करना सबसे अच्छा है।",
  customer_support: "DMRC ग्राहक सहायता के लिए, आप आधिकारिक DMRC ऐप, delह हेल्पलाइन नंबर (155370), या किसी भी स्टेशन के कस्टमर केयर काउंटर के माध्यम से संपर्क कर सकते हैं।",
  rules_luggage: "DMRC सामान्य व्यक्तिगत सामान की अनुमति देता है; सुरक्षा जांच में भारी/बड़े सामान, ज्वलनशील, नुकीली या खतरनाक सामग्री की अनुमति नहीं होती है। प्रतिबंधित वस्तुओं की पूरी सूची के लिए आधिकारिक DMRC सामान नीति देखें।",
  women_coach: "प्रत्येक DMRC ट्रेन में यात्रा की दिशा में पहला कोच महिलाओं के लिए आरक्षित होता है। अन्य कोच सभी के लिए खुले हैं, जिनमें महिलाओं, वरिष्ठ नागरिकों और दिव्यांगों के लिए प्राथमिकता वाली सीटें हैं।",
  accessibility: "DMRC स्टेशन आमतौर पर व्हीलचेयर पहुंच के लिए लिफ्ट और रैंप से सुसज्जित हैं, और ट्रेनों में समर्पित व्हीलचेयर स्थान हैं। यदि आपको बोर्डिंग या नेविगेट करने में सहायता की आवश्यकता है तो कस्टमर केयर काउंटर का स्टाफ मदद कर सकता है।",
  nearest_station: "मेरे पास वर्तमान में आपके लाइव स्थान की पहुंच नहीं है। मुझे कोई लैंडमार्क या क्षेत्र का नाम बताएं और मैं स्टेशन खोजने का प्रयास कर सकता हूँ।",
};

// ────────────── Emergency SOS Handler ──────────────
function handleEmergency(lang: "EN" | "HI" = "EN"): ChatReply {
  const defaults = lang === "HI" ? QUICK_REPLY_DEFAULTS_HI : QUICK_REPLY_DEFAULTS;
  if (lang === "HI") {
    return {
      text: "🆘 दिल्ली मेट्रो के लिए आपातकालीन संपर्क और सुरक्षा निर्देश:",
      card: {
        type: "emergency_sos",
        data: {
          numbers: [
            { label: "डीएमआरसी हेल्पलाइन", number: "155370", icon: "train-outline" },
            { label: "डीएमआरसी कंट्रोल रूम", number: "011-23417910", icon: "call-outline" },
            { label: "महिला हेल्पलाइन", number: "181", icon: "female-outline" },
            { label: "पुलिस आपातकाल", number: "112", icon: "shield-outline" },
            { label: "एम्बुलेंस", number: "102", icon: "medkit-outline" },
          ],
          instructions: [
            "प्रत्येक कोच में उपलब्ध आपातकालीन इंटरकॉम/अलार्म का उपयोग करें",
            "प्लेटफ़ॉर्म पर इमरजेंसी टॉक बैक (ETB) बटन दबाएं",
            "निकटतम स्टेशन कर्मचारी या सीआईएसएफ सुरक्षा कर्मियों से संपर्क करें",
            "किसी भी स्थिति में पटरियों पर न कूदें (अत्यंत खतरनाक)",
            "चिकित्सा आपात स्थिति के लिए, स्टेशन नियंत्रक को तुरंत सूचित करें",
            "आग: कोच में अग्निशामक यंत्र का उपयोग करें, अन्य यात्रियों को सचेत करें",
          ],
        },
      },
      quickReplies: ["ग्राहक सहायता", "महिला कोच", "मेट्रो नियम"],
    };
  }
  return {
    text: "🆘 Emergency contacts and safety instructions for Delhi Metro:",
    card: {
      type: "emergency_sos",
      data: {
        numbers: [
          { label: "DMRC Helpline", number: "155370", icon: "train-outline" },
          { label: "DMRC Control Room", number: "011-23417910", icon: "call-outline" },
          { label: "Women Helpline", number: "181", icon: "female-outline" },
          { label: "Police Emergency", number: "112", icon: "shield-outline" },
          { label: "Ambulance", number: "102", icon: "medkit-outline" },
        ],
        instructions: [
          "Use the emergency intercom/alarm available in every coach",
          "Press Emergency Talk Back (ETB) button on the platform",
          "Approach nearest station staff or CISF security personnel",
          "Do NOT jump onto tracks under any circumstances",
          "For medical emergencies, inform the station controller immediately",
          "Fire: Use the fire extinguisher in the coach, alert other passengers",
        ],
      },
    },
    quickReplies: ["Customer support", "Women's coach info", "Metro rules"],
  };
}

// ────────────── Help & FAQ Handler ──────────────
function handleHelp(lang: "EN" | "HI" = "EN"): ChatReply {
  const defaults = lang === "HI" ? QUICK_REPLY_DEFAULTS_HI : QUICK_REPLY_DEFAULTS;
  if (lang === "HI") {
    return {
      text: "यहाँ वो सब कुछ है जिसमें मैं आपकी मदद कर सकता हूँ:",
      card: {
        type: "help_faq",
        data: {
          sections: [
            {
              title: "शुरुआत करना",
              icon: "rocket-outline",
              items: [
                { q: "यह चैटबॉट क्या कर सकता है?", a: "मैं मेट्रो रूट की योजना बना सकता हूँ, किराया देख सकता हूँ, पहली/आखिरी ट्रेन का समय खोज सकता हूँ, स्टेशन गेट दिखा सकता हूँ, आपातकालीन संपर्क प्रदान कर सकता हूँ, मेट्रो मैप दिखा सकता हूँ और दिल्ली मेट्रो से जुड़े सवालों के जवाब दे सकता हूँ।" },
                { q: "रूट की योजना कैसे बनाएं?", a: 'बस अपने प्रस्थान और गंतव्य स्टेशन का नाम लिखें जैसे "Rajiv Chowk से Hauz Khas" या मेनू में रूट प्लानर दबाएं।' },
                { q: "क्या मैं वॉयस इनपुट का उपयोग कर सकता हूँ?", a: "हाँ, वॉयस इनपुट के लिए बस माइक्रोफ़ोन बटन दबाएं, और सिम्युलेटर का उपयोग करके कोई भी कमांड बोलें।" },
              ],
            },
            {
              title: "टिकट और कार्ड",
              icon: "card-outline",
              items: [
                { q: "टोकन कैसे खरीदें?", a: "टोकन मेट्रो स्टेशन के ऑटोमैटिक टिकट वेंडिंग मशीन (ATVM) या कस्टमर केयर काउंटर से खरीदे जा सकते हैं। नकदी या यूपीआई का उपयोग कर टोकन प्राप्त करें।" },
                { q: "स्मार्ट कार्ड रिचार्ज कैसे करें?", a: "स्मार्ट कार्ड को कस्टमर केयर काउंटर, ATVM, DMRC ऐप, Paytm, या PhonePe पर रिचार्ज किया जा सकता है। न्यूनतम रिचार्ज: ₹100।" },
                { q: "टूरिस्ट कार्ड क्या है?", a: "टूरिस्ट कार्ड असीमित सवारी प्रदान करते हैं — 1 दिन के लिए ₹200 और 3 दिनों के लिए ₹500। ₹50 वापसी योग्य सुरक्षा जमा लागू होता है।" },
              ],
            },
            {
              title: "यात्रा की जानकारी",
              icon: "train-outline",
              items: [
                { q: "मेट्रो का समय क्या है?", a: "मेट्रो प्रतिदिन सुबह ~5:00 बजे से रात ~11:30 बजे तक चलती है। पहली/आखिरी ट्रेन का समय अलग-अलग स्टेशनों के लिए अलग होता है।" },
                { q: "किराया कैसे गिना जाता है?", a: "किराया स्टेशनों की संख्या और दूरी के आधार पर होता है। टोकन किराया ₹10–₹60 तक है। स्मार्ट कार्ड पर 10% की छूट मिलती है।" },
                { q: "इंटरचेंज कैसे काम करता है?", a: "इंटरचेंज स्टेशनों पर, बस दूसरी लाइन के प्लेटफॉर्म के लिए निर्देशों का पालन करें। कोई अतिरिक्त टिकट की आवश्यकता नहीं है।" },
              ],
            },
            {
              title: "नियम और सुरक्षा",
              icon: "shield-checkmark-outline",
              items: [
                { q: "कौन सी वस्तुएं प्रतिबंधित हैं?", a: "ज्वलनशील तरल पदार्थ, नुकीली वस्तुएं, हथियार, और भारी सामान प्रतिबंधित हैं। सभी बैग सुरक्षा एक्सरे जांच से गुजरते हैं।" },
                { q: "क्या मेट्रो में खाना खाने की अनुमति है?", a: "नहीं। मेट्रो के अंदर खाना, पीना (पानी के अलावा) और च्यूइंग गम चबाना प्रतिबंधित है। जुर्माना: ₹200।" },
                { q: "महिला कोच के नियम?", a: "यात्रा की दिशा में पहला कोच महिलाओं के लिए आरक्षित होता है। पुरुष यात्रियों द्वारा यात्रा करने पर ₹250 का जुर्माना लगाया जा सकता है।" },
              ],
            },
          ],
        },
      },
      quickReplies: ["रूट प्लानर", "किराया जांचें", "आपातकालीन संपर्क", "मेट्रो मैप"],
    };
  }
  return {
    text: "Here's everything I can help you with:",
    card: {
      type: "help_faq",
      data: {
        sections: [
          {
            title: "Getting Started",
            icon: "rocket-outline",
            items: [
              { q: "What can this chatbot do?", a: "I can plan metro routes, check fares, find first/last train timings, show station gates, provide emergency contacts, show the metro map, and answer FAQs about Delhi Metro." },
              { q: "How do I plan a route?", a: 'Simply type your origin and destination like "Rajiv Chowk to Kashmere Gate" or tap the Route Planner in the menu.' },
              { q: "Can I use voice input?", a: "Voice input requires a custom build with a speech API. For now, use text input and tap the speaker icon to hear replies read aloud." },
            ],
          },
          {
            title: "Tickets & Cards",
            icon: "card-outline",
            items: [
              { q: "How do I buy a token?", a: "Tokens can be purchased at Automatic Ticket Vending Machines (ATVMs) or the Customer Care counter at any metro station. Insert cash or use UPI to get a token for your journey." },
              { q: "How to recharge Smart Card?", a: "Smart Cards can be recharged at Customer Care counters, ATVMs, the DMRC app, Paytm, or PhonePe. Minimum recharge: ₹100." },
              { q: "What is a Tourist Card?", a: "Tourist Cards offer unlimited rides — ₹200 for 1 day and ₹500 for 3 days. Available at airport and major station counters. ₹50 refundable deposit applies." },
            ],
          },
          {
            title: "Travel Info",
            icon: "train-outline",
            items: [
              { q: "What are metro timings?", a: "Metro runs from ~5:00 AM to ~11:30 PM daily. First/last train timings vary by station and line. Ask me for specific station timings." },
              { q: "How is fare calculated?", a: "Fare is based on distance (number of stations). Token fare ranges ₹10–₹60. Smart card gets 10% discount. Sunday/holidays have reduced fares." },
              { q: "How do interchanges work?", a: "At interchange stations, follow the signage to the connecting line's platform. No extra ticket needed — your token/card is valid for the entire journey." },
            ],
          },
          {
            title: "Rules & Safety",
            icon: "shield-checkmark-outline",
            items: [
              { q: "What items are prohibited?", a: "Flammable liquids, sharp objects, firearms, explosives, and heavy/oversized luggage are banned. All bags go through security X-ray screening." },
              { q: "Is eating allowed in metro?", a: "No. Eating, drinking (except water), and chewing gum are prohibited inside the metro. Penalty: ₹200." },
              { q: "Women's coach rules?", a: "The first coach in the direction of travel is reserved for women. Men can be fined ₹250 for traveling in the women's coach." },
            ],
          },
          {
            title: "Accessibility",
            icon: "accessibility-outline",
            items: [
              { q: "Is the metro wheelchair accessible?", a: "Yes. All stations have lifts, ramps, and tactile paths. Trains have dedicated wheelchair spaces. Staff can assist with boarding." },
              { q: "Are there facilities for visually impaired?", a: "Stations have Braille signage, tactile floor tiles, and audio announcements. Station staff can provide assistance on request." },
            ],
          },
        ],
      },
    },
    quickReplies: ["Plan a route", "Check fare", "Emergency SOS", "Metro map"],
  };
}

// ────────────── Fare Table Handler ──────────────
function handleFareTable(lang: "EN" | "HI" = "EN"): ChatReply {
  const defaults = lang === "HI" ? QUICK_REPLY_DEFAULTS_HI : QUICK_REPLY_DEFAULTS;
  if (lang === "HI") {
    return {
      text: "यहाँ पूरा डीएमआरसी किराया चार्ट दिया गया है:",
      card: {
        type: "fare_table",
        data: {
          weekdaySlabs: [
            { maxStations: 3, token: 11, smartCard: 10 },
            { maxStations: 7, token: 21, smartCard: 19 },
            { maxStations: 12, token: 32, smartCard: 29 },
            { maxStations: 20, token: 43, smartCard: 39 },
            { maxStations: 32, token: 54, smartCard: 49 },
            { maxStations: 999, token: 60, smartCard: 54 },
          ],
          sundaySlabs: [
            { maxStations: 3, token: 10, smartCard: 9 },
            { maxStations: 7, token: 11, smartCard: 10 },
            { maxStations: 12, token: 21, smartCard: 19 },
            { maxStations: 20, token: 32, smartCard: 29 },
            { maxStations: 32, token: 43, smartCard: 39 },
            { maxStations: 999, token: 54, smartCard: 49 },
          ],
          touristCards: [
            { name: "1-दिवसीय पर्यटक कार्ड", price: 200, validity: "24 घंटे", description: "1 दिन के लिए असीमित सवारी। ₹50 वापसी योग्य सुरक्षा जमा।" },
            { name: "3-दिवसीय पर्यटक कार्ड", price: 500, validity: "72 घंटे", description: "3 दिनों के लिए असीमित सवारी। ₹50 वापसी योग्य सुरक्षा जमा।" },
          ],
        },
      },
      quickReplies: ["रूट प्लानर", "टूरिस्ट कार्ड", "स्मार्ट कार्ड"],
    };
  }
  return {
    text: "Here's the complete DMRC fare chart:",
    card: {
      type: "fare_table",
      data: {
        weekdaySlabs: [
          { maxStations: 3, token: 11, smartCard: 10 },
          { maxStations: 7, token: 21, smartCard: 19 },
          { maxStations: 12, token: 32, smartCard: 29 },
          { maxStations: 20, token: 43, smartCard: 39 },
          { maxStations: 32, token: 54, smartCard: 49 },
          { maxStations: 999, token: 60, smartCard: 54 },
        ],
        sundaySlabs: [
          { maxStations: 3, token: 10, smartCard: 9 },
          { maxStations: 7, token: 11, smartCard: 10 },
          { maxStations: 12, token: 21, smartCard: 19 },
          { maxStations: 20, token: 32, smartCard: 29 },
          { maxStations: 32, token: 43, smartCard: 39 },
          { maxStations: 999, token: 54, smartCard: 49 },
        ],
        touristCards: [
          { name: "1-Day Tourist Card", price: 200, validity: "24 hours", description: "Unlimited rides for 1 day. ₹50 refundable deposit." },
          { name: "3-Day Tourist Card", price: 500, validity: "72 hours", description: "Unlimited rides for 3 days. ₹50 refundable deposit." },
        ],
      },
    },
    quickReplies: ["Plan a route", "Tourist card info", "Smart card info"],
  };
}

// ────────────── Metro Map Handler ──────────────
function handleMetroMap(lang: "EN" | "HI" = "EN"): ChatReply {
  const defaults = lang === "HI" ? QUICK_REPLY_DEFAULTS_HI : QUICK_REPLY_DEFAULTS;
  const linesData = lang === "HI" ? [
    { name: "रेड लाइन", color: "RED", terminals: ["Shaheed Sthal (New Bus Adda)", "Rithala"], stationCount: 29, length: "34.7 किमी" },
    { name: "येलो लाइन", color: "YELLOW", terminals: ["Samaypur Badli", "HUDA City Centre"], stationCount: 37, length: "49.3 किमी" },
    { name: "ब्लू लाइन", color: "BLUE", terminals: ["Dwarka Sector 21", "Noida Electronic City / Vaishali"], stationCount: 50, length: "56.6 किमी" },
    { name: "ग्रीन लाइन", color: "GREEN", terminals: ["Kirti Nagar", "Brigadier Hoshiyar Singh"], stationCount: 21, length: "29.7 किमी" },
    { name: "वायलेट लाइन", color: "VIOLET", terminals: ["Kashmere Gate", "Raja Nahar Singh (Ballabhgarh)"], stationCount: 34, length: "46.6 किमी" },
    { name: "पिंक लाइन", color: "PINK", terminals: ["Majlis Park", "Shiv Vihar"], stationCount: 38, length: "59.7 किमी" },
    { name: "मजेंटा लाइन", color: "MAGENTA", terminals: ["Botanical Garden", "Janakpuri West"], stationCount: 25, length: "37.5 किमी" },
    { name: "एयरपोर्ट एक्सप्रेस", color: "ORANGE/AIRPORT", terminals: ["New Delhi", "Dwarka Sector 21"], stationCount: 6, length: "22.7 किमी" },
    { name: "एक्वा लाइन", color: "AQUA", terminals: ["Noida Sector 51", "Noida Sector 76"], stationCount: 16, length: "15.1 किमी" },
    { name: "ग्रे लाइन", color: "GRAY", terminals: ["Dwarka", "Dhansa Bus Stand"], stationCount: 4, length: "5.1 किमी" },
    { name: "रैपिड मेट्रो", color: "RAPID", terminals: ["Sector 55-56", "Sector 54 Chowk"], stationCount: 6, length: "5.1 किमी" },
  ] : [
    { name: "Red Line", color: "RED", terminals: ["Shaheed Sthal (New Bus Adda)", "Rithala"], stationCount: 29, length: "34.7 km" },
    { name: "Yellow Line", color: "YELLOW", terminals: ["Samaypur Badli", "HUDA City Centre"], stationCount: 37, length: "49.3 km" },
    { name: "Blue Line", color: "BLUE", terminals: ["Dwarka Sector 21", "Noida Electronic City / Vaishali"], stationCount: 50, length: "56.6 km" },
    { name: "Green Line", color: "GREEN", terminals: ["Kirti Nagar", "Brigadier Hoshiyar Singh"], stationCount: 21, length: "29.7 km" },
    { name: "Violet Line", color: "VIOLET", terminals: ["Kashmere Gate", "Raja Nahar Singh (Ballabhgarh)"], stationCount: 34, length: "46.6 km" },
    { name: "Pink Line", color: "PINK", terminals: ["Majlis Park", "Shiv Vihar"], stationCount: 38, length: "59.7 km" },
    { name: "Magenta Line", color: "MAGENTA", terminals: ["Botanical Garden", "Janakpuri West"], stationCount: 25, length: "37.5 km" },
    { name: "Airport Express", color: "ORANGE/AIRPORT", terminals: ["New Delhi", "Dwarka Sector 21"], stationCount: 6, length: "22.7 km" },
    { name: "Aqua Line", color: "AQUA", terminals: ["Noida Sector 51", "Noida Sector 76"], stationCount: 16, length: "15.1 km" },
    { name: "Gray Line", color: "GRAY", terminals: ["Dwarka", "Dhansa Bus Stand"], stationCount: 4, length: "5.1 km" },
    { name: "Rapid Metro", color: "RAPID", terminals: ["Sector 55-56", "Sector 54 Chowk"], stationCount: 6, length: "5.1 km" },
  ];  return {
    text: lang === "HI" ? "दिल्ली मेट्रो नेटवर्क — सभी लाइनें और स्टेशन:" : "Delhi Metro Network — all lines and stations:",
    card: {
      type: "metro_map",
      data: {
        lines: linesData,
        totalStations: 286,
        interchangeStations: [
          "Kashmere Gate", "Rajiv Chowk", "Central Secretariat", "Mandi House",
          "Kirti Nagar", "Botanical Garden", "Hauz Khas", "Kalkaji Mandir",
          "Lajpat Nagar", "Janakpuri West", "Azadpur", "Majlis Park",
          "Welcome", "Anand Vihar",
        ],
      },
    },
    quickReplies: defaults,
  };
}

// ────────────── Penalty & Fines Handler ──────────────
function handlePenalty(lang: "EN" | "HI" = "EN"): ChatReply {
  const defaults = lang === "HI" ? QUICK_REPLY_DEFAULTS_HI : QUICK_REPLY_DEFAULTS;
  if (lang === "HI") {
    return {
      text: "डीएमआरसी जुर्माना और चालान की जानकारी:",
      card: {
        type: "penalty",
        data: {
          title: "जुर्माना और चालान",
          icon: "alert-circle-outline",
          accentColor: undefined,
          sections: [
            {
              title: "यात्रा उल्लंघन",
              icon: "ticket-outline",
              items: [
                { label: "बिना टिकट यात्रा करना", detail: "₹200 + यात्रा का किराया", highlight: true },
                { label: "महिला कोच में यात्रा (पुरुष)", detail: "₹250 जुर्माना", highlight: true },
                { label: "टिकट वाले स्टेशन से आगे यात्रा", detail: "₹200 + अतिरिक्त किराया", highlight: false },
                { label: "अन्य के स्मार्ट कार्ड का उपयोग", detail: "₹200 जुर्माना", highlight: false },
              ],
            },
            {
              title: "आचरण उल्लंघन",
              icon: "ban-outline",
              items: [
                { label: "मेट्रो में खाना / पीना", detail: "₹200 जुर्माना", highlight: false },
                { label: "मेट्रो परिसर में धूम्रपान", detail: "₹200 जुर्माना", highlight: false },
                { label: "थूकना / गंदगी फैलाना", detail: "₹200 जुर्माना", highlight: false },
                { label: "उपद्रव करना / दुर्व्यवहार", detail: "₹500 जुर्माना + पुलिस कार्रवाई", highlight: true },
                { label: "अनधिकृत बिक्री / भीख मांगना", detail: "₹500 जुर्माना", highlight: false },
              ],
            },
            {
              title: "संपत्ति उल्लंघन",
              icon: "construct-outline",
              items: [
                { label: "मेट्रो संपत्ति को नुकसान", detail: "₹500–₹5,000 + लागत वसूली", highlight: true },
                { label: "अनधिकृत फोटोग्राफी/फिल्मिंग", detail: "₹200 जुर्माना", highlight: false },
                { label: "पोस्टर / विज्ञापन चिपकाना", detail: "₹500 जुर्माना", highlight: false },
              ],
            },
          ],
          footer: "जुर्माने डीएमआरसी अधिनियम के अनुसार हैं। राशि को अपडेट किया जा सकता है — स्टेशन पर पुष्टि करें।",
        },
      },
      quickReplies: defaults,
    };
  }
  return {
    text: "DMRC penalty and fine information:",
    card: {
      type: "penalty",
      data: {
        title: "Penalty & Fines",
        icon: "alert-circle-outline",
        accentColor: undefined,
        sections: [
          {
            title: "Travel Violations",
            icon: "ticket-outline",
            items: [
              { label: "Traveling without ticket", detail: "₹200 + fare for the journey", highlight: true },
              { label: "Traveling in Women's Coach (men)", detail: "₹250 fine", highlight: true },
              { label: "Traveling beyond ticketed station", detail: "₹200 + excess fare", highlight: false },
              { label: "Using someone else's Smart Card", detail: "₹200 fine", highlight: false },
            ],
          },
          {
            title: "Conduct Violations",
            icon: "ban-outline",
            items: [
              { label: "Eating / Drinking in metro", detail: "₹200 fine", highlight: false },
              { label: "Smoking in metro premises", detail: "₹200 fine", highlight: false },
              { label: "Spitting / Littering", detail: "₹200 fine", highlight: false },
              { label: "Creating nuisance / misbehavior", detail: "₹500 fine + police action", highlight: true },
              { label: "Unauthorized vending / begging", detail: "₹500 fine", highlight: false },
            ],
          },
          {
            title: "Property Violations",
            icon: "construct-outline",
            items: [
              { label: "Damaging metro property", detail: "₹500–₹5,000 + cost recovery", highlight: true },
              { label: "Unauthorized photography/filming", detail: "₹200 fine", highlight: false },
              { label: "Pasting bills / advertisements", detail: "₹500 fine", highlight: false },
            ],
          },
        ],
        footer: "Fines are as per DMRC Act & Metro Railway Operations and Maintenance Act. Amounts may be updated — confirm at station.",
      },
    },
    quickReplies: ["Metro rules", "Help & FAQ", "Customer support"],
  };
}

// ────────────── Tourist Card Handler ──────────────
function handleTouristCard(lang: "EN" | "HI" = "EN"): ChatReply {
  const defaults = lang === "HI" ? QUICK_REPLY_DEFAULTS_HI : QUICK_REPLY_DEFAULTS;
  if (lang === "HI") {
    return {
      text: "डीएमआरसी पर्यटक कार्ड — असीमित यात्रा पास:",
      card: {
        type: "tourist_card",
        data: {
          title: "पर्यटक कार्ड और पास",
          icon: "card-outline",
          accentColor: undefined,
          sections: [
            {
              title: "पर्यटक कार्ड",
              icon: "airplane-outline",
              items: [
                { label: "1-दिवसीय पर्यटक कार्ड — ₹200", detail: "असीमित सवारी 24 घंटे के लिए। ₹50 वापसी योग्य सुरक्षा जमा। कुल लागत: ₹250।", highlight: true },
                { label: "3-दिवसीय पर्यटक कार्ड — ₹500", detail: "असीमित सवारी 72 घंटे के लिए। ₹50 वापसी योग्य सुरक्षा जमा। कुल लागत: ₹550।", highlight: true },
              ],
            },
            {
              title: "कहाँ से खरीदें",
              icon: "location-outline",
              items: [
                { label: "एयरपोर्ट एक्सप्रेस लाइन स्टेशन", detail: "नई दिल्ली, शिवाजी स्टेडियम, धौला कुआँ, द्वारका सेक्टर 21", highlight: false },
                { label: "मुख्य इंटरचेंज स्टेशन", detail: "राजीव चौक, कश्मीरी गेट, केंद्रीय सचिवालय, हौज़ खास", highlight: false },
                { label: "ग्राहक सेवा काउंटर", detail: "सभी डीएमआरसी स्टेशन कस्टमर केयर खिड़कियों पर उपलब्ध", highlight: false },
              ],
            },
            {
              title: "महत्वपूर्ण नोट",
              icon: "information-circle-outline",
              items: [
                { label: "एयरपोर्ट लाइन पर मान्य नहीं", detail: "पर्यटक कार्ड एयरपोर्ट एक्सप्रेस लाइन पर मान्य नहीं हैं। अलग टिकट आवश्यक है।", highlight: false },
                { label: "सुरक्षा जमा वापसी", detail: "सुरक्षा जमा ₹50 वापस पाने के लिए किसी भी ग्राहक सेवा काउंटर पर कार्ड वापस करें।", highlight: false },
              ],
            },
          ],
          footer: "कीमतों में संशोधन किया जा सकता है। स्टेशन काउंटर या डीएमआरसी ऐप पर पुष्टि करें।",
        },
      },
      quickReplies: defaults,
    };
  }
  return {
    text: "DMRC Tourist Card — unlimited travel passes:",
    card: {
      type: "tourist_card",
      data: {
        title: "Tourist Cards & Passes",
        icon: "card-outline",
        accentColor: undefined,
        sections: [
          {
            title: "Tourist Cards",
            icon: "airplane-outline",
            items: [
              { label: "1-Day Tourist Card — ₹200", detail: "Unlimited rides for 24 hours from first use. ₹50 refundable security deposit. Total cost: ₹250.", highlight: true },
              { label: "3-Day Tourist Card — ₹500", detail: "Unlimited rides for 72 hours from first use. ₹50 refundable security deposit. Total cost: ₹550.", highlight: true },
            ],
          },
          {
            title: "Where to Buy",
            icon: "location-outline",
            items: [
              { label: "Airport Express Line stations", detail: "New Delhi, Shivaji Stadium, Dhaula Kuan, Dwarka Sector 21", highlight: false },
              { label: "Major interchange stations", detail: "Rajiv Chowk, Kashmere Gate, Central Secretariat, Hauz Khas", highlight: false },
              { label: "Customer Care counters", detail: "Available at all DMRC station customer care windows", highlight: false },
            ],
          },
          {
            title: "Important Notes",
            icon: "information-circle-outline",
            items: [
              { label: "Not valid on Airport Express Line", detail: "Tourist cards cannot be used on the Airport Express Line. Separate ticket required.", highlight: false },
              { label: "Deposit refund", detail: "Return the card at any customer care counter within 45 days to get ₹50 deposit back.", highlight: false },
            ],
          },
        ],
        footer: "Prices may be revised. Confirm at station counter or DMRC app.",
      },
    },
    quickReplies: ["Show fare table", "Smart card info", "Plan a route"],
  };
}

// ────────────── Parking Info Handler ──────────────
function handleParking(lang: "EN" | "HI" = "EN"): ChatReply {
  const defaults = lang === "HI" ? QUICK_REPLY_DEFAULTS_HI : QUICK_REPLY_DEFAULTS;
  if (lang === "HI") {
    return {
      text: "डीएमआरसी स्टेशन पार्किंग की जानकारी:",
      card: {
        type: "parking",
        data: {
          title: "मेट्रो स्टेशन पार्किंग",
          icon: "car-outline",
          accentColor: undefined,
          sections: [
            {
              title: "पार्किंग दरें (अनुमानित)",
              icon: "cash-outline",
              items: [
                { label: "दोपहिया वाहन", detail: "अधिकांश स्टेशनों पर ₹10–₹15 प्रति दिन", highlight: false },
                { label: "चारपहिया वाहन", detail: "अधिकांश स्टेशनों पर ₹20–₹30 प्रति दिन", highlight: false },
                { label: "मासिक पास (दोपहिया)", detail: "चुनिंदा स्टेशनों पर ₹200–₹300/माह", highlight: false },
                { label: "मासिक पास (चारपहिया)", detail: "चुनिंदा स्टेशनों पर ₹500–₹800/माह", highlight: false },
              ],
            },
            {
              title: "पार्किंग वाले स्टेशन",
              icon: "navigate-outline",
              items: [
                { label: "मुख्य पार्किंग सुविधाएं", detail: "द्वारका सेक्टर 21, नोएडा सेक्टर 62, हुडा सिटी सेंटर, समयपुर बादली, रिठाला, मुंडका, बॉटनिकल गार्डन", highlight: false },
                { label: "मल्टी-लेवल पार्किंग", detail: "कश्मीरी गेट, आनंद विहार, सिकंदरपुर (गुरुग्राम) — बड़ी पार्किंग क्षमता", highlight: true },
              ],
            },
            {
              title: "महत्वपूर्ण नोट",
              icon: "information-circle-outline",
              items: [
                { label: "स्मार्ट कार्ड पार्किंग छूट", detail: "यदि आपके पास वैध स्मार्ट कार्ड है तो कुछ स्टेशनों पर छूट मिलती है", highlight: false },
                { label: "डीएमआरसी चोरी/नुकसान के लिए उत्तरदायी नहीं", detail: "पार्किंग अपने जोखिम पर है। वाहन में कीमती सामान न छोड़ें।", highlight: false },
              ],
            },
          ],
          footer: "दरें और उपलब्धता स्टेशन के आधार पर भिन्न हो सकती हैं। काउंटर पर पुष्टि करें।",
        },
      },
      quickReplies: defaults,
    };
  }
  return {
    text: "DMRC station parking information:",
    card: {
      type: "parking",
      data: {
        title: "Metro Station Parking",
        icon: "car-outline",
        accentColor: undefined,
        sections: [
          {
            title: "Parking Rates (Approx.)",
            icon: "cash-outline",
            items: [
              { label: "Two-Wheeler", detail: "₹10–₹15 per day at most stations", highlight: false },
              { label: "Four-Wheeler", detail: "₹20–₹30 per day at most stations", highlight: false },
              { label: "Monthly Pass (Two-Wheeler)", detail: "₹200–₹300/month at select stations", highlight: false },
              { label: "Monthly Pass (Four-Wheeler)", detail: "₹500–₹800/month at select stations", highlight: false },
            ],
          },
          {
            title: "Stations with Parking",
            icon: "navigate-outline",
            items: [
              { label: "Major parking facilities", detail: "Dwarka Sector 21, Noida Sector 62, HUDA City Centre, Samaypur Badli, Rithala, Mundka, Botanical Garden", highlight: false },
              { label: "Multi-Level Parking", detail: "Kashmere Gate, Anand Vihar, Sikanderpur (Gurugram) — these have larger multi-level car parks", highlight: true },
            ],
          },
          {
            title: "Important Notes",
            icon: "information-circle-outline",
            items: [
              { label: "Smart card linked parking", detail: "Some stations offer discounted parking if you have a valid DMRC Smart Card", highlight: false },
              { label: "DMRC is not responsible for theft/damage", detail: "Park at your own risk. Do not leave valuables in vehicles.", highlight: false },
            ],
          },
        ],
        footer: "Parking rates and availability vary by station. Confirm at the parking counter.",
      },
    },
    quickReplies: ["Station gates", "Feeder bus", "Plan a route"],
  };
}

// ────────────── Feeder Bus Handler ──────────────
function handleFeederBus(lang: "EN" | "HI" = "EN"): ChatReply {
  const defaults = lang === "HI" ? QUICK_REPLY_DEFAULTS_HI : QUICK_REPLY_DEFAULTS;
  if (lang === "HI") {
    return {
      text: "फीडर बस सेवाएं और अंतिम मील कनेक्टिविटी की जानकारी:",
      card: {
        type: "feeder_bus",
        data: {
          title: "फीडर बस सेवाएं",
          icon: "bus-outline",
          accentColor: undefined,
          sections: [
            {
              title: "फीडर बसों के बारे में",
              icon: "information-circle-outline",
              items: [
                { label: "फीडर बसें क्या हैं?", detail: "मेट्रो स्टेशनों को नजदीकी आवासीय क्षेत्रों, बाजारों और बस स्टैंडों से जोड़ने वाली छोटी बसें (एसी/गैर-एसी)।", highlight: false },
                { label: "संचालक", detail: "डीएमआरसी साझेदारी के तहत डिम्ट्स (DIMTS) द्वारा संचालित", highlight: false },
              ],
            },
            {
              title: "प्रमुख मार्ग",
              icon: "map-outline",
              items: [
                { label: "द्वारका कॉरिडोर", detail: "द्वारका सेक्टर 21 और द्वारका मोड़ से नजदीकी सेक्टरों को जोड़ता है", highlight: false },
                { label: "नोएडा कॉरिडोर", detail: "नोएडा सेक्टर 62, नोएडा सिटी सेंटर से आवासीय क्षेत्रों के लिए", highlight: false },
                { label: "गुरुग्राम कॉरिडोर", detail: "हुडा सिटी सेंटर, सिकंदरपुर से साइबर हब और डीएलएफ क्षेत्र", highlight: false },
                { label: "उत्तरी दिल्ली", detail: "रिठाला, समयपुर बादली से रोहिणी सेक्टर और नरेला", highlight: false },
              ],
            },
            {
              title: "किराया और समय",
              icon: "time-outline",
              items: [
                { label: "किराया", detail: "दूरी के आधार पर ₹5–₹15। संपर्क रहित स्मार्ट कार्ड का उपयोग किया जा सकता है।", highlight: false },
                { label: "समय", detail: "मेट्रो संचालन के समय (सुबह 6:00 बजे से रात 10:00 बजे) के साथ संरेखित। आवृत्ति: हर 10-20 मिनट।", highlight: false },
              ],
            },
          ],
          footer: "मार्गों में संशोधन संभव है। डीएमआरसी या आधिकारिक चार्टर (Chartr) ऐप देखें।",
        },
      },
      quickReplies: defaults,
    };
  }
  return {
    text: "DMRC feeder bus and last-mile connectivity:",
    card: {
      type: "feeder_bus",
      data: {
        title: "Feeder Bus Services",
        icon: "bus-outline",
        accentColor: undefined,
        sections: [
          {
            title: "About Feeder Buses",
            icon: "information-circle-outline",
            items: [
              { label: "What are feeder buses?", detail: "Small AC/non-AC buses connecting metro stations to nearby residential areas, markets, and bus stops for last-mile connectivity.", highlight: false },
              { label: "Operated by", detail: "DIMTS (Delhi Integrated Multi-Modal Transit System) under DMRC partnership", highlight: false },
            ],
          },
          {
            title: "Key Routes",
            icon: "map-outline",
            items: [
              { label: "Dwarka corridor", detail: "Feeder buses from Dwarka Sector 21, Dwarka Mor connecting nearby sectors", highlight: false },
              { label: "Noida corridor", detail: "Feeder services from Noida Sector 62, Noida City Centre to residential sectors", highlight: false },
              { label: "Gurugram corridor", detail: "Feeder buses from HUDA City Centre, Sikanderpur to Cyber Hub, DLF areas", highlight: false },
              { label: "North Delhi", detail: "Services from Rithala, Samaypur Badli to Rohini sectors and Narela", highlight: false },
            ],
          },
          {
            title: "Fare & Timings",
            icon: "time-outline",
            items: [
              { label: "Fare", detail: "₹5–₹15 depending on distance. Contactless/Smart Card payment available on some routes.", highlight: false },
              { label: "Timings", detail: "Generally aligned with metro operating hours (6 AM – 10 PM). Frequency: every 10–20 minutes.", highlight: false },
            ],
          },
        ],
        footer: "Routes and timings change frequently. Check real-time info via the DMRC or Chartr app.",
      },
    },
    quickReplies: ["Parking info", "Plan a route", "Metro map"],
  };
}

// ────────────── Notices & Alerts Handler ──────────────
function handleNotices(lang: "EN" | "HI" = "EN"): ChatReply {
  const defaults = lang === "HI" ? QUICK_REPLY_DEFAULTS_HI : QUICK_REPLY_DEFAULTS;
  if (lang === "HI") {
    return {
      text: "नवीनतम सेवा सूचनाएं और सलाह:",
      card: {
        type: "notices",
        data: {
          title: "सेवा सूचनाएं और अलर्ट",
          icon: "megaphone-outline",
          accentColor: undefined,
          sections: [
            {
              title: "सामान्य सलाह",
              icon: "information-circle-outline",
              items: [
                { label: "संचालन का समय", detail: "मेट्रो सेवाएं सुबह ~5:00 से रात ~11:30 बजे तक चलती हैं। अंतिम ट्रेन का समय अलग-अलग होता है।", highlight: false },
                { label: "भीड़ का समय (Peak Hours)", detail: "कार्यदिवसों पर सुबह 8:00–10:00 और शाम 5:30–7:30 बजे। अधिक फ्रीक्वेंसी।", highlight: false },
                { label: "सप्ताहांत / अवकाश", detail: "रविवार और छुट्टियों पर थोड़ी कम फ्रीक्वेंसी रहती है। रियायती किराया लागू।", highlight: false },
              ],
            },
            {
              title: "विशेष आयोजन",
              icon: "calendar-outline",
              items: [
                { label: "त्योहारों पर समय विस्तार", detail: "दिवाली, नए साल, होली आदि के दौरान समय बढ़ाया जा सकता है। सोशल मीडिया देखें।", highlight: true },
                { label: "गणतंत्र दिवस / स्वतंत्रता दिवस", detail: "26 जनवरी और 15 अगस्त को राजपथ के पास कुछ स्टेशनों पर प्रवेश प्रतिबंधित रह सकता है।", highlight: true },
                { label: "वीआईपी मूवमेंट", detail: "वीआईपी मूवमेंट के समय सुरक्षा कारणों से चुनिंदा गेट या स्टेशन अस्थायी रूप से बंद हो सकते हैं।", highlight: false },
              ],
            },
            {
              title: "अपडेट प्राप्त करें",
              icon: "logo-twitter",
              items: [
                { label: "ट्विटर (X)", detail: "@OfficialDMRC — लाइव सेवा अपडेट और देरी की सूचनाएं", highlight: false },
                { label: "डीएमआरसी ऐप", detail: "लाइव अपडेट और टिकट के लिए आधिकारिक दिल्ली मेट्रो रेल ऐप डाउनलोड करें", highlight: false },
              ],
            },
          ],
          footer: "यह सामान्य सलाहकार जानकारी है। वास्तविक समय की व्यवधान अलर्ट के लिए, ट्विटर पर @OfficialDMRC देखें।",
        },
      },
      quickReplies: defaults,
    };
  }
  return {
    text: "Latest DMRC service notices and advisories:",
    card: {
      type: "notices",
      data: {
        title: "Service Notices & Alerts",
        icon: "megaphone-outline",
        accentColor: undefined,
        sections: [
          {
            title: "General Advisory",
            icon: "information-circle-outline",
            items: [
              { label: "Operating Hours", detail: "Metro services run from ~5:00 AM to ~11:30 PM. Last train timing varies by station.", highlight: false },
              { label: "Peak Hours", detail: "8:00–10:00 AM and 5:30–7:30 PM on weekdays. Trains run at higher frequency (2–4 min).", highlight: false },
              { label: "Weekend/Holiday", detail: "Reduced frequency on Sundays and national holidays. Discounted fares apply.", highlight: false },
            ],
          },
          {
            title: "Special Events",
            icon: "calendar-outline",
            items: [
              { label: "Extended hours on festivals", detail: "During Diwali, New Year, Holi, and major events, metro may operate extended hours. Check DMRC Twitter/app.", highlight: true },
              { label: "Republic Day / Independence Day", detail: "Some stations near Kartavya Path may have restricted entry on 26 Jan and 15 Aug.", highlight: true },
              { label: "G20 / VIP Movement", detail: "During VIP movements, select stations may be temporarily closed. Follow DMRC social media for live updates.", highlight: false },
            ],
          },
          {
            title: "Stay Updated",
            icon: "logo-twitter",
            items: [
              { label: "Twitter/X", detail: "@OfficialDMRC — real-time service alerts and delay notifications", highlight: false },
              { label: "DMRC App", detail: "Download the official Delhi Metro Rail app for live updates, route planning, and QR ticketing", highlight: false },
              { label: "Website", detail: "delhimetrorail.com — official notices, tenders, and news", highlight: false },
            ],
          },
        ],
        footer: "This is general advisory information. For real-time disruption alerts, follow @OfficialDMRC on Twitter/X.",
      },
    },
    quickReplies: ["Train timings", "Metro map", "Help & FAQ"],
  };
}

function handleLineStatus(lang: "EN" | "HI" = "EN"): ChatReply {
  const defaults = lang === "HI" ? QUICK_REPLY_DEFAULTS_HI : QUICK_REPLY_DEFAULTS;
  const text = lang === "HI"
    ? "दिल्ली मेट्रो लाइन संचालन स्थिति बोर्ड — सभी लाइनों की वर्तमान स्थिति:"
    : "Delhi Metro operational line status board — current status of all lines:";
  return {
    text,
    card: {
      type: "line_status",
      data: {},
    },
    quickReplies: defaults,
  };
}

export function getChatReply(userText: string, pending?: PendingClarification, language: "EN" | "HI" = "EN"): ChatReply {
  const nlu = analyze(userText);
  const t = TRANSLATIONS[language];
  const defaults = language === "HI" ? QUICK_REPLY_DEFAULTS_HI : QUICK_REPLY_DEFAULTS;

  // If the bot just asked a clarifying question, and this message looks
  // like a direct, bare answer to it (resolves to a single station and
  // didn't itself trigger a clear, different intent), treat it as
  // completing THAT question rather than re-analyzing it as a brand new,
  // unrelated message.
  if (pending && (nlu.intent === "facilities" || nlu.intent === "unknown")) {
    const station = nlu.station ?? bestStationMatch(userText);
    if (station) {
      switch (pending.intent) {
        case "first_last_train":
          return handleSchedule(station, language);
        case "gates":
          return handleGates(station, language);
        case "interchange_info":
          return handleInterchange(station, language);
        case "facilities":
          return handleFacilities(station, language);
        case "journey":
          return pending.knownOrigin ? handleJourney(pending.knownOrigin, station, language) : handleJourney(station, undefined, language);
        case "fare":
          return pending.knownOrigin ? handleFare(pending.knownOrigin, station, language) : handleFare(station, undefined, language);
      }
    }
  }

  switch (nlu.intent) {
    case "greeting":
      return { text: t.greeting, quickReplies: defaults };
    case "journey":
      return handleJourney(nlu.origin, nlu.destination, language);
    case "fare":
      return handleFare(nlu.origin, nlu.destination, language);
    case "first_last_train":
      return handleSchedule(nlu.station ?? nlu.origin, language);
    case "interchange_info":
      return handleInterchange(nlu.station ?? nlu.origin, language);
    case "gates":
      return handleGates(nlu.station ?? nlu.origin, language);
    case "facilities":
      return handleFacilities(nlu.station ?? nlu.origin, language);
    case "emergency":
      return handleEmergency(language);
    case "help":
      return handleHelp(language);
    case "metro_map":
      return handleMetroMap(language);
    case "penalty_fines":
      return handlePenalty(language);
    case "tourist_card":
      return handleTouristCard(language);
    case "parking_info":
      return handleParking(language);
    case "feeder_bus":
      return handleFeederBus(language);
    case "notices_alerts":
      return handleNotices(language);
    case "line_status":
      return handleLineStatus(language);
    case "smart_card":
      return {
        text: t.smart_card,
        card: { type: "smart_card", data: {} },
      };
    default: {
      const staticAnswer = language === "HI" ? STATIC_ANSWERS_HI[nlu.intent] : STATIC_ANSWERS[nlu.intent];
      if (staticAnswer) return { text: staticAnswer };

      // Check if user typed a known command phrase from the service menu
      const lowerText = userText.toLowerCase().trim();
      if (lowerText === "show fare table" || lowerText === "fare table" || lowerText === "fare chart") return handleFareTable();

      // Try one more time: maybe it's a bare station name search.
      const matches = searchStations(userText, 3);
      if (matches.length > 0) {
        const bestMatch = matches[0];
        return {
          text: language === "HI"
            ? `मुझे "${bestMatch.name}" स्टेशन मिला। आप इसके बारे में क्या जानना चाहते हैं?`
            : `I found ${bestMatch.name} station. What would you like to know?`,
          card: {
            type: "stationInfo",
            data: { station: bestMatch },
          },
          quickReplies: language === "HI"
            ? [`${bestMatch.name} से रूट`, `${bestMatch.name} की पहली/आखिरी ट्रेन`, `${bestMatch.name} के गेट`]
            : [`Route from ${bestMatch.name}`, `Timings at ${bestMatch.name}`, `Gates at ${bestMatch.name}`],
        };
      }
      return { text: t.unknown, quickReplies: defaults };
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
