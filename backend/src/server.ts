import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { connectDB } from "./config/db";
import apiRouter from "./routes/api";
import { chatRateLimiter, sanitizeInput, errorHandler } from "./middleware";

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

app.use(helmet());
app.use(
  cors({
    origin: (process.env.CORS_ORIGINS ?? "").split(",").filter(Boolean),
    credentials: false,
  })
);
app.use(express.json({ limit: "100kb" })); // chat messages are short; cap body size defensively
app.use(sanitizeInput);
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

app.use("/api", chatRateLimiter, apiRouter);

app.get("/", (_req, res) => {
  res.json({ name: "DMRC Assistant API", status: "ok" });
});

app.use((_req, res) => res.status(404).json({ error: "Not found" }));
app.use(errorHandler);

async function start() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`[server] DMRC Assistant API listening on port ${PORT}`);
  });
}

start();
