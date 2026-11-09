import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv, openDatabase, schemaSql } from "./db.js";
import { applyPins, loadOrCreatePins } from "./pins.js";
import { seed } from "./seed.js";
import type { Member } from "./types.js";

/** npm run db:setup: creates the tables and loads dishes + members. Safe to re-run. */
loadEnv();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const members: Member[] = JSON.parse(readFileSync(path.join(root, "data", "members.json"), "utf8"));
const pins = loadOrCreatePins(root, members);
const resetPins = process.argv.includes("--reset-pins");
const { db, kind } = openDatabase();
await db.exec(schemaSql());
await db.transaction(async (q) => {
  await seed(q, members);
  await applyPins(q, members, pins, resetPins);
});
console.log(`Database ready (${kind}). Loaded ${members.length} members and the dish list.`);
if (resetPins) console.log("PINs reset. Every phone has to enter its PIN again.");
await db.close();
