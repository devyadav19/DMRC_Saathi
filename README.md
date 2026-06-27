# DMRC Assistant — what this is, honestly

This is a working first milestone toward the full chatbot described in the
brief, built from your two real data files (the GTFS static feed and the
station/gate location spreadsheet) rather than placeholder content. It is
**not** the complete production system (live MongoDB Atlas deployment, RAG
over a vector store, cloud speech recognition, admin dashboards) — those
need infrastructure and API keys only you can provision. Here's exactly
what's real, what's stubbed, and what to do next.

## What's real and working today

- **`/mobile`** — a complete Expo (React Native + TypeScript) chat app.
  Runs immediately in Expo Go / Snack with **no backend required**: it
  bundles a cleaned, verified dataset built from your files and answers
  from it directly.
  - Journey planning via a real shortest-path engine over the actual
    DMRC network graph (built from `stop_times.txt`), with interchange
    detection and an Airport Express fare-aware alternate route.
  - First/last train times, computed from real scheduled trips.
  - Station gates/exits, from your gate spreadsheet.
  - Fare *estimates* from DMRC's standard public distance-fare slabs
    (clearly labeled as estimates — see "What's approximate" below).
  - Rule-based language understanding for English, Hindi (Devanagari),
    and Hinglish covering journey planning, fares, schedules, gates,
    interchanges, smart cards, lost & found, accessibility, and more.
  - Light/dark mode, quick-reply chips, typing indicator, read-aloud
    (text-to-speech via `expo-speech`), copy/share message actions.
- **`/backend`** — a complete Express + TypeScript + Mongoose API that
  mirrors the same logic, ready to connect to MongoDB Atlas via
  `MONGO_URI` and deploy (Render/Railway/Fly/EC2/etc.). Verified to boot
  and serve correct answers, including gracefully running with reduced
  functionality if no database is connected yet.

## What's approximate or stubbed — and why

- **Fares are estimates.** Neither the GTFS feed nor the spreadsheet you
  uploaded includes a fare table (DMRC doesn't publish one in GTFS). The
  app estimates distance from travel time and applies DMRC's standard
  public fare slabs, and says so in every fare answer. Treat the number
  at the AFC gate / DMRC app as authoritative.
- **Voice input (speech-to-text) is not connected.** True STT needs
  either a custom Expo dev build or a cloud transcription API key,
  neither of which exists in this environment. The mic button says so
  honestly rather than faking it. Text-to-speech ("read aloud" on bot
  replies) **does** work out of the box.
- **No live LLM / RAG.** The chat is rule-based, not an LLM — it's fast,
  free, fully offline, and accurate for everything it covers, but it
  won't handle truly open-ended conversation gracefully. There's a
  documented upgrade seam at `backend/src/services/llm.ts` that calls
  the Anthropic API to *rephrase* (never invent) the rule-based answer,
  if you add `ANTHROPIC_API_KEY`.
- **MongoDB Atlas is wired up, not deployed.** I cannot reach your
  cluster from this sandbox (no general internet egress here) or host a
  public server, so I couldn't test the live connection or deploy
  anything. The connection code reads `MONGO_URI` from the environment
  only — see "Before you do anything else" below.
- **A handful of very new stations** (e.g. Yashobhoomi Dwarka Sector 25,
  Krishna Park Extension) aren't in this GTFS snapshot yet, so the app
  can't compute timings for them — it says so rather than guessing.

## Before you do anything else: rotate your database password

You pasted a live MongoDB connection string (with username and password)
directly into chat earlier. Treat that password as compromised:
**Atlas → Database Access → Edit your user → Edit Password**, then put
the new connection string only in a local `.env` file (already
git-ignored by convention — see `backend/.env.example`).

## Project layout

```
dmrc-chatbot/
├── shared-data/        cleaned, verified datasets (source of truth)
├── mobile/              Expo app — works standalone, no backend needed
│   ├── App.tsx
│   ├── src/
│   │   ├── lib/         journey planner, NLU, chat engine, station search
│   │   ├── components/  chat UI
│   │   ├── theme/       design tokens, line colors
│   │   └── data/        bundled JSON (copy of shared-data)
│   └── tests/           regression test for the chat engine
└── backend/              Express + Mongoose API, mirrors mobile's logic
    ├── src/
    │   ├── lib/          same engine, reused as-is
    │   ├── models/       Mongoose schemas (users, sessions, feedback, etc.)
    │   ├── routes/        REST endpoints
    │   ├── scripts/seed.ts  loads station/gate data into MongoDB Atlas
    │   └── services/llm.ts  optional LLM upgrade seam
    └── .env.example
```

## How the data was built (so you can trust it)

Your spreadsheet (268 station rows, 626 gates) and GTFS feed (262 stops,
5,439 trips, ~128k stop-time records) use different station-naming
conventions and occasionally have data-entry errors (a few duplicated/
wrong coordinates). I cross-validated every join using three methods in
priority order — exact name match, coordinate proximity with a name-
similarity safety check, then high-confidence fuzzy matching — and
manually verified every remaining case against real DMRC topology before
accepting it. 266 of 268 station rows resolved to real GTFS schedule
data; the other 2 are newer stations not yet in this feed. Every
interchange and route result above was checked against known real DMRC
network facts during development.

## Changelog

**Second round of fixes, from real conversation testing:**

- **Fixed: no conversation memory.** The bot would ask "Which station?" and
  then treat your one-word reply as a brand-new, unrelated message — so
  replying "IFFCO Chowk" to its own question produced a fabricated journey
  instead of an answer. `getChatReply()` now accepts and returns a
  `pending` clarification object; a bare follow-up answer resolves against
  the bot's own last question (including remembering a partially-given
  origin across a multi-turn fare/journey exchange) instead of being
  re-parsed from scratch. Wired through in both the mobile app
  (`App.tsx`, via a ref to avoid stale-closure bugs) and the backend
  (`POST /api/chat` now accepts/returns `pending`, same stateless pattern
  as `sessionId`).
