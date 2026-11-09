export type Protein = "High" | "Medium" | "Low";
export type Season = "All" | "Winter" | "Summer";
export type Lang = "en" | "hinglish" | "hi";

export interface Dish {
  id: string;
  name: Record<Lang, string>;
  protein: Protein;
  season: Season;
  /** First tag is the "group" used to keep vote options varied. */
  tags: string[];
  weight: number;
  /** Keep rare: uses the longer occasional gap from the rules. */
  occasional?: boolean;
  /** Hidden from votes and previews; revealed on the day (cooks see it early). */
  surprise?: boolean;
  maxPerWeek?: number;
  /** Rolling 30 days. */
  maxPerMonth?: number;
  /** Overrides the default repeat gap for this dish. */
  minGapDays?: number;
  notes?: string;
}

export interface Member {
  id: string;
  name: string;
  isCook: boolean;
  /** False until this person has chosen a PIN. Omitted by callers that only seed names. */
  hasPin?: boolean;
}

export interface HistoryEntry {
  date: string;
  dishId: string;
}

export interface Final {
  dishId: string;
  reason: "votes" | "default" | "cook-reroll";
}

export interface DayPlan {
  date: string;
  /** The app's own pick. */
  pick: string;
  /** Vote options, pick first. Empty-vote days (surprise) hold just the pick. */
  options: string[];
  surprise: boolean;
  /** memberId -> dishId */
  votes: Record<string, string>;
  rerolled?: { from: string; to: string; by: string };
  /** Re-rolls the cook has used on this breakfast. */
  rerollCount: number;
  final?: Final;
}
