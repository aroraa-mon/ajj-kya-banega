const DAY = 86400000;
const toUTC = (d: string) => {
  const [y, m, day] = d.split("-").map(Number);
  return Date.UTC(y, m - 1, day);
};

export const addDays = (d: string, n: number) => new Date(toUTC(d) + n * DAY).toISOString().slice(0, 10);
export const daysBetween = (a: string, b: string) => Math.round((toUTC(b) - toUTC(a)) / DAY);
/** 0 = Sunday */
export const weekday = (d: string) => new Date(toUTC(d)).getUTCDay();
/** Monday of the week containing d. */
export const weekStart = (d: string) => addDays(d, -((weekday(d) + 6) % 7));

/** Today's date in India (YYYY-MM-DD), whatever the server's own timezone is. */
export const istDate = (now: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);

/** Voting for `date` closes at 11:59 pm IST the night before. */
export const votingClosesAt = (date: string) => new Date(`${addDays(date, -1)}T23:59:00+05:30`);

/** Small deterministic RNG so every phone sees the same pick for a given date. */
export function seededRng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
