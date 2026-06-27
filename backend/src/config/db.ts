import mongoose from "mongoose";

let connected = false;

export async function connectDB(): Promise<void> {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.warn(
      "[db] MONGO_URI is not set - running WITHOUT persistence. " +
        "Chat will still work (the planner is fully in-memory), but " +
        "conversation history, feedback, and analytics will not be saved. " +
        "Set MONGO_URI in your .env to enable MongoDB Atlas."
    );
    return;
  }
  try {
    await mongoose.connect(uri, {
      // Mongoose 8 infers most options automatically; kept explicit for clarity.
      serverSelectionTimeoutMS: 8000,
    });
    connected = true;
    console.log("[db] Connected to MongoDB Atlas");
  } catch (err) {
    console.error("[db] Failed to connect to MongoDB Atlas:", (err as Error).message);
    console.error(
      "[db] Continuing without persistence. Check that MONGO_URI is correct, " +
        "the database user has the right permissions, and your IP is allow-listed " +
        "in Atlas Network Access."
    );
  }
}

export function isDBConnected(): boolean {
  return connected && mongoose.connection.readyState === 1;
}

mongoose.connection.on("disconnected", () => {
  connected = false;
});
