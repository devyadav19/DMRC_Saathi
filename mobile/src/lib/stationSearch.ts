import { physicalStations, PhysicalStation } from "./data";

// Common alternate spellings / Hinglish forms / abbreviations seen in real
// passenger queries, mapped to the canonical (normalized) GTFS station name
// fragment they should resolve to. This list is intentionally short and
// only covers genuinely ambiguous or very-commonly-typed cases; the fuzzy
// matcher below handles ordinary typos on its own.
const ALIASES: Record<string, string> = {
  "rajiv chowk": "rajiv chowk",
  "cp": "rajiv chowk", // Connaught Place, common colloquial name
  "connaught place": "rajiv chowk",
  "new delhi station": "new delhi",
  "ndls": "new delhi",
  "kashmiri gate": "kashmere gate",
  "huda city center": "huda city centre",
  "gurgaon": "huda city centre",
  "airport": "igi airport",
  "igi": "igi airport",
  "t3": "igi airport",
  "dwarka 21": "dwarka sector - 21",
  "noida city centre": "noida city centre",
  "botanical garden": "botanical garden",
  "akshardham": "akshardham",
};

// Common filler/function words that must NEVER be treated as a station-name
// fragment on their own, no matter how short the edit distance or how
// coincidentally they appear as a substring of a real station name (e.g.
// "and" is literally inside "Moolchand"; "to"/"at"/"se"/"ka" appear inside
// many station names). Without this guard, ordinary sentence words leak
// through as false station matches.
const STOPWORDS = new Set([
  // English
  "a", "an", "the", "is", "are", "was", "to", "at", "in", "on", "of", "for",
  "and", "or", "from", "with", "by", "this", "that", "what", "when", "where",
  "how", "much", "many", "do", "does", "did", "i", "me", "my", "you", "your",
  "it", "its", "be", "can", "will", "should", "would", "please", "tell",
  "get", "want", "need", "have", "has", "had",
  // domain words that are NOT station names by themselves
  "train", "trains", "metro", "station", "stations", "first", "last", "next",
  "fare", "fares", "ticket", "tickets", "gate", "gates", "exit", "exits",
  "entry", "entries", "line", "lines", "timing", "timings", "time",
  // Hinglish / Hindi (Romanized)
  "se", "ka", "ki", "ke", "hai", "hain", "kya", "kab", "kaha", "kahan",
  "jana", "jaana", "tak", "kitna", "kitni", "kaise", "wala", "wali",
]);

export function normalize(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[.,]/g, "")
    .replace(/\bmetro( station)?\b/g, "")
    .replace(/\bsec\b/g, "sector")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Words that appear as a token in 3+ DIFFERENT station names are too
// generic to ever trust as a standalone match - e.g. "Chowk" appears in
// Rajiv Chowk, Bata Chowk, IFFCO Chowk, Pari Chowk, Patel Chowk, Chandni
// Chowk, NHPC Chowk, Neelam Chowk Ajronda, and Sector 54 Chowk (9 distinct
// stations). Without this, a lone word like "Chowk" in a follow-up message
// ("IFFCO Chowk") could spuriously co-match an unrelated station and turn
// a single-station answer into a fabricated two-station journey. Computed
// once from the real station data rather than a manually maintained list,
// so it automatically covers similarly generic words (Nagar, Vihar, Park,
// Sector, Road, Marg, Garden, ...) without needing to enumerate them.
const GENERIC_WORDS: Set<string> = (() => {
  const wordToStations = new Map<string, Set<string>>();
  for (const s of physicalStations) {
    const words = normalize(s.name).split(" ");
    const key = s.gtfsStopId ?? s.name;
    for (const w of words) {
      if (w.length < 3) continue;
      if (!wordToStations.has(w)) wordToStations.set(w, new Set());
      wordToStations.get(w)!.add(key);
    }
  }
  const generic = new Set<string>();
  for (const [word, stations] of wordToStations) {
    if (stations.size >= 3) generic.add(word);
  }
  return generic;
})();

