import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { PGlite } from "@electric-sql/pglite";

export interface Queryable {
  query<T = Record<string, any>>(sql: string, params?: unknown[]): Promise<{ rows: T[]; rowCount?: number | null }>;
}

export interface Database extends Queryable {
  /** Runs fn in one transaction. Everything is serialised: one writer at a time. */
  transaction<T>(fn: (q: Queryable) => Promise<T>): Promise<T>;
  /** Runs a multi-statement SQL script (schema). */
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const schemaSql = () => readFileSync(path.join(root, "db", "schema.sql"), "utf8");

/** Postgres, including Supabase (use its connection string as DATABASE_URL). */
export class PgDatabase implements Database {
  private pool: pg.Pool;
  constructor(url: string) {
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
    this.pool = new pg.Pool({
      connectionString: url,
      max: 5,
      // Supabase requires TLS. Its certificate chain isn't in Node's default store.
      ssl: local ? undefined : { rejectUnauthorized: false },
    });
  }
  query<T>(sql: string, params?: unknown[]) {
    return this.pool.query(sql, params as unknown[]) as unknown as Promise<{ rows: T[] }>;
  }
  async exec(sql: string) {
    await this.pool.query(sql);
  }
  async transaction<T>(fn: (q: Queryable) => Promise<T>): Promise<T> {
    const c = await this.pool.connect();
    try {
      await c.query("begin");
      await c.query("select pg_advisory_xact_lock(7731)");
      const result = await fn({ query: (sql, params) => c.query(sql, params as unknown[]) as any });
      await c.query("commit");
      return result;
    } catch (e) {
      await c.query("rollback").catch(() => undefined);
      throw e;
    } finally {
      c.release();
    }
  }
  close() {
    return this.pool.end();
  }
}

/** Real Postgres compiled to WASM: used for local runs without Supabase and for tests. */
export class PgliteDatabase implements Database {
  private db: PGlite;
  constructor(dataDir?: string) {
    this.db = new PGlite(dataDir);
  }
  query<T>(sql: string, params?: unknown[]) {
    return this.db.query<T>(sql, params as unknown[]);
  }
  async exec(sql: string) {
    await this.db.exec(sql);
  }
  transaction<T>(fn: (q: Queryable) => Promise<T>): Promise<T> {
    return this.db.transaction((tx) => fn({ query: (sql, params) => tx.query(sql, params as unknown[]) as any }));
  }
  close() {
    return this.db.close();
  }
}

/** DATABASE_URL set: Postgres/Supabase. Otherwise: a local database in data/pgdata. */
export function openDatabase(env: NodeJS.ProcessEnv = process.env): { db: Database; kind: "postgres" | "pglite" } {
  if (env.DATABASE_URL) return { db: new PgDatabase(env.DATABASE_URL), kind: "postgres" };
  return { db: new PgliteDatabase(path.join(root, "data", "pgdata")), kind: "pglite" };
}

/** Loads .env if present (Node 22+). */
export function loadEnv() {
  const file = path.join(root, ".env");
  if (existsSync(file)) process.loadEnvFile(file);
}
