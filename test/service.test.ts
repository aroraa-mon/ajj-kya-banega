import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { RULES } from "../src/config.js";
import { addDays, istDate, seededRng, weekday } from "../src/date.js";
import { PgliteDatabase, schemaSql } from "../src/db.js";
import { DISHES } from "../src/dishes.js";
import { planDay } from "../src/engine.js";
import { seed } from "../src/seed.js";
import { hashPin } from "../src/pins.js";
import { Planner } from "../src/service.js";
import type { HistoryEntry, Member } from "../src/types.js";

const members: Member[] = JSON.parse(readFileSync(new URL("../data/members.json", import.meta.url), "utf8"));
const COOK = members.find((m) => m.isCook)!.id; // m2
const NON_COOK = members.find((m) => !m.isCook)!.id; // m1
const OTHER = members.filter((m) => !m.isCook)[1].id; // m4

// Test dates are always in the future of the real clock, so the database's own
// 11:59 pm trigger (which uses the real time) never interferes with the fake clock.
const realToday = istDate(new Date());
let BASE = addDays(realToday, 30);
while (weekday(BASE) !== 1) BASE = addDays(BASE, 1); // a Monday
const D = (n: number) => addDays(BASE, n);
const at = (date: string, time: string) => `${date}T${time}+05:30`;

const PIN = "2468";
const phone = new Map<string, string>();
const db = new PgliteDatabase();
beforeAll(async () => {
  await db.exec(schemaSql());
  await db.transaction((q) => seed(q, members));
  await db.query("update members set pin_hash = $1", [hashPin(PIN)]);
  const planner = new Planner(db);
  for (const m of members) phone.set(m.id, (await planner.unlock(m.id, PIN)).token);
});
afterAll(() => db.close());
beforeEach(async () => {
  await db.exec("truncate votes, plan_options, day_plans, dish_weights");
  await db.query("update members set pin_fails = 0, pin_locked_until = null");
});

function vote(planner: Planner, memberId: string, date: string, dishId: string) {
  const token = phone.get(memberId);
  if (!token) throw new Error(`no phone saved for ${memberId}`);
  return planner.vote(memberId, date, dishId, token);
}
function reroll(planner: Planner, memberId: string, date: string) {
  const token = phone.get(memberId);
  if (!token) throw new Error(`no phone saved for ${memberId}`);
  return planner.reroll(memberId, date, token);
}

function setup(startIso: string) {
  let now = new Date(startIso);
  const planner = new Planner(db, { clock: () => now });
  return { planner, set: (iso: string) => (now = new Date(iso)) };
}

