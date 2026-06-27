import "dotenv/config";
import mongoose, { Schema, model } from "mongoose";
import stations from "../data/stations.json";
import gates from "../data/gates.json";
import lines from "../data/lines.json";

// Read-model collections for admin/analytics queries (e.g. "list all
// interchange stations", "gates near X"). The live chat engine does NOT
// read from these - it uses the bundled JSON directly for speed and zero
// network dependency. This seed is what populates MongoDB Atlas so the
// same data is queryable from an admin dashboard or other services.

const StationSchema = new Schema(
  {
    code: String,
    name: String,
    commercialName: String,
    line: Schema.Types.Mixed,
    type: String,
    isInterchange: Boolean,
    lat: Number,
    lon: Number,
    gtfsStopId: String,
    gtfsName: String,
  },
  { collection: "stations" }
);

const GateSchema = new Schema(
  {
    station_code: String,
    gate_name: String,
    location: String,
    lat: Number,
    lon: Number,
  },
  { collection: "gates" }
);

const LineSchema = new Schema(
  { color: String, route_ids: [String] },
  { collection: "lines" }
);

const StationModel = model("StationSeed", StationSchema);
const GateModel = model("GateSeed", GateSchema);
const LineModel = model("LineSeed", LineSchema);

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("MONGO_URI is not set. Copy .env.example to .env and fill it in first.");
    process.exit(1);
  }

  console.log("Connecting to MongoDB Atlas...");
  await mongoose.connect(uri);

  console.log(`Seeding ${stations.length} stations...`);
  await StationModel.deleteMany({});
  await StationModel.insertMany(stations);

  console.log(`Seeding ${gates.length} gates...`);
  await GateModel.deleteMany({});
  await GateModel.insertMany(gates);

  console.log(`Seeding ${Object.keys(lines).length} lines...`);
  await LineModel.deleteMany({});
  await LineModel.insertMany(Object.values(lines));

  console.log("Done. Indexes will build in the background.");
  await StationModel.collection.createIndex({ code: 1 }, { unique: false });
  await StationModel.collection.createIndex({ gtfsStopId: 1 });
  await GateModel.collection.createIndex({ station_code: 1 });

  await mongoose.disconnect();
  console.log("Seed complete.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
