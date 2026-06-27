import { Router, Request, Response } from "express";
import { isDBConnected } from "../config/db";
import { ChatSession, Message } from "../models/Chat";
import { Feedback, SearchLog } from "../models/Support";
import { getChatReply } from "../lib/chatEngine";
import { searchStations, bestStationMatch } from "../lib/stationSearch";
import { planJourney } from "../lib/journeyPlanner";
import { getSchedule, dayTypeFor } from "../lib/schedule";
import { physicalStations, getGatesForStation } from "../lib/data";

const router = Router();

router.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true, db: isDBConnected() ? "connected" : "not_connected" });
});

// --- Chat ------------------------------------------------------------------
// POST /api/chat { message: string, deviceId: string, sessionId?: string, pending?: PendingClarification }
// `pending` should be echoed back exactly as received in the previous
// response's `pending` field - it lets a bare follow-up answer (e.g. just
// a station name) resolve against the bot's own last clarifying question
// instead of being parsed as an unrelated new message. Omit it (or pass
// undefined) to start a fresh, context-free question.
router.post("/chat", async (req: Request, res: Response) => {
  const { message, deviceId, sessionId, pending } = req.body ?? {};
  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "message is required" });
  }
  if (typeof deviceId !== "string" || !deviceId) {
    return res.status(400).json({ error: "deviceId is required" });
  }

  const reply = getChatReply(message.trim(), pending);

  let persistedSessionId: string | undefined = sessionId;
  if (isDBConnected()) {
    try {
      let session = sessionId ? await ChatSession.findById(sessionId) : null;
      if (!session) {
        session = await ChatSession.create({ deviceId, lastMessageAt: new Date() });
      }
      persistedSessionId = String(session._id);

      await Message.create({ sessionId: session._id, role: "user", text: message.trim() });
      await Message.create({
        sessionId: session._id,
        role: "bot",
        text: reply.text,
        cardType: reply.card?.type,
      });
      session.lastMessageAt = new Date();
      session.messageCount += 2;
      await session.save();

      await SearchLog.create({
        query: message.trim(),
        intent: reply.card?.type ?? "unknown",
        resolvedStationCodes: [],
        hadResult: !!reply.card,
      });
    } catch (e) {
      console.error("[chat] persistence error (continuing without it):", (e as Error).message);
    }
  }

  res.json({ ...reply, sessionId: persistedSessionId });
});

// --- Journey planning --------------------------------------------------
// GET /api/journey?from=Rajiv+Chowk&to=Kashmere+Gate
router.get("/journey", (req: Request, res: Response) => {
  const { from, to } = req.query;
  if (typeof from !== "string" || typeof to !== "string") {
    return res.status(400).json({ error: "from and to query params are required" });
  }
  const origin = bestStationMatch(from);
  const destination = bestStationMatch(to);
  if (!origin || !destination) {
    return res.status(404).json({ error: "Could not match one or both station names", origin, destination });
  }
  const result = planJourney(origin, destination);
  res.json({ origin: origin.name, destination: destination.name, ...result });
});

// --- Station lookup ------------------------------------------------------
// GET /api/station/search?q=rajiv
router.get("/station/search", (req: Request, res: Response) => {
  const q = req.query.q;
  if (typeof q !== "string" || !q.trim()) return res.json([]);
  res.json(searchStations(q, 8));
});

// GET /api/station/:gtfsStopId
router.get("/station/:gtfsStopId", (req: Request, res: Response) => {
  const station = physicalStations.find((s) => s.gtfsStopId === req.params.gtfsStopId);
  if (!station) return res.status(404).json({ error: "Station not found" });
  res.json({ ...station, gates: getGatesForStation(station) });
});

// --- Schedule ------------------------------------------------------------
// GET /api/schedule/:gtfsStopId?dayType=weekday|saturday|sunday
router.get("/schedule/:gtfsStopId", (req: Request, res: Response) => {
  const station = physicalStations.find((s) => s.gtfsStopId === req.params.gtfsStopId);
  if (!station) return res.status(404).json({ error: "Station not found" });
  const dayType = (req.query.dayType as any) ?? dayTypeFor();
  res.json(getSchedule(station, dayType));
});

// --- Feedback --------------------------------------------------------------
// POST /api/feedback { sessionId?, messageId?, rating: "up"|"down", comment? }
router.post("/feedback", async (req: Request, res: Response) => {
  const { sessionId, messageId, rating, comment } = req.body ?? {};
  if (rating !== "up" && rating !== "down") {
    return res.status(400).json({ error: "rating must be 'up' or 'down'" });
  }
  if (!isDBConnected()) {
    return res.status(503).json({ error: "Feedback storage is not connected (no MONGO_URI configured)." });
  }
  const doc = await Feedback.create({ sessionId, messageId, rating, comment });
  res.status(201).json({ ok: true, id: doc._id });
});

export default router;
