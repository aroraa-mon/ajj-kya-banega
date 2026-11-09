import type { Queryable } from "./db.js";
import type { DayPlan, Dish, Final, HistoryEntry, Member } from "./types.js";

/** All SQL lives here. Dates travel as 'YYYY-MM-DD' strings. */

export async function loadMembers(q: Queryable): Promise<Member[]> {
  const { rows } = await q.query<{ id: string; name: string; is_cook: boolean; has_pin: boolean }>(
    "select id, name, is_cook, pin_hash is not null as has_pin from members where active order by id",
  );
  return rows.map((r) => ({ id: r.id, name: r.name, isCook: r.is_cook, hasPin: r.has_pin }));
}

/** Sets the PIN only while this person doesn't have one. Returns false if it was already set. */
export async function setPinHash(q: Queryable, memberId: string, pinHash: string): Promise<boolean> {
  const { rowCount } = await q.query(
    "update members set pin_hash = $2, pin_fails = 0, pin_locked_until = null where id = $1 and pin_hash is null",
    [memberId, pinHash],
  );
  return rowCount === 1;
}

export async function loadDishes(q: Queryable, meal: string): Promise<Dish[]> {
  const { rows } = await q.query<any>(
    `select id, name_en, name_hinglish, name_hi, protein::text as protein, season::text as season, tags,
            base_weight, occasional, surprise, max_per_week, max_per_month, min_gap_days, notes
       from dishes where meal = $1::meal_type and enabled order by id`,
    [meal],
  );
  return rows.map((r) => ({
    id: r.id,
    name: { en: r.name_en, hinglish: r.name_hinglish, hi: r.name_hi },
    protein: r.protein,
    season: r.season,
    tags: r.tags,
    weight: Number(r.base_weight),
    occasional: r.occasional || undefined,
    surprise: r.surprise || undefined,
    maxPerWeek: r.max_per_week ?? undefined,
    maxPerMonth: r.max_per_month ?? undefined,
    minGapDays: r.min_gap_days ?? undefined,
    notes: r.notes ?? undefined,
  }));
}

export async function loadWeights(q: Queryable): Promise<Record<string, number>> {
  const { rows } = await q.query<{ dish_id: string; weight: number }>("select dish_id, weight from dish_weights");
  return Object.fromEntries(rows.map((r) => [r.dish_id, Number(r.weight)]));
}

export async function upsertWeight(q: Queryable, dishId: string, weight: number) {
  await q.query(
    `insert into dish_weights (dish_id, weight) values ($1, $2)
     on conflict (dish_id) do update set weight = excluded.weight, updated_at = now()`,
    [dishId, weight],
  );
}

/** Dishes served before `before` (final dish if locked, otherwise the app's pick). */
export async function history(q: Queryable, meal: string, before: string): Promise<HistoryEntry[]> {
  const { rows } = await q.query<{ date: string; dish_id: string }>(
    `select to_char(plan_date, 'YYYY-MM-DD') as date, coalesce(final_dish, pick) as dish_id
       from day_plans where meal = $1::meal_type and plan_date < $2::date`,
    [meal, before],
  );
  return rows.map((r) => ({ date: r.date, dishId: r.dish_id }));
}

