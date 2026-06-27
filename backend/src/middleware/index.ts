import rateLimit from "express-rate-limit";
import { Request, Response, NextFunction } from "express";
import { ErrorLog } from "../models/Support";
import { isDBConnected } from "../config/db";

// 60 requests/minute per IP is generous for a chat UI but blocks abuse/bots.
export const chatRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests - please slow down and try again shortly." },
});

// Basic defense-in-depth: strip anything that looks like a NoSQL operator
// injection ($where, $gt, etc.) from request bodies/queries.
export function sanitizeInput(req: Request, _res: Response, next: NextFunction) {
  const strip = (obj: any) => {
    if (obj && typeof obj === "object") {
      for (const key of Object.keys(obj)) {
        if (key.startsWith("$") || key.includes(".")) {
          delete obj[key];
        } else if (typeof obj[key] === "object") {
          strip(obj[key]);
        }
      }
    }
  };
  strip(req.body);
  strip(req.query);
  next();
}

export async function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  console.error(`[error] ${req.method} ${req.path}:`, err);
  if (isDBConnected()) {
    try {
      await ErrorLog.create({
        route: `${req.method} ${req.path}`,
        message: err?.message ?? String(err),
        stack: err?.stack,
      });
    } catch {
      // never let logging failure crash the error handler itself
    }
  }
  res.status(err?.status ?? 500).json({
    error: "Something went wrong on our end. Please try again.",
  });
}
