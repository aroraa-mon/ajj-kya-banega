import type { Season } from "./types.js";

/** Rules from the family's spec. Edit values here. */
export const RULES = {
  /** A dish can't repeat within this many days. */
  noRepeatDays: 5,
  /** Occasional dishes (sprouts, halwa, pasta...) need a longer gap. Assumed default. */
  occasionalMinGapDays: 14,
  /**
   * Your rule is 10 high-protein of 21 weekly meals (~48%).
   * For 7 breakfasts that rounds to 3.
   */
  minHighProteinPerWeek: 3,
  /** All paratha types together, per Monday-Sunday week. Assumed default. */
  maxParathaPerWeek: 3,
  /** Surprise dish (Chole Bhature) can only land on these weekdays (0 = Sunday). Assumed default. */
  surpriseWeekdays: [0],
  /** Chance a surprise dish is chosen on a day it is eligible. */
  surpriseChance: 0.35,
  voteOptions: 3,
  /** How many times the cook can re-roll one breakfast. */
  rerollsPerDay: 2,
  /** Learning: winner gets multiplied up, cook-rejected dish down. */
  winBoost: 1.1,
  rejectPenalty: 0.8,
  minWeight: 0.4,
  maxWeight: 2,
};

/** Winter: Nov to Feb. */
export function seasonOf(date: string): Exclude<Season, "All"> {
  const m = Number(date.slice(5, 7));
  return m === 11 || m === 12 || m === 1 || m === 2 ? "Winter" : "Summer";
}
