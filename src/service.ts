import { RULES } from "./config.js";
import { addDays, istDate, seededRng, votingClosesAt, weekday } from "./date.js";
import type { Database, Queryable } from "./db.js";
import { planDay, tallyWinner } from "./engine.js";
import { hashPin, hashToken, newToken, pinOk } from "./pins.js";
import * as repo from "./repo.js";
import type { DayPlan, Dish, Member } from "./types.js";

const PIN_TRIES = 5;
const PIN_LOCK_MS = 5 * 60 * 1000;

export class PlannerError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

/** Thrown from inside a transaction when the writes (a wrong PIN, for example) must be kept. */
class CommitError extends PlannerError {}

const MEAL = "breakfast";
const clamp = (n: number) => Math.min(RULES.maxWeight, Math.max(RULES.minWeight, n));

/** What one request works with: an open transaction plus the reference data it loaded. */
interface Ctx {
  q: Queryable;
  dishes: Dish[];
  members: Member[];
  weights: Record<string, number>;
}

export class Planner {
  private clock: () => Date;

  constructor(private db: Database, opts: { clock?: () => Date } = {}) {
    this.clock = opts.clock ?? (() => new Date());
  }

  /** One request = one transaction, one writer at a time (so simultaneous taps can't clash). */
  private run<T>(fn: (c: Ctx, now: Date) => Promise<T>): Promise<T> {
    const kept = Symbol();
    return this.db.transaction(async (q) => {
      const dishes = await repo.loadDishes(q, MEAL);
      const members = await repo.loadMembers(q);
      const weights = await repo.loadWeights(q);
      try {
        return await fn({ q, dishes, members, weights }, this.clock());
      } catch (e) {
        if (e instanceof CommitError) return { [kept]: e };
        throw e;
      }
    }).then((result) => {
      if (result && typeof result === "object" && kept in result) throw result[kept];
      return result as T;
    });
  }

  private dish(c: Ctx, id: string) {
    const d = c.dishes.find((x) => x.id === id);
    if (!d) throw new PlannerError(`Unknown dish ${id}`);
    return d;
  }

  private member(c: Ctx, id?: string) {
    return c.members.find((m) => m.id === id);
  }

  /** The token is the one this phone got after the right PIN. It only works for that person. */
  private async requirePhone(c: Ctx, memberId: string, token: string) {
    const owner = token ? await repo.memberForToken(c.q, hashToken(token)) : null;
    if (owner !== memberId) throw new PlannerError("Enter your PIN on this phone", 401);
  }

  private async ensurePlan(c: Ctx, date: string): Promise<DayPlan> {
    const existing = await repo.getPlan(c.q, date, MEAL);
    if (existing) return existing;
    const hist = await repo.history(c.q, MEAL, date);
    const r = planDay(c.dishes, date, hist, c.weights, seededRng(`plan:${date}`));
    const plan: DayPlan = {
      date,
      pick: r.dish.id,
      options: r.surprise ? [r.dish.id] : r.options.map((d) => d.id),
      surprise: r.surprise,
      rerollCount: 0,
      votes: {},
    };
    await repo.insertPlan(c.q, MEAL, plan);
    return plan;
  }

  /** Locks the day once voting has closed. */
  private async finalizeIfDue(c: Ctx, plan: DayPlan, now: Date) {
    if (plan.final || now < votingClosesAt(plan.date)) return;
    const winner = plan.surprise ? plan.pick : tallyWinner(plan.options, plan.votes, plan.pick);
    const byVotes = winner !== plan.pick;
    plan.final = { dishId: winner, reason: byVotes ? "votes" : "default" };
    await repo.setFinal(c.q, plan.date, MEAL, plan.final);
    if (byVotes) {
      c.weights[winner] = clamp((c.weights[winner] ?? 1) * RULES.winBoost);
      await repo.upsertWeight(c.q, winner, c.weights[winner]);
    }
  }

  private async view(c: Ctx, date: string, now: Date, memberId?: string) {
    const plan = await this.ensurePlan(c, date);
    await this.finalizeIfDue(c, plan, now);
    const me = this.member(c, memberId);
    const isCook = !!me?.isCook;
    const today = istDate(now);
    const closes = votingClosesAt(date);
    const votingOpen = !plan.final && now < closes && !plan.surprise;
    // The surprise stays secret from everyone except cooks until the day itself.
    const masked = plan.surprise && date > today && !isCook;
    const shown = plan.final?.dishId ?? plan.pick;
    const leading = tallyWinner(plan.options, plan.votes, plan.pick);

    const dishView = (id: string) => {
      const d = this.dish(c, id);
      const why: string[] = [];
      if (d.protein === "High") why.push("protein");
      if (d.season === "Winter") why.push("winter");
      if ([0, 6].includes(weekday(date))) why.push("weekend");
      if (d.tags.includes("easy")) why.push("easy");
      if (d.tags.includes("light")) why.push("light");
      if (d.surprise) why.push("treat");
      return { id: d.id, name: d.name, protein: d.protein, why };
    };

    return {
      date,
      closesAt: closes.toISOString(),
      status: plan.final ? "locked" : "voting",
      surprise: plan.surprise,
      masked,
      secretForCook: plan.surprise && date > today && isCook,
      votingOpen,
      dish: masked ? null : dishView(shown),
      finalReason: plan.final?.reason ?? null,
      rerolled: plan.rerollCount > 0,
      canReroll: isCook && plan.rerollCount < RULES.rerollsPerDay && date >= today,
      myVote: me ? plan.votes[me.id] ?? null : null,
      leadingId: plan.surprise ? null : leading,
      options:
        masked || plan.surprise
          ? []
          : plan.options.map((id) => {
              const voters = Object.entries(plan.votes)
                .filter(([, v]) => v === id)
                .map(([m]) => this.member(c, m)?.name ?? m);
              return { ...dishView(id), isDefault: id === plan.pick, votes: voters.length, voters };
            }),
      totalVotes: Object.keys(plan.votes).length,
      membersTotal: c.members.length,
    };
  }

