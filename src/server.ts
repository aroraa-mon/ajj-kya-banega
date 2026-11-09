import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv, openDatabase, schemaSql } from "./db.js";
import { applyPins, loadOrCreatePins } from "./pins.js";
import { Planner, PlannerError } from "./service.js";
import { seed } from "./seed.js";
import { readFileSync } from "node:fs";
import type { Member } from "./types.js";

loadEnv();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const app = express();
app.use(express.json());
// Local/Docker only. On Vercel, files in public/ are served from the CDN.
if (!process.env.VERCEL) {
  app.use(express.static(path.join(root, "public")));
}

let plannerReady: Promise<Planner> | undefined;

/** Connect (and seed local DB) on first request so the module can load on Vercel without env at import time. */
function getPlanner(): Promise<Planner> {
  if (!plannerReady) {
    plannerReady = (async () => {
      const { db, kind } = openDatabase();
      if (kind === "pglite") {
        const members: Member[] = JSON.parse(readFileSync(path.join(root, "data", "members.json"), "utf8"));
        await db.exec(schemaSql());
        const { rows } = await db.query<{ n: number }>("select count(*)::int as n from dishes");
        const pins = loadOrCreatePins(root, members);
        await db.transaction(async (q) => {
          if (rows[0].n === 0) await seed(q, members);
          await applyPins(q, members, pins, false);
        });
        console.log("Using the local database in data/pgdata (set DATABASE_URL to use Supabase).");
      } else {
        try {
          await db.query("select 1 from dishes limit 1");
        } catch {
          throw new Error("Database tables not found. Run `npm run db:setup` once, then start again.");
        }
        console.log("Connected to Postgres (Supabase).");
      }
      return new Planner(db);
    })();
  }
  return plannerReady;
}

const wrap =
  (fn: (planner: Planner, req: express.Request) => Promise<unknown>): express.RequestHandler =>
  async (req, res) => {
    try {
      const planner = await getPlanner();
      res.json(await fn(planner, req));
    } catch (e) {
      const status = e instanceof PlannerError ? e.status : 500;
      if (status === 500) console.error(e);
      const message =
        e instanceof PlannerError ? e.message : /Voting closed/.test(String((e as Error)?.message)) ? "Voting has closed for this breakfast" : "Something went wrong";
      res.status(/Voting closed/.test(message) ? 409 : status).json({ error: message });
    }
  };

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});
app.get("/api/home", wrap((planner, req) => planner.home(String(req.query.member ?? "") || undefined)));
app.post("/api/pin", wrap((planner, req) => planner.setPin(String(req.body.member ?? ""), String(req.body.pin ?? ""))));
app.post("/api/unlock", wrap((planner, req) => planner.unlock(String(req.body.member ?? ""), String(req.body.pin ?? ""))));
app.post("/api/vote", wrap((planner, req) => planner.vote(String(req.body.member), String(req.body.date), String(req.body.dishId), String(req.body.token ?? ""))));
app.post("/api/reroll", wrap((planner, req) => planner.reroll(String(req.body.member), String(req.body.date), String(req.body.token ?? ""))));

export default app;

// Traditional Node listen for local/Docker. Vercel imports the default export instead.
if (!process.env.VERCEL) {
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? "0.0.0.0";
  app.listen(port, host, () => console.log(`Aaj Kya Banega running on http://${host}:${port}`));
}