describe("planner service (real SQL)", () => {
  it("shows today locked and tomorrow open for voting", async () => {
    const { planner } = setup(at(D(0), "10:00:00"));
    const h = await planner.home(NON_COOK);
    expect(h.today.date).toBe(D(0));
    expect(h.today.status).toBe("locked");
    expect(h.tomorrow.date).toBe(D(1));
    expect(h.tomorrow.votingOpen).toBe(true);
    expect(h.tomorrow.options.length).toBe(3);
  });

  it("majority vote wins when voting closes at 11:59 pm", async () => {
    const { planner, set } = setup(at(D(0), "10:00:00"));
    const h = await planner.home(NON_COOK);
    const target = h.tomorrow.options.find((o) => !o.isDefault)!;
    await vote(planner, NON_COOK, D(1), target.id);
    await vote(planner, OTHER, D(1), target.id);
    set(at(D(0), "23:58:00"));
    await vote(planner, COOK, D(1), h.tomorrow.options[0].id); // still open
    set(at(D(0), "23:59:30"));
    await expect(vote(planner, COOK, D(1), target.id)).rejects.toThrow(/closed/);
    const after = await planner.home(NON_COOK);
    expect(after.tomorrow.status).toBe("locked");
    expect(after.tomorrow.dish!.id).toBe(target.id);
    expect(after.tomorrow.finalReason).toBe("votes");
  });

  it("a winning vote nudges that dish's learned weight up", async () => {
    const { planner, set } = setup(at(D(0), "10:00:00"));
    const h = await planner.home(NON_COOK);
    const target = h.tomorrow.options.find((o) => !o.isDefault)!;
    await vote(planner, NON_COOK, D(1), target.id);
    set(at(D(1), "07:00:00"));
    await planner.home(NON_COOK);
    const { rows } = await db.query<{ weight: number }>("select weight from dish_weights where dish_id = $1", [target.id]);
    expect(rows[0].weight).toBeCloseTo(RULES.winBoost);
  });

  it("a member can change their vote, but only counts once", async () => {
    const { planner } = setup(at(D(0), "10:00:00"));
    const h = await planner.home(NON_COOK);
    const [a, b] = h.tomorrow.options;
    await vote(planner, NON_COOK, D(1), a.id);
    await vote(planner, NON_COOK, D(1), b.id);
    const after = await planner.home(NON_COOK);
    expect(after.tomorrow.totalVotes).toBe(1);
    expect(after.tomorrow.myVote).toBe(b.id);
  });

  it("tie keeps the app's pick", async () => {
    const { planner, set } = setup(at(D(0), "10:00:00"));
    const h = await planner.home(NON_COOK);
    const [a, b] = h.tomorrow.options;
    await vote(planner, NON_COOK, D(1), a.id);
    await vote(planner, OTHER, D(1), b.id);
    set(at(D(1), "07:00:00"));
    const after = await planner.home(NON_COOK);
    expect(after.today.dish!.id).toBe(a.id);
    expect(after.today.finalReason).toBe("default");
  });

  it("tomorrow: only the cook can re-roll, once; it replaces the pick and restarts voting", async () => {
    const { planner } = setup(at(D(0), "10:00:00"));
    const h = await planner.home(NON_COOK);
    expect(h.tomorrow.canReroll).toBe(false);
    await expect(reroll(planner, NON_COOK, D(1))).rejects.toThrow(/Only the cook/);
    const before = (await planner.home(COOK)).tomorrow;
    expect(before.canReroll).toBe(true);
    await reroll(planner, COOK, D(1));
    const after = (await planner.home(COOK)).tomorrow;
    expect(after.status).toBe("voting");
    expect(after.votingOpen).toBe(true);
    expect(after.finalReason).toBeNull();
    expect(after.canReroll).toBe(true); // one of two used
    expect(after.options.map((o) => o.id)).not.toContain(before.dish!.id);
    expect(after.options).toHaveLength(before.options.length);
    expect(after.options[0].isDefault).toBe(true); // the new dish is the app's pick now
    expect(after.totalVotes).toBe(0);
    await reroll(planner, COOK, D(1)); // second re-roll
    const again = (await planner.home(COOK)).tomorrow;
    expect(again.status).toBe("voting");
    expect(again.canReroll).toBe(false);
    await expect(reroll(planner, COOK, D(1))).rejects.toThrow(/Already used all 2 re-rolls/);
    const { rows } = await db.query<{ weight: number }>("select weight from dish_weights where dish_id = $1", [before.dish!.id]);
    expect(rows[0].weight).toBeCloseTo(RULES.rejectPenalty);
  });

  it("tomorrow: the re-roll replaces the highest-voted option, keeps the app's pick, and clears votes", async () => {
    const { planner } = setup(at(D(0), "10:00:00"));
    const h = await planner.home(NON_COOK);
    const [pick, leader] = h.tomorrow.options;
    await vote(planner, NON_COOK, D(1), leader.id);
    await vote(planner, OTHER, D(1), leader.id);
    await reroll(planner, COOK, D(1));
    const after = (await planner.home(COOK)).tomorrow;
    expect(after.options.map((o) => o.id)).not.toContain(leader.id);
    expect(after.options[0].id).toBe(pick.id);
    expect(after.options[0].isDefault).toBe(true);
    expect(after.totalVotes).toBe(0);
    expect(after.myVote).toBeNull();
    // Voting is open again, so members can vote on the new list.
    await vote(planner, NON_COOK, D(1), after.options[1].id);
    const voted = (await planner.home(NON_COOK)).tomorrow;
    expect(voted.totalVotes).toBe(1);
  });

  it("today: the re-roll still locks the day on a different dish", async () => {
    const { planner } = setup(at(D(0), "10:00:00"));
    const before = (await planner.home(COOK)).today;
    await reroll(planner, COOK, D(0));
    const after = (await planner.home(COOK)).today;
    expect(after.status).toBe("locked");
    expect(after.finalReason).toBe("cook-reroll");
    expect(after.dish!.id).not.toBe(before.dish!.id);
    expect(after.canReroll).toBe(true); // one of two used
    await reroll(planner, COOK, D(0)); // second re-roll
    const again = (await planner.home(COOK)).today;
    expect(again.status).toBe("locked");
    expect(again.canReroll).toBe(false);
    await expect(reroll(planner, COOK, D(0))).rejects.toThrow(/Already used all 2 re-rolls/);
  });

  it("is deterministic: two phones see the same picks", async () => {
    const a = await setup(at(D(0), "10:00:00")).planner.home(NON_COOK);
    const b = await setup(at(D(0), "18:00:00")).planner.home(OTHER);
    expect(a.tomorrow.options.map((o) => o.id)).toEqual(b.tomorrow.options.map((o) => o.id));
  });

  it("simultaneous votes from several phones all land", async () => {
    const { planner } = setup(at(D(0), "10:00:00"));
    const h = await planner.home(NON_COOK);
    const [a, b, c] = h.tomorrow.options;
    await Promise.all([
      vote(planner, "m1", D(1), a.id), vote(planner, "m2", D(1), b.id), vote(planner, "m3", D(1), c.id),
      vote(planner, "m4", D(1), a.id), vote(planner, "m5", D(1), a.id), vote(planner, "m6", D(1), b.id),
    ]);
    const after = await planner.home(NON_COOK);
    expect(after.tomorrow.totalVotes).toBe(6);
    expect(after.tomorrow.options.map((o) => o.votes)).toEqual([3, 2, 1]);
  });

  it("a vote needs this phone's PIN token, and someone else's token does not work", async () => {
    const { planner } = setup(at(D(0), "10:00:00"));
    const dish = (await planner.home(NON_COOK)).tomorrow.options[0].id;
    await expect(planner.vote(NON_COOK, D(1), dish, "")).rejects.toThrow(/PIN/);
    await expect(planner.vote(NON_COOK, D(1), dish, phone.get(OTHER)!)).rejects.toThrow(/PIN/);
    await expect(planner.reroll(COOK, D(1), phone.get(NON_COOK)!)).rejects.toThrow(/PIN/);
    await planner.vote(NON_COOK, D(1), dish, phone.get(NON_COOK)!);
    expect((await planner.home(NON_COOK)).tomorrow.myVote).toBe(dish);
  });

  it("the right PIN remembers the phone, and five wrong ones lock it", async () => {
    const { planner } = setup(at(D(0), "10:00:00"));
    await expect(planner.unlock(NON_COOK, "0000")).rejects.toThrow(/Wrong PIN/);
    const { token } = await planner.unlock(COOK, PIN);
    const dish = (await planner.home(COOK)).tomorrow.options[1].id;
    await planner.vote(COOK, D(1), dish, token);
    for (let i = 0; i < 5; i++) await expect(planner.unlock(OTHER, "0000")).rejects.toThrow(/Wrong PIN/);
    await expect(planner.unlock(OTHER, PIN)).rejects.toThrow(/Too many tries/);
  });

  it("a member with no PIN sets one and comes straight in; a second set is refused", async () => {
    await db.query("update members set pin_hash = null where id = $1", [NON_COOK]);
    const { planner } = setup(at(D(0), "10:00:00"));
    expect((await planner.home()).members.find((m) => m.id === NON_COOK)?.hasPin).toBe(false);
    await expect(planner.setPin(NON_COOK, "12")).rejects.toThrow(/4 digits/);
    const { token } = await planner.setPin(NON_COOK, "1212");
    const dish = (await planner.home(NON_COOK)).tomorrow.options[0].id;
    await planner.vote(NON_COOK, D(1), dish, token);
    await expect(planner.setPin(NON_COOK, "9999")).rejects.toThrow(/already set/);
    await db.query("update members set pin_hash = $2 where id = $1", [NON_COOK, hashPin(PIN)]);
  });
});