export async function getPlan(q: Queryable, date: string, meal: string): Promise<DayPlan | null> {
  const { rows } = await q.query<any>(
    `select pick, surprise, final_dish, final_reason::text as final_reason, rerolled_from, rerolled_by, reroll_count
       from day_plans where plan_date = $1::date and meal = $2::meal_type`,
    [date, meal],
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  const opts = await q.query<{ dish_id: string }>(
    "select dish_id from plan_options where plan_date = $1::date and meal = $2::meal_type order by position",
    [date, meal],
  );
  const votes = await q.query<{ member_id: string; dish_id: string }>(
    "select member_id, dish_id from votes where plan_date = $1::date and meal = $2::meal_type",
    [date, meal],
  );
  const plan: DayPlan = {
    date,
    pick: r.pick,
    options: opts.rows.map((o) => o.dish_id),
    surprise: r.surprise,
    rerollCount: Number(r.reroll_count ?? 0),
    votes: Object.fromEntries(votes.rows.map((v) => [v.member_id, v.dish_id])),
  };
  if (r.final_dish) plan.final = { dishId: r.final_dish, reason: r.final_reason };
  if (r.rerolled_from) plan.rerolled = { from: r.rerolled_from, to: r.final_dish, by: r.rerolled_by };
  return plan;
}

export async function insertPlan(q: Queryable, meal: string, plan: DayPlan) {
  await q.query(
    "insert into day_plans (plan_date, meal, pick, surprise) values ($1::date, $2::meal_type, $3, $4)",
    [plan.date, meal, plan.pick, plan.surprise],
  );
  for (const [i, dishId] of plan.options.entries()) {
    await q.query(
      "insert into plan_options (plan_date, meal, dish_id, position) values ($1::date, $2::meal_type, $3, $4)",
      [plan.date, meal, dishId, i],
    );
  }
}

export async function upsertVote(q: Queryable, date: string, meal: string, memberId: string, dishId: string) {
  await q.query(
    `insert into votes (plan_date, meal, member_id, dish_id) values ($1::date, $2::meal_type, $3, $4)
     on conflict (plan_date, meal, member_id) do update set dish_id = excluded.dish_id, voted_at = now()`,
    [date, meal, memberId, dishId],
  );
}

export async function setFinal(q: Queryable, date: string, meal: string, final: Final) {
  await q.query(
    `update day_plans set final_dish = $3, final_reason = $4::final_reason
      where plan_date = $1::date and meal = $2::meal_type`,
    [date, meal, final.dishId, final.reason],
  );
}

/**
 * Cook's swap for a future day: the leading option is replaced by `to` in the same slot,
 * all votes are cleared, and voting stays open. If the leader was the app's pick, `to` becomes the pick.
 */
export async function replaceLeaderAndRestartVoting(
  q: Queryable, date: string, meal: string, from: string, to: string, by: string,
) {
  await q.query("delete from votes where plan_date = $1::date and meal = $2::meal_type", [date, meal]);
  await q.query(
    "update plan_options set dish_id = $3 where plan_date = $1::date and meal = $2::meal_type and dish_id = $4",
    [date, meal, to, from],
  );
  await q.query(
    `update day_plans set rerolled_from = $3, rerolled_by = $4, reroll_count = reroll_count + 1,
            pick = case when pick = $5 then $6 else pick end
      where plan_date = $1::date and meal = $2::meal_type`,
    [date, meal, from, by, from, to],
  );
}

/** Cook's swap: clears votes, leaves one option, locks the day on the new dish. */
export async function applyReroll(q: Queryable, date: string, meal: string, from: string, to: string, by: string) {
  await q.query("delete from votes where plan_date = $1::date and meal = $2::meal_type", [date, meal]);
  await q.query("delete from plan_options where plan_date = $1::date and meal = $2::meal_type", [date, meal]);
  await q.query(
    "insert into plan_options (plan_date, meal, dish_id, position) values ($1::date, $2::meal_type, $3, 0)",
    [date, meal, to],
  );
  await q.query(
    `update day_plans set surprise = false, rerolled_from = $3, rerolled_by = $4, reroll_count = reroll_count + 1,
            final_dish = $5, final_reason = 'cook-reroll'
      where plan_date = $1::date and meal = $2::meal_type`,
    [date, meal, from, by, to],
  );
}

export interface PinState {
  pinHash: string | null;
  fails: number;
  lockedUntil: Date | null;
}

export async function pinState(q: Queryable, memberId: string): Promise<PinState | null> {
  const { rows } = await q.query<{ pin_hash: string | null; pin_fails: number; pin_locked_until: Date | null }>(
    "select pin_hash, pin_fails, pin_locked_until from members where id = $1",
    [memberId],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    pinHash: r.pin_hash,
    fails: Number(r.pin_fails),
    lockedUntil: r.pin_locked_until ? new Date(r.pin_locked_until) : null,
  };
}

export async function setPinFails(q: Queryable, memberId: string, fails: number) {
  await q.query("update members set pin_fails = $2 where id = $1", [memberId, fails]);
}

export async function lockPin(q: Queryable, memberId: string, until: Date) {
  await q.query("update members set pin_fails = 0, pin_locked_until = $2::timestamptz where id = $1", [memberId, until.toISOString()]);
}

export async function clearPinFails(q: Queryable, memberId: string) {
  await q.query("update members set pin_fails = 0, pin_locked_until = null where id = $1", [memberId]);
}

export async function insertToken(q: Queryable, tokenHash: string, memberId: string) {
  await q.query("insert into device_tokens (token_hash, member_id) values ($1, $2)", [tokenHash, memberId]);
}

/** Whose phone this token belongs to, or null. */
export async function memberForToken(q: Queryable, tokenHash: string): Promise<string | null> {
  const { rows } = await q.query<{ member_id: string }>(
    "select member_id from device_tokens where token_hash = $1",
    [tokenHash],
  );
  return rows[0]?.member_id ?? null;
}