- **Fixed: generic words spuriously co-matching a second station.**
  "Chowk" alone matches 9 different real stations (Rajiv Chowk, Bata
  Chowk, IFFCO Chowk, ...). Replying "IFFCO Chowk" was finding "IFFCO
  Chowk" *and* spuriously "Bata Chowk" via the word "Chowk" in isolation,
  turning a single-station answer into a fake 2-station journey. Added a
  generic-word detector computed directly from the station data (any word
  appearing in 3+ different station names is excluded from standalone
  matching) rather than a manually maintained list — `GENERIC_WORDS` in
  `mobile/src/lib/stationSearch.ts`.
- **Fixed: a station name that's a substring of another's.** "Dwarka" is
  literally contained inside "Dwarka Sector - 21" — both are real,
  different stations. A message containing just "Dwarka Sector 21" was
  matching both and getting misread as a journey between them. Added
  `suppressSubsumedStations()`, applied both to the exact-text matcher and
  as a final pass over the fuzzy n-gram fallback, plus word-position
  tracking so the fuzzy fallback can't re-interpret an already-claimed
  fragment of text (e.g. "Dwarka Sector" left over after "Dwarka Sector
  21" is already matched) as a different station.
- **Fixed: quick-reply/suggestion chips rendering as tall, mostly-empty,
  sometimes-clipped boxes.** Root cause: the chip row never set
  `alignItems`, so it fell back to React Native's default `stretch` —
  combined with the row's height being driven by leftover flex space
  rather than content, every chip stretched to fill whatever space was
  left. Switched to an explicit fixed `height` on the row (not `maxHeight`,
  which could still get squeezed under layout pressure) and
  `alignItems: "center"` so chips size to their own content.
- Added regression tests for all of the above in `mobile/tests/engine.test.ts`.

**First round of fixes** (icons rendering as boxes on Android, header
double-padding the status bar, plural-word regex gaps, "and" matching
"Moolchand") are documented further down in git history / prior delivery —
the project README below reflects the current state only.

## Quick start


**Mobile app (works immediately, no setup beyond Expo):**
```bash
cd mobile
npm install
npx expo start
```
Scan the QR code with Expo Go, or press `w` for a web preview.

**Backend (optional — only needed for persistence/analytics):**
```bash
cd backend
cp .env.example .env   # fill in your NEW MongoDB URI (after rotating the password)
npm install
npm run seed            # loads station/gate data into your Atlas cluster
npm run dev              # starts the API on http://localhost:4000
```

## Recommended next steps, roughly in priority order

1. Rotate the Mongo password (above) and confirm the backend connects
   from your own machine (I couldn't test this from here).
2. Deploy the backend somewhere reachable (Render/Railway are simplest)
   and point the mobile app at it if you want persisted chat history.
3. Decide on voice: either a custom Expo dev build with native STT, or a
   cloud STT key wired through the backend (keeps the key off the
   client).
4. Decide on the LLM upgrade: add `ANTHROPIC_API_KEY` to unlock more
   natural phrasing via `backend/src/services/llm.ts`.
5. Real RAG/vector search only makes sense once you have unstructured
   knowledge to retrieve over (policy PDFs, FAQs beyond what's
   structured here) — happy to build that once you have source
   documents.
6. Admin dashboard, full accessibility audit, and load-tested security
   hardening (the current rate limiting/sanitization is a reasonable
   baseline, not a security audit).
