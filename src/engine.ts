import { RULES, seasonOf } from "./config.js";
import { addDays, daysBetween, weekStart, weekday } from "./date.js";
import type { Dish, HistoryEntry } from "./types.js";

type Rng = () => number;
type Weights = Record<string, number>;

const group = (d: Dish) => d.tags[0];

/** Hard rules: which dishes may be served on `date`, given what was served before. */
export function eligibleDishes(dishes: Dish[], date: string, history: HistoryEntry[]): Dish[] {
  const season = seasonOf(date);
  const past = history.filter((h) => h.date < date);
  const wk = weekStart(date);
  const thisWeek = past.filter((h) => weekStart(h.date) === wk);
  const byId = new Map(dishes.map((d) => [d.id, d]));
  const parathaThisWeek = thisWeek.filter((h) => byId.get(h.dishId)?.tags.includes("paratha")).length;

  return dishes.filter((d) => {
    if (d.season !== "All" && d.season !== season) return false;

    const uses = past.filter((h) => h.dishId === d.id);
    const last = uses.reduce((m, h) => (h.date > m ? h.date : m), "");
    const minGap = d.minGapDays ?? (d.occasional ? RULES.occasionalMinGapDays : RULES.noRepeatDays);
    if (last && daysBetween(last, date) <= minGap) return false;

    if (d.maxPerWeek !== undefined && thisWeek.filter((h) => h.dishId === d.id).length >= d.maxPerWeek) return false;
    if (d.maxPerMonth !== undefined && uses.filter((h) => daysBetween(h.date, date) < 30).length >= d.maxPerMonth) return false;
    if (d.tags.includes("paratha") && parathaThisWeek >= RULES.maxParathaPerWeek) return false;
    if (d.surprise && !RULES.surpriseWeekdays.includes(weekday(date))) return false;
    return true;
  });
}

function weightedPick(pool: Dish[], weight: (d: Dish) => number, rng: Rng): Dish {
  const ws = pool.map((d) => Math.max(weight(d), 0.0001));
  let r = rng() * ws.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    r -= ws[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

export interface Pick {
  dish: Dish;
  surprise: boolean;
  /** Vote options (empty for a surprise). Default pick first. */
  options: Dish[];
}

/**
 * Choose the app's pick plus vote options for `date`.
 * Hard rules filter; protein target and learned weights bias.
 */
export function planDay(
  dishes: Dish[],
  date: string,
  history: HistoryEntry[],
  weights: Weights,
  rng: Rng,
  exclude: string[] = [],
  allowSurprise = true,
): Pick {
  let eligible = eligibleDishes(dishes, date, history).filter((d) => !exclude.includes(d.id));
  if (eligible.length === 0) {
    // Safety net: relax everything except season and "not yesterday".
    const season = seasonOf(date);
    const yesterday = history.find((h) => h.date === addDays(date, -1))?.dishId;
    eligible = dishes.filter(
      (d) => !d.surprise && (d.season === "All" || d.season === season) && d.id !== yesterday && !exclude.includes(d.id),
    );
  }

  if (allowSurprise) {
    const s = eligible.find((d) => d.surprise);
    if (s && rng() < RULES.surpriseChance) return { dish: s, surprise: true, options: [] };
  }

  let normal = eligible.filter((d) => !d.surprise);

  // Protein pressure: how many high-protein breakfasts are still owed this week?
  const wk = weekStart(date);
  const byId = new Map(dishes.map((d) => [d.id, d]));
  const highSoFar = history.filter(
    (h) => h.date < date && weekStart(h.date) === wk && byId.get(h.dishId)?.protein === "High",
  ).length;
  const needed = RULES.minHighProteinPerWeek - highSoFar;
  const daysLeft = 7 - ((weekday(date) + 6) % 7); // Monday = 7 ... Sunday = 1
  const highPool = normal.filter((d) => d.protein === "High");
  const forced = needed > 0 && needed >= daysLeft && highPool.length > 0;
  const boost = needed > 0 ? 1 + (4 * needed) / daysLeft : 1;

  const w = (d: Dish) => d.weight * (weights[d.id] ?? 1) * (d.protein === "High" ? boost : 1);
  const pool = forced ? highPool : normal;
  const dish = weightedPick(pool, w, rng);

  // Vote options: default first, then others from different groups where possible.
  const options = [dish];
  const optionPool = forced ? [...highPool, ...normal.filter((d) => d.protein !== "High")] : normal;
  while (options.length < RULES.voteOptions) {
    const rest = optionPool.filter((d) => !options.includes(d));
    if (rest.length === 0) break;
    const fresh = rest.filter((d) => !options.some((o) => group(o) === group(d)));
    options.push(weightedPick(fresh.length ? fresh : rest, w, rng));
  }
  return { dish, surprise: false, options };
}

/** Plain majority; a tie or no votes keeps the app's pick. */
export function tallyWinner(options: string[], votes: Record<string, string>, fallback: string): string {
  const counts = new Map<string, number>();
  for (const id of Object.values(votes)) if (options.includes(id)) counts.set(id, (counts.get(id) ?? 0) + 1);
  let top = 0;
  let winners: string[] = [];
  for (const [id, c] of counts) {
    if (c > top) { top = c; winners = [id]; } else if (c === top) winners.push(id);
  }
  return winners.length === 1 ? winners[0] : fallback;
}