  /** Today's locked breakfast and tomorrow's open vote. */
  home(memberId?: string) {
    return this.run(async (c, now) => {
      const today = istDate(now);
      const t = await this.view(c, today, now, memberId); // today first, so tomorrow sees it in history
      const n = await this.view(c, addDays(today, 1), now, memberId);
      return { now: now.toISOString(), today: t, tomorrow: n, members: c.members };
    });
  }

  /** First visit: the person chooses a 4-digit PIN. Returns the token that lets this phone in. */
  setPin(memberId: string, pin: string) {
    return this.run(async (c) => {
      if (!this.member(c, memberId)) throw new PlannerError("Pick who you are first");
      const chosen = pin.trim();
      if (!/^\d{4}$/.test(chosen)) throw new PlannerError("PIN must be 4 digits");
      const wrote = await repo.setPinHash(c.q, memberId, hashPin(chosen));
      if (!wrote) throw new PlannerError("PIN is already set", 409);
      const token = newToken();
      await repo.insertToken(c.q, hashToken(token), memberId);
      return { token };
    });
  }

  /** Checks the PIN and returns a token this phone keeps. Later votes send the token, not the PIN. */
  unlock(memberId: string, pin: string) {
    return this.run(async (c, now) => {
      if (!this.member(c, memberId)) throw new PlannerError("Pick who you are first");
      const state = await repo.pinState(c.q, memberId);
      if (!state?.pinHash) throw new PlannerError("No PIN set for this person");
      if (state.lockedUntil && state.lockedUntil > now) {
        throw new PlannerError("Too many tries. Wait a few minutes.", 429);
      }
      if (!pinOk(pin.trim(), state.pinHash)) {
        const fails = state.fails + 1;
        if (fails >= PIN_TRIES) await repo.lockPin(c.q, memberId, new Date(now.getTime() + PIN_LOCK_MS));
        else await repo.setPinFails(c.q, memberId, fails);
        throw new CommitError("Wrong PIN", 401);
      }
      await repo.clearPinFails(c.q, memberId);
      const token = newToken();
      await repo.insertToken(c.q, hashToken(token), memberId);
      return { token };
    });
  }

  vote(memberId: string, date: string, dishId: string, token: string) {
    return this.run(async (c, now) => {
      if (!this.member(c, memberId)) throw new PlannerError("Pick who you are first");
      await this.requirePhone(c, memberId, token);
      if (date < istDate(now)) throw new PlannerError("That day is over");
      const plan = await this.ensurePlan(c, date);
      await this.finalizeIfDue(c, plan, now);
      if (plan.final || now >= votingClosesAt(date)) throw new PlannerError("Voting has closed for this breakfast", 409);
      if (plan.surprise) throw new PlannerError("This one is a surprise, no voting");
      if (!plan.options.includes(dishId)) throw new PlannerError("Not one of the options");
      await repo.upsertVote(c.q, date, MEAL, memberId, dishId); // one vote each; voting again changes it
      return { ok: true };
    });
  }

  /**
   * Cook's "can't make this", once per breakfast.
   * Today: locks the day on one new dish.
   * Tomorrow (not a surprise): replaces the leading option (highest votes, or the app's pick on a tie)
   * with a new dish and restarts voting.
   */
  reroll(memberId: string, date: string, token: string) {
    return this.run(async (c, now) => {
      const me = this.member(c, memberId);
      if (!me?.isCook) throw new PlannerError("Only the cook can do this", 403);
      await this.requirePhone(c, memberId, token);
      const today = istDate(now);
      if (date < today) throw new PlannerError("That day is over");
      const plan = await this.ensurePlan(c, date);
      await this.finalizeIfDue(c, plan, now);
      if (plan.rerollCount >= RULES.rerollsPerDay) {
        throw new PlannerError(`Already used all ${RULES.rerollsPerDay} re-rolls for this breakfast`, 409);
      }

      const restartVoting = date > today && !plan.surprise && !plan.final;
      const current = restartVoting
        ? tallyWinner(plan.options, plan.votes, plan.pick)
        : plan.final?.dishId ?? tallyWinner(plan.options, plan.votes, plan.pick);
      const hist = await repo.history(c.q, MEAL, date);
      const result = planDay(
        c.dishes, date, hist, c.weights,
        seededRng(`reroll:${date}:${current}`),
        restartVoting ? plan.options : [current, plan.pick], false,
      );
      if (!this.dish(c, current).surprise) {
        c.weights[current] = clamp((c.weights[current] ?? 1) * RULES.rejectPenalty);
        await repo.upsertWeight(c.q, current, c.weights[current]);
      }
      if (restartVoting) {
        await repo.replaceLeaderAndRestartVoting(c.q, date, MEAL, current, result.dish.id, memberId);
      } else {
        await repo.applyReroll(c.q, date, MEAL, current, result.dish.id, memberId);
      }
      return { ok: true };
    });
  }
}
