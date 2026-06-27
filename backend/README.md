# DMRC Assistant — Backend

Express + TypeScript + Mongoose API. Mirrors the same journey-planning,
schedule, and chat logic used in the mobile app, with optional MongoDB
Atlas persistence for chat history, feedback, and analytics.

## Local development

```bash
cp .env.example .env     # fill in MONGO_URI (after rotating your password - see top-level README)
npm install
npm run seed              # one-time: load station/gate data into Atlas
npm run dev
```

The server runs fine **without** `MONGO_URI` set too — chat answers still
work (the planner is in-memory), you just won't get persisted history,
feedback storage, or analytics until a database is connected.

## Deploying (example: Render)

1. Push this `backend/` folder to a GitHub repo (or connect Render
   directly if it supports monorepos — set the root directory to
   `backend`).
2. Render → New → Web Service → connect the repo.
3. Build command: `npm install && npm run build`
4. Start command: `npm start`
5. Add environment variables from `.env.example` in Render's dashboard
   (never commit the real `.env`).
6. In MongoDB Atlas → Network Access, allow Render's outbound IPs (or
   `0.0.0.0/0` for quick testing, then tighten it).
7. Once deployed, update the mobile app's API base URL to point at your
   Render URL.

Any other Node host (Railway, Fly.io, a plain VM) works the same way —
`npm run build && npm start`, with `MONGO_URI` set in the environment.

## Endpoints

| Method | Path                         | Purpose                          |
|--------|------------------------------|-----------------------------------|
| GET    | `/api/health`                 | DB connection status              |
| POST   | `/api/chat`                   | `{message, deviceId, sessionId?, pending?}` → chat reply, persists if DB connected. Echo back the previous response's `pending` field to continue a clarifying question (e.g. bot asked "which station?" and the user just replies with a name). |
| GET    | `/api/journey?from=&to=`      | Journey plan between two stations |
| GET    | `/api/station/search?q=`      | Fuzzy station search              |
| GET    | `/api/station/:gtfsStopId`    | Station details + gates           |
| GET    | `/api/schedule/:gtfsStopId`   | First/last train timings          |
| POST   | `/api/feedback`               | `{sessionId?, messageId?, rating, comment?}` (requires DB) |

## Security baseline (not a substitute for an audit)

- `helmet` for standard HTTP security headers
- Rate limiting: 60 requests/minute/IP on `/api/*`
- Request body size capped at 100kb
- Basic NoSQL-injection key stripping (`$`, `.` keys removed from input)
- CORS restricted to `CORS_ORIGINS` from env
- Errors logged to MongoDB (`ErrorLog`) when connected, never leaked to
  the client beyond a generic message

For production, also add: real authentication if you need per-user
history beyond device ID, request logging retention/rotation policy, and
a dependency vulnerability scan in CI.
