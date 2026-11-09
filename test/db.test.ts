import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PgliteDatabase, schemaSql } from "../src/db.js";
import { seed } from "../src/seed.js";
import * as repo from "../src/repo.js";
import { DISHES } from "../src/dishes.js";
import type { Member } from "../src/types.js";

const members: Member[] = JSON.parse(readFileSync(new URL("../data/members.json", import.meta.url), "utf8"));
const db = new PgliteDatabase();

beforeAll(async () => {
  await db.exec(schemaSql());
  await db.exec(schemaSql()); // running the schema twice must be harmless
  await db.transaction((q) => seed(q, members));
  await db.transaction((q) => seed(q, members)); // so must seeding
});
afterAll(() => db.close());

describe("database", () => {
  it("seeds every dish and member exactly once", async () => {
    const d = await db.query<{ n: number }>("select count(*)::int as n from dishes");
    const m = await db.query<{ n: number }>("select count(*)::int as n from members");
    expect(d.rows[0].n).toBe(DISHES.length);
    expect(m.rows[0].n).toBe(members.length);
  });

  it("round-trips dishes into the shapes the engine uses", async () => {
    const loaded = await repo.loadDishes(db, "breakfast");
    expect(loaded.length).toBe(DISHES.length);
    const cb = loaded.find((x) => x.id === "chole-bhature")!;
    expect(cb.surprise).toBe(true);
    expect(cb.maxPerMonth).toBe(1);
    expect(cb.name.hi).toBe("छोले भटूरे");
    const sabzi = loaded.find((x) => x.id === "paratha-sabzi")!;
    expect(sabzi.maxPerWeek).toBe(2);
    expect(sabzi.tags).toContain("paratha");
  });

  it("rejects a vote for a dish that is not one of the day's options", async () => {
    await repo.insertPlan(db, "breakfast", { date: "2099-01-05", pick: "poha", options: ["poha", "daliya"], surprise: false, rerollCount: 0, votes: {} });
    await expect(repo.upsertVote(db, "2099-01-05", "breakfast", "m1", "besan-chilla")).rejects.toThrow();
    await repo.upsertVote(db, "2099-01-05", "breakfast", "m1", "daliya");
    await repo.upsertVote(db, "2099-01-05", "breakfast", "m1", "poha"); // change of mind = upsert, still one row
    const { rows } = await db.query("select * from votes where plan_date = '2099-01-05'");
    expect(rows.length).toBe(1);
  });

  it("refuses votes after the 11:59 pm cutoff, in the database itself", async () => {
    await repo.insertPlan(db, "breakfast", { date: "2020-01-06", pick: "poha", options: ["poha", "daliya"], surprise: false, rerollCount: 0, votes: {} });
    await expect(repo.upsertVote(db, "2020-01-06", "breakfast", "m1", "poha")).rejects.toThrow(/Voting closed/);
  });

  it("keeps learned weights inside 0.4 to 2", async () => {
    await expect(repo.upsertWeight(db, "poha", 3)).rejects.toThrow();
    await expect(repo.upsertWeight(db, "poha", 0.1)).rejects.toThrow();
    await repo.upsertWeight(db, "poha", 1.5);
    expect((await repo.loadWeights(db)).poha).toBeCloseTo(1.5);
  });

  it("has row level security on so the public API key can't read the data", async () => {
    const { rows } = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select relname, relrowsecurity from pg_class
        where relname in ('members','dishes','day_plans','plan_options','votes','dish_weights')`,
    );
    expect(rows.length).toBe(6);
    expect(rows.every((r) => r.relrowsecurity)).toBe(true);
  });
});
