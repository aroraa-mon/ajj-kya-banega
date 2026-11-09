import { createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Queryable } from "./db.js";
import type { Member } from "./types.js";

const N = 16384;
const R = 8;
const P = 1;

/** scrypt hash, with the parameters and salt stored alongside it. */
export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pin, salt, 32, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function pinOk(pin: string, stored: string | null): boolean {
  if (!stored || !/^\d{4}$/.test(pin)) return false;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, "base64");
  const actual = scryptSync(pin, Buffer.from(saltB64, "base64"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Reads data/pins.json. Creates it, with a fresh 4-digit PIN per member, the first time. */
export function loadOrCreatePins(root: string, members: Member[]): Record<string, string> {
  const file = path.join(root, "data", "pins.json");
  if (existsSync(file)) {
    const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("data/pins.json must be an object of member id to PIN");
    }
    return parsed as Record<string, string>;
  }
  const used = new Set<string>();
  const pins: Record<string, string> = {};
  for (const m of members) {
    let pin = "";
    do {
      pin = String(randomInt(0, 10000)).padStart(4, "0");
    } while (used.has(pin));
    used.add(pin);
    pins[m.id] = pin;
  }
  writeFileSync(file, JSON.stringify(pins, null, 2) + "\n", { mode: 0o600 });
  console.log("Created data/pins.json. Share each PIN only with that person:");
  for (const m of members) console.log(`  ${m.name}: ${pins[m.id]}`);
  return pins;
}

/**
 * Stores a hash for each member who doesn't have one yet.
 * With reset, rewrites every hash and forgets remembered phones.
 */
export async function applyPins(q: Queryable, members: Member[], pins: Record<string, string>, reset: boolean) {
  for (const m of members) {
    const pin = pins[m.id];
    if (typeof pin !== "string" || !/^\d{4}$/.test(pin)) {
      throw new Error(`PIN for ${m.name} (${m.id}) must be 4 digits in data/pins.json`);
    }
    const { rows } = await q.query<{ pin_hash: string | null }>("select pin_hash from members where id = $1", [m.id]);
    if (rows[0]?.pin_hash && !reset) continue;
    await q.query(
      "update members set pin_hash = $2, pin_fails = 0, pin_locked_until = null where id = $1",
      [m.id, hashPin(pin)],
    );
    await q.query("delete from device_tokens where member_id = $1", [m.id]);
  }
}
