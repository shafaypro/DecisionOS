/**
 * Captures README screenshots from the running dev server using the system
 * Chrome via playwright-core (no browser download). Logs in as the seeded
 * demo admin, then snaps each page at 1440x900.
 *
 * Usage: npx tsx scripts/capture-screenshots.mts [baseUrl]
 * Requires: dev server running (default http://localhost:3001), seeded db.
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import path from "node:path";

const BASE = process.argv[2] ?? "http://localhost:3001";
const OUT = path.join(process.cwd(), "docs", "screenshots");
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const SHOTS: { file: string; url: string; waitFor?: string }[] = [
  { file: "02-dashboard.png", url: "/dashboard" },
  { file: "03-decisions-list.png", url: "/decisions" },
  { file: "04-decision-detail.png", url: "__FIRST_DECISION__" },
  { file: "05-new-decision.png", url: "/decisions/new" },
  { file: "06-decision-graph.png", url: "/graph" },
];

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });

  // Landing page first - it must be captured logged-out.
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, "01-landing.png") });
  console.log("captured 01-landing.png (/)");

  // Log in as the seeded demo admin.
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', "admin@acme.demo");
  await page.fill('input[type="password"]', "password123");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|decisions)/, { timeout: 15000 });

  // Resolve a real decision id for the detail shot.
  await page.goto(`${BASE}/decisions`, { waitUntil: "networkidle" });
  const firstDecision = await page.getAttribute('a[href^="/decisions/c"]', "href");

  for (const shot of SHOTS) {
    const url = shot.url === "__FIRST_DECISION__" ? firstDecision : shot.url;
    if (!url) {
      console.warn(`skip ${shot.file}: no target url`);
      continue;
    }
    await page.goto(`${BASE}${url.startsWith("http") ? "" : ""}${url}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(600); // let entrance animations settle
    await page.screenshot({ path: path.join(OUT, shot.file) });
    console.log(`captured ${shot.file} (${url})`);
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
