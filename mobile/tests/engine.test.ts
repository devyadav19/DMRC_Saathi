/**
 * Lightweight regression test for the rule-based chat engine. This is
 * plain Node/TypeScript (no React Native dependency) so it can run
 * standalone to catch logic regressions before they hit the app.
 *
 * Run from the mobile/ directory:
 *   npm install --no-save typescript ts-node
 *   npx ts-node --project tests/tsconfig.json tests/engine.test.ts
 */
import { getChatReply } from "../src/lib/chatEngine";
import { searchStations } from "../src/lib/stationSearch";

let failures = 0;
function assert(cond: boolean, message: string) {
  if (!cond) {
    failures++;
    console.error("FAIL:", message);
  } else {
    console.log("OK:  ", message);
  }
}

// Journey planning - known real DMRC interchanges
let r = getChatReply("Rajiv chowk se kashmere gate jana hai");
assert(r.card?.type === "journey", "Hinglish journey query produces a journey card");
assert(r.text.includes("Rajiv Chowk") && r.text.includes("Kashmere Gate"), "journey reply names both stations");

r = getChatReply("Dilshad Garden to Vaishali");
assert((r.card?.data?.primary?.interchanges?.length ?? 0) >= 1, "Dilshad Garden -> Vaishali requires at least one interchange");

// Station disambiguation - must not collapse "Dwarka Sector 21" into "Dwarka"
r = getChatReply("Last metro tonight from Dwarka Sector 21");
assert(r.text.startsWith("Dwarka Sector"), "specific station name ('Dwarka Sector - 21') is not collapsed to 'Dwarka'");

// Interchange correctness
r = getChatReply("is rajiv chwok an interchange");
assert(r.text.includes("YELLOW") && r.text.includes("BLUE"), "Rajiv Chowk correctly reports YELLOW + BLUE lines (not raw xlsx line numbers)");

// Static FAQ intents
r = getChatReply("women coach kahan hai");
assert(r.text.toLowerCase().includes("women"), "women's coach FAQ answered");

// Graceful fallback
r = getChatReply("asdkjaslkdjalksd");
assert(r.text.includes("not sure"), "nonsense input gets a graceful fallback, not a crash");

// Station search sanity
assert(searchStations("rajiv chwk", 1)[0]?.name === "Rajiv Chowk", "typo 'rajiv chwk' resolves to Rajiv Chowk");
assert(searchStations("kashmiri gate", 1)[0]?.name === "Kashmere Gate", "common misspelling 'kashmiri gate' resolves correctly");

// Regression: common English filler words must never match a station by
// coincidence (e.g. "and" is literally a substring of "Moolchand").
r = getChatReply("First and last train");
assert(r.text.toLowerCase().includes("which station"), "'First and last train' with no station named asks for clarification, doesn't guess 'Moolchand'");

r = getChatReply("last train");
assert(r.text.toLowerCase().includes("which station"), "'last train' alone asks for clarification, doesn't guess a random station");

// Regression: plural forms of intent keywords must be recognized (was
// missing \b boundaries, so "Gates" fell through to risky entity guessing
// and got misread as a journey query ending at "Delhi Gate").
r = getChatReply("Gates at Hauz Khas");
assert(r.card?.type === "gates", "'Gates at Hauz Khas' (plural) is recognized as a gates query, not misread as a journey");
assert(!r.text.includes("Delhi Gate"), "'Gates at Hauz Khas' does not spuriously mention Delhi Gate");

// Regression: conversation memory. The bot asks a clarifying question,
// then a bare one-word follow-up answer must resolve against THAT
// question, not be re-analyzed as an unrelated new message.
r = getChatReply("First and last train");
assert(r.pending?.intent === "first_last_train", "asking for first/last train without a station sets pending clarification");
{
  const r2 = getChatReply("IFFCO Chowk", r.pending);
  assert(r2.card?.type === "next_train", "bare follow-up 'IFFCO Chowk' resolves against the pending first/last-train question");
  assert(r2.text.startsWith("IFFCO Chowk"), "schedule reply is for IFFCO Chowk, not a fabricated journey to another station");
}

// Regression: a generic word shared by many station names ("Chowk" is in
// 9+ stations) must never spuriously co-match alongside the real answer.
{
  const r1 = getChatReply("First and last train");
  const r2 = getChatReply("IFFCO Chowk", r1.pending);
  assert(!r2.text.includes("Bata Chowk"), "'IFFCO Chowk' alone does not spuriously pull in 'Bata Chowk' via the generic word 'Chowk'");
}

// Regression: two-slot fare continuation across multiple turns ("what's
// the fare" -> "Rajiv Chowk" -> "Dwarka Sector 21") must end up computing
// the fare for Rajiv Chowk -> Dwarka Sector 21, not misreading the final
// reply as its own self-contained (and wrong) journey.
{
  const r1 = getChatReply("what's the fare");
  const r2 = getChatReply("Rajiv Chowk", r1.pending);
  assert(r2.pending?.knownOrigin?.name === "Rajiv Chowk", "fare flow remembers Rajiv Chowk as the origin while awaiting destination");
  const r3 = getChatReply("Dwarka Sector 21", r2.pending);
  assert(r3.card?.type === "fare", "third turn produces a fare card");
  assert(r3.text.includes("Rajiv Chowk") && r3.text.includes("Dwarka Sector - 21"), "fare is computed for the correct origin and destination across turns");
}

// Regression: a station name that's a strict substring of a DIFFERENT
// station's name ("Dwarka" inside "Dwarka Sector - 21") must not cause a
// single-station message to be misread as a two-station journey.
r = getChatReply("Dwarka Sector 21");
assert(r.card?.type !== "journey", "'Dwarka Sector 21' alone is not misread as a journey to plain 'Dwarka'");

// Line status intent test
r = getChatReply("show line status");
assert(r.card?.type === "line_status", "line status query produces a line_status card");
assert(r.text.includes("status board") || r.text.includes("स्थिति बोर्ड"), "line status reply describes the status board");


console.log(`\n${failures === 0 ? "All tests passed." : `${failures} test(s) FAILED.`}`);
process.exit(failures === 0 ? 0 : 1);
