import type { Queryable } from "./db.js";
import { DISHES } from "./dishes.js";
import type { Dish, Member } from "./types.js";

/** Inserts or updates dishes and members. Safe to re-run after editing src/dishes.ts or data/members.json. */
export async function seed(q: Queryable, members: Member[], dishes: Dish[] = DISHES, meal = "breakfast") {
  for (const m of members) {
    await q.query(
      `insert into members (id, name, is_cook) values ($1, $2, $3)
       on conflict (id) do update set name = excluded.name, is_cook = excluded.is_cook`,
      [m.id, m.name, m.isCook],
    );
  }
  for (const d of dishes) {
    await q.query(
      `insert into dishes (id, meal, name_en, name_hinglish, name_hi, protein, season, tags, base_weight,
                           occasional, surprise, max_per_week, max_per_month, min_gap_days, notes)
       values ($1, $2::meal_type, $3, $4, $5, $6::protein_level, $7::season_type, $8, $9, $10, $11, $12, $13, $14, $15)
       on conflict (id) do update set
         meal = excluded.meal, name_en = excluded.name_en, name_hinglish = excluded.name_hinglish, name_hi = excluded.name_hi,
         protein = excluded.protein, season = excluded.season, tags = excluded.tags, base_weight = excluded.base_weight,
         occasional = excluded.occasional, surprise = excluded.surprise, max_per_week = excluded.max_per_week,
         max_per_month = excluded.max_per_month, min_gap_days = excluded.min_gap_days, notes = excluded.notes`,
      [
        d.id, meal, d.name.en, d.name.hinglish, d.name.hi, d.protein, d.season, d.tags, d.weight,
        !!d.occasional, !!d.surprise, d.maxPerWeek ?? null, d.maxPerMonth ?? null, d.minGapDays ?? null, d.notes ?? null,
      ],
    );
  }
}