describe("surprise day", () => {
  it("is hidden from non-cooks the day before, visible to cooks, revealed on the day, and not votable", async () => {
    // Use the pure engine (same seeds, no votes) to find the first Sunday that gets a surprise.
    const hist: HistoryEntry[] = [];
    let sunday = "";
    for (let i = 0; i < 400 && !sunday; i++) {
      const date = D(i);
      const r = planDay(DISHES, date, hist, {}, seededRng(`plan:${date}`));
      hist.push({ date, dishId: r.dish.id });
      if (r.surprise) sunday = date;
    }
    expect(sunday).not.toBe("");
    const saturday = addDays(sunday, -1);

    const { planner, set } = setup(at(BASE, "12:00:00"));
    for (let d = BASE; d <= saturday; d = addDays(d, 1)) {
      set(at(d, "12:00:00"));
      await planner.home(NON_COOK); // walk forward day by day so history is realistic
    }
    const nonCook = (await planner.home(NON_COOK)).tomorrow;
    expect(nonCook.masked).toBe(true);
    expect(nonCook.dish).toBeNull();
    expect(nonCook.options).toEqual([]);
    const cook = (await planner.home(COOK)).tomorrow;
    expect(cook.masked).toBe(false);
    expect(cook.dish!.id).toBe("chole-bhature");
    await expect(vote(planner, NON_COOK, sunday, "chole-bhature")).rejects.toThrow(/surprise/);
    set(at(sunday, "08:00:00"));
    expect((await planner.home(NON_COOK)).today.dish!.id).toBe("chole-bhature");
  }, 120000);
});
