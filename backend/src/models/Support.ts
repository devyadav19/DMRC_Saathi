import { Schema, model, Document, Types } from "mongoose";

// --- Feedback ------------------------------------------------------------
export interface IFeedback extends Document {
  sessionId?: Types.ObjectId;
  messageId?: Types.ObjectId;
  rating: "up" | "down";
  comment?: string;
  createdAt: Date;
}
const FeedbackSchema = new Schema<IFeedback>({
  sessionId: { type: Schema.Types.ObjectId, ref: "ChatSession" },
  messageId: { type: Schema.Types.ObjectId, ref: "Message" },
  rating: { type: String, enum: ["up", "down"], required: true },
  comment: { type: String, maxlength: 1000 },
  createdAt: { type: Date, default: Date.now, index: true },
});

// --- SearchLog (every resolved query, for analytics/quality monitoring) --
export interface ISearchLog extends Document {
  query: string;
  intent: string;
  resolvedStationCodes: string[];
  hadResult: boolean;
  createdAt: Date;
}
const SearchLogSchema = new Schema<ISearchLog>({
  query: { type: String, required: true, maxlength: 500 },
  intent: { type: String, index: true },
  resolvedStationCodes: [{ type: String }],
  hadResult: { type: Boolean, default: false, index: true },
  createdAt: { type: Date, default: Date.now, index: true },
});

// --- ErrorLog --------------------------------------------------------------
export interface IErrorLog extends Document {
  route: string;
  message: string;
  stack?: string;
  meta?: Record<string, unknown>;
  createdAt: Date;
}
const ErrorLogSchema = new Schema<IErrorLog>({
  route: { type: String, required: true, index: true },
  message: { type: String, required: true },
  stack: { type: String },
  meta: { type: Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now, index: true },
});

// --- AppSetting (key/value config, e.g. feature flags, banner messages) ---
export interface IAppSetting extends Document {
  key: string;
  value: unknown;
  updatedAt: Date;
}
const AppSettingSchema = new Schema<IAppSetting>({
  key: { type: String, required: true, unique: true, index: true },
  value: { type: Schema.Types.Mixed },
  updatedAt: { type: Date, default: Date.now },
});

// --- KnowledgeDocument (admin-uploaded FAQ/policy docs for future RAG) ----
export interface IKnowledgeDocument extends Document {
  title: string;
  content: string;
  sourceType: "upload" | "official" | "manual";
  tags: string[];
  version: number;
  createdAt: Date;
}
const KnowledgeDocumentSchema = new Schema<IKnowledgeDocument>({
  title: { type: String, required: true, maxlength: 300 },
  content: { type: String, required: true },
  sourceType: { type: String, enum: ["upload", "official", "manual"], default: "manual" },
  tags: [{ type: String, index: true }],
  version: { type: Number, default: 1 },
  createdAt: { type: Date, default: Date.now },
});
KnowledgeDocumentSchema.index({ title: "text", content: "text" }); // basic keyword search

export const Feedback = model<IFeedback>("Feedback", FeedbackSchema);
export const SearchLog = model<ISearchLog>("SearchLog", SearchLogSchema);
export const ErrorLog = model<IErrorLog>("ErrorLog", ErrorLogSchema);
export const AppSetting = model<IAppSetting>("AppSetting", AppSettingSchema);
export const KnowledgeDocument = model<IKnowledgeDocument>("KnowledgeDocument", KnowledgeDocumentSchema);
