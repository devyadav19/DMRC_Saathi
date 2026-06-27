import { Schema, model, Document } from "mongoose";

export interface IUser extends Document {
  deviceId: string; // anonymous device/install identifier, always present
  email?: string;
  passwordHash?: string; // set only if real auth is added later
  displayName?: string;
  preferredLanguage: "EN" | "HI";
  createdAt: Date;
  lastSeenAt: Date;
}

const UserSchema = new Schema<IUser>({
  deviceId: { type: String, required: true, unique: true, index: true },
  email: { type: String, lowercase: true, trim: true, sparse: true, unique: true },
  passwordHash: { type: String, select: false },
  displayName: { type: String, trim: true, maxlength: 80 },
  preferredLanguage: { type: String, enum: ["EN", "HI"], default: "EN" },
  createdAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now },
});

export default model<IUser>("User", UserSchema);
