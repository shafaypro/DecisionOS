#!/usr/bin/env node
/**
 * Local dev database setup (SQLite).
 *
 * Production targets PostgreSQL, but Prisma v7 locks the *generated client* to the
 * schema's `provider`. So to run locally on SQLite you need a generate pass against
 * a SQLite-flavored schema. This script derives that schema from the committed
 * Postgres one (so they never drift), regenerates the client, and syncs dev.db.
 *
 * Wired as a `predev` hook → `npm run dev` just works locally on SQLite.
 *
 * Prefer Postgres locally instead? Set a postgres:// DATABASE_URL (e.g. via
 * `docker compose up -d`); this script then no-ops and you use the committed schema.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = resolve(root, "prisma/schema.prisma");
const derived = resolve(root, "prisma/dev-sqlite.prisma");

const url = process.env.DATABASE_URL ?? "file:./dev.db";
if (url.startsWith("postgres")) {
  console.log("[dev-db] DATABASE_URL is Postgres - using the committed schema, skipping SQLite setup.");
  process.exit(0);
}

const schema = readFileSync(src, "utf8").replace(
  /provider\s*=\s*"postgresql"/,
  'provider = "sqlite"'
);
writeFileSync(derived, schema);

const run = (cmd) => execSync(cmd, { cwd: root, stdio: "inherit" });

// Generate the SQLite-flavored client (must succeed - the app imports it).
run(`npx prisma generate --schema "${derived}"`);

// Best-effort: keep dev.db in sync with the models. Don't abort dev start on failure.
try {
  run(`npx prisma db push --schema "${derived}" --accept-data-loss`);
} catch {
  console.warn("[dev-db] db push skipped/failed - continuing with the existing dev.db.");
}

console.log("[dev-db] SQLite client ready for local dev.");