// Lightweight Levenshtein distance for fuzzy matching short station names.
function levenshtein(a: string, b: string): number {
  const m = a.length,
    n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[] = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] =
        a[i - 1] === b[j - 1]
          ? prev
          : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[n];
}

interface ScoredStation {
  station: PhysicalStation;
  score: number; // lower is better
}

/**
 * Search for stations matching free-text input. Handles:
 *  - exact / substring matches
 *  - common aliases & Hinglish/colloquial names
 *  - misspellings, via edit-distance on normalized names
 * Returns results sorted best-first.
 */
export function searchStations(query: string, limit = 5): PhysicalStation[] {
  const q = normalize(query);
  if (!q || STOPWORDS.has(q) || GENERIC_WORDS.has(q)) return [];

  const aliasTarget = ALIASES[q];
  // Below this length, substring/fuzzy matching is too likely to produce
  // coincidental false positives (e.g. "and" inside "Moolchand"); only
  // exact equality or a known alias is trusted for very short input.
  const allowLooseMatching = q.length >= 4;

  const scored: ScoredStation[] = [];
  for (const s of physicalStations) {
    const name = normalize(s.name);
    const commercial = s.commercialName ? normalize(s.commercialName) : "";

    let best = Infinity;

    if (aliasTarget && (name === aliasTarget || name.includes(aliasTarget))) {
      best = 0;
    }
    if (name === q || commercial === q) {
      best = Math.min(best, 0);
    } else if (!allowLooseMatching) {
      // skip all fuzzy/substring branches for very short queries
    } else if (name.includes(q) || (commercial && commercial.includes(q))) {
      // query is a prefix/substring of the station name (e.g. user typed
      // "dwarka" and this is "dwarka sector 21") - prefer the SHORTEST
      // such name (closest to what was actually typed).
      const extra = name.length - q.length;
      best = Math.min(best, 1 + Math.min(extra, 20) / 40);
    } else if (q.includes(name) && name.length >= 4) {
      // station name is a substring of the (longer) query - prefer the
      // LONGEST such name, i.e. the most specific match consumed from the
      // query, so "dwarka sector 21" wins over plain "dwarka".
      const coverage = name.length / q.length; // 0..1, higher = more of the query matched
      best = Math.min(best, 1.5 + (1 - coverage) * 0.5);
    } else {
      // edit distance, normalized by length so short/long names are
      // comparable; only worth considering if query isn't wildly off-length
      const d = levenshtein(q, name);
      const maxLen = Math.max(q.length, name.length);
      const normalized = d / maxLen;
      if (normalized < 0.4) {
        best = Math.min(best, 2 + normalized * 5);
      }
      // also try matching against individual words of multi-word names -
      // word must be at least 5 characters so short generic words (gate,
      // east, etc.) can't false-match via a 1-character edit distance.
      const words = name.split(" ");
      for (const w of words) {
        if (w.length < 5 || STOPWORDS.has(w) || GENERIC_WORDS.has(w)) continue;
        const wd = levenshtein(q, w) / Math.max(q.length, w.length);
        if (wd < 0.25) best = Math.min(best, 2.5 + wd * 5);
      }
    }

    if (best < Infinity) scored.push({ station: s, score: best });
  }

  scored.sort((a, b) => a.score - b.score);
  const seen = new Set<string>();
  const out: PhysicalStation[] = [];
  for (const s of scored) {
    const key = s.station.gtfsStopId ?? s.station.name;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s.station);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Given a set of candidate station matches found from the SAME piece of
 * text, drop any whose name is a strict substring of another match's name
 * that's also in the set - e.g. if both "Dwarka" and "Dwarka Sector - 21"
 * matched, "Dwarka" is almost certainly the same mention being double-
 * counted, not a second, independent station. Without this, single-station
 * messages can get misread as two-station journeys whenever one real
 * station name happens to be contained inside another (common with
 * "Dwarka"/"Dwarka Sector N", "Sector"/"Noida Sector N", etc.).
 */
export function suppressSubsumedStations(stations: PhysicalStation[]): PhysicalStation[] {
  if (stations.length <= 1) return stations;
  const withNames = stations.map((s) => ({ s, name: normalize(s.name) }));
  // consider the most specific (longest) names first
  const byLength = [...withNames].sort((a, b) => b.name.length - a.name.length);
  const accepted: string[] = [];
  const keepKeys = new Set<string>();
  for (const { s, name } of byLength) {
    const subsumed = accepted.some((n) => n !== name && n.includes(name));
    if (subsumed) continue;
    accepted.push(name);
    keepKeys.add(s.gtfsStopId ?? s.name);
  }
  // preserve original relative order among the survivors
  return stations.filter((s) => keepKeys.has(s.gtfsStopId ?? s.name));
}

interface TextMatch {
  station: PhysicalStation;
  score: number;
}

/**
 * Find stations mentioned anywhere in a longer piece of free text (e.g. a
 * full chat message), ranked by specificity - a longer, more complete
 * station name mention always outranks a shorter one it contains (e.g.
 * "Dwarka Sector 21" beats plain "Dwarka" when both appear as substrings
 * of the message).
 */
export function matchStationsInText(text: string, limit = 6): PhysicalStation[] {
  const q = normalize(text);
  if (!q || q.length < 4 || STOPWORDS.has(q) || GENERIC_WORDS.has(q)) return [];

  const candidates: TextMatch[] = [];
  for (const s of physicalStations) {
    const name = normalize(s.name);
    if (!name || name.length < 4) continue;
    if (q === name) {
      candidates.push({ station: s, score: 0 });
    } else if (q.includes(name)) {
      // longer/more-specific names (closer to fully consuming the query)
      // score better; this also naturally prefers multi-word station
      // names over single words they contain.
      candidates.push({ station: s, score: 1 - name.length / (q.length + 1) });
    }
  }

  candidates.sort((a, b) => a.score - b.score);
  const seen = new Set<string>();
  const ranked: PhysicalStation[] = [];
  for (const c of candidates) {
    const key = c.station.gtfsStopId ?? c.station.name;
    if (seen.has(key)) continue;
    seen.add(key);
    ranked.push(c.station);
    if (ranked.length >= limit * 2) break; // gather a bit extra before subsumption-filtering
  }
  return suppressSubsumedStations(ranked).slice(0, limit);
}


export function bestStationMatch(query: string): PhysicalStation | undefined {
  return searchStations(query, 1)[0];
}

export interface AutocompleteResult {
  /** how many trailing words of the input were used to produce these suggestions */
  matchedWordCount: number;
  suggestions: PhysicalStation[];
}

/**
 * Live-typing autocomplete: as the user types, suggest stations matching
 * the word(s) they're currently on. Unlike searchStations() (used for
 * parsing a finished message, where false positives can silently produce
 * a wrong answer), this is shown as a tappable list the user actively
 * picks from - so simple, liberal prefix matching is the right tradeoff
 * here, not the conservative NLU matcher.
 */
export function autocompleteFromInput(text: string, limit = 6): AutocompleteResult {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { matchedWordCount: 0, suggestions: [] };

  for (let take = Math.min(3, words.length); take >= 1; take--) {
    const prefix = normalize(words.slice(words.length - take).join(" "));
    if (prefix.length < 2) continue;

    const seen = new Set<string>();
    const startsWith: PhysicalStation[] = [];
    const contains: PhysicalStation[] = [];
    for (const s of physicalStations) {
      const key = s.gtfsStopId ?? s.name;
      if (seen.has(key)) continue;
      const name = normalize(s.name);
      if (name.startsWith(prefix) || name.split(" ").some((w) => w.startsWith(prefix))) {
        seen.add(key);
        startsWith.push(s);
      } else if (prefix.length >= 3 && name.includes(prefix)) {
        seen.add(key);
        contains.push(s);
      }
    }
    const suggestions = [...startsWith, ...contains].slice(0, limit);
    if (suggestions.length > 0) return { matchedWordCount: take, suggestions };
  }
  return { matchedWordCount: 0, suggestions: [] };
}
