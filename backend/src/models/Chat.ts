import { Schema, model, Document, Types } from "mongoose";

export interface IChatSession extends Document {
  userId?: Types.ObjectId;
  deviceId: string;
  startedAt: Date;
  lastMessageAt: Date;
  language: "EN" | "HI";
  messageCount: number;
}

const ChatSessionSchema = new Schema<IChatSession>({
  userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
  deviceId: { type: String, required: true, index: true },
  startedAt: { type: Date, default: Date.now },
  lastMessageAt: { type: Date, default: Date.now, index: true },
  language: { type: String, enum: ["EN", "HI"], default: "EN" },
  messageCount: { type: Number, default: 0 },
});
ChatSessionSchema.index({ deviceId: 1, lastMessageAt: -1 });

export interface IMessage extends Document {
  sessionId: Types.ObjectId;
  role: "user" | "bot";
  text: string;
  intent?: string;
  cardType?: string;
  createdAt: Date;
}

const MessageSchema = new Schema<IMessage>({
  sessionId: { type: Schema.Types.ObjectId, ref: "ChatSession", required: true, index: true },
  role: { type: String, enum: ["user", "bot"], required: true },
  text: { type: String, required: true, maxlength: 2000 },
  intent: { type: String, index: true },
  cardType: { type: String },
  createdAt: { type: Date, default: Date.now, index: true },
});
MessageSchema.index({ sessionId: 1, createdAt: 1 }); // efficient pagination within a session

export const ChatSession = model<IChatSession>("ChatSession", ChatSessionSchema);
export const Message = model<IMessage>("Message", MessageSchema);
