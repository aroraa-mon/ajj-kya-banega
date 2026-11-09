import { describe, expect, it } from "vitest";
import { RULES } from "../src/config.js";
import { addDays, daysBetween, seededRng, weekStart, weekday } from "../src/date.js";
import { DISHES } from "../src/dishes.js";
import { planDay, tallyWinner } from "../src/engine.js";
import type { HistoryEntry } from "../src/types.js";

const byId = new Map(DISHES.map((d) => [d.id, d]));

function simulate(start: string, days: number, salt: string) {
  const history: HistoryEntry[] = [];
  const optionsByDate: Record<string, string[]> = {};
  for (let i = 0; i < days; i++) {
    const date = addDays(start, i);
    const r = planDay(DISHES, date, history, {}, seededRng(`${salt}:${date}`));
    history.push({ date, dishId: r.dish.id });
    optionsByDate[date] = r.options.map((d) => d.id);
  }
  return { history, optionsByDate };
}

describe("rules hold over two years, several seeds", () => {
  for (const salt of ["a", "b", "c"]) {
    const { history, optionsByDate } = simulate("2026-11-09", 730, salt); // starts on a Monday

    it(`no repeat within ${RULES.noRepeatDays} days; occasional dishes wait longer (${salt})`, () => {
      for (const h of history) {
        const d = byId.get(h.dishId)!;
        const gap = d.occasional ? RULES.occasionalMinGapDays : RULES.noRepeatDays;
        const prev = history.filter((x) => x.dishId === h.dishId && x.date < h.date).map((x) => x.date).pop();
        if (prev) expect(daysBetween(prev, h.date), `${d.id} on ${h.date}`).toBeGreaterThan(gap);
      }
    });

    it(`paratha+sabzi max 2/week, all parathas max ${RULES.maxParathaPerWeek}/week (${salt})`, () => {
      const weeks = new Map<string, HistoryEntry[]>();
      for (const h of history) {
        const k = weekStart(h.date);
        weeks.set(k, [...(weeks.get(k) ?? []), h]);
      }
      for (const [wk, hs] of weeks) {
        expect(hs.filter((h) => h.dishId === "paratha-sabzi").length, wk).toBeLessThanOrEqual(2);
        expect(hs.filter((h) => byId.get(h.dishId)!.tags.includes("paratha")).length, wk).toBeLessThanOrEqual(RULES.maxParathaPerWeek);
      }
    });

    it(`Chole Bhature: Sundays only, at most once in any 30 days, never a vote option (${salt})`, () => {
      const cb = history.filter((h) => h.dishId === "chole-bhature");
      expect(cb.length).toBeGreaterThan(0);
      for (const h of cb) expect(weekday(h.date)).toBe(0);
      for (let i = 1; i < cb.length; i++) expect(daysBetween(cb[i - 1].date, cb[i].date)).toBeGreaterThanOrEqual(30);
      for (const opts of Object.values(optionsByDate)) expect(opts).not.toContain("chole-bhature");
    });

    it(`Mooli Paratha only in winter months (${salt})`, () => {
      for (const h of history.filter((x) => x.dishId === "mooli-paratha")) {
        expect([11, 12, 1, 2]).toContain(Number(h.date.slice(5, 7)));
      }
    });

    it(`every day has 3 distinct vote options with the pick first, unless surprise (${salt})`, () => {
      for (const h of history) {
        const opts = optionsByDate[h.date];
        if (h.dishId === "chole-bhature") { expect(opts).toEqual([]); continue; }
        expect(opts.length).toBe(3);
        expect(new Set(opts).size).toBe(3);
        expect(opts[0]).toBe(h.dishId);
      }
    });
  }

  it("reports the protein hit-rate (informational, must stay above 2 high-protein breakfasts a week on average)", () => {
    const { history } = simulate("2026-11-09", 730, "protein");
    const weeks = new Map<string, number>();
    for (const h of history) {
      const k = weekStart(h.date);
      weeks.set(k, (weeks.get(k) ?? 0) + (byId.get(h.dishId)!.protein === "High" ? 1 : 0));
    }
    const full = [...weeks.values()].slice(1, -1);
    const avg = full.reduce((a, b) => a + b, 0) / full.length;
    const hit = full.filter((n) => n >= RULES.minHighProteinPerWeek).length / full.length;
    console.log(`avg high-protein breakfasts/week: ${avg.toFixed(2)}; weeks meeting the ${RULES.minHighProteinPerWeek}/week target: ${(hit * 100).toFixed(0)}%`);
    expect(avg).toBeGreaterThan(2);
  });
});

describe("vote tally", () => {
  const opts = ["a", "b", "c"];
  it("majority wins", () => expect(tallyWinner(opts, { m1: "b", m2: "b", m3: "a" }, "a")).toBe("b"));
  it("tie keeps the app's pick", () => expect(tallyWinner(opts, { m1: "b", m2: "c" }, "a")).toBe("a"));
  it("no votes keeps the app's pick", () => expect(tallyWinner(opts, {}, "a")).toBe("a"));
  it("ignores votes for dishes that aren't options", () => expect(tallyWinner(opts, { m1: "z" }, "a")).toBe("a"));
});
