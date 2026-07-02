import { assert, assertEqual } from "./run";
import {
  slugify,
  formatDate,
  formatRelativeDate,
  memoryScoreTone,
  blastRadiusTone,
  getLabelForValue,
  CATEGORIES,
  STATUSES,
  RELATION_TYPES,
} from "../../src/lib/utils";

/**
 * `utils.ts` is one of the most-imported files in the UI. Bugs here surface
 * in every list, badge, and date label, so we cover the surprising edges:
 * empty strings, accented characters, threshold boundaries, unknown values.
 */
export const utilsTests = {
  "slugify: lowercases and collapses non-alphanumerics"() {
    assertEqual(slugify("Hello World"), "hello-world");
    assertEqual(slugify("Hiring Plan Q3"), "hiring-plan-q3");
    assertEqual(slugify("multiple   spaces"), "multiple-spaces");
    assertEqual(slugify("dashes--already--here"), "dashes-already-here");
  },

  "slugify: trims edge dashes and handles symbol-only input"() {
    assertEqual(slugify("---hello---"), "hello");
    assertEqual(slugify("!!!"), "", "all-punctuation input must collapse to empty");
    assertEqual(slugify(""), "");
  },

  "slugify: accented and non-ascii characters are stripped"() {
    // We don't normalise unicode - anything outside [a-z0-9] becomes a dash,
    // so accents and CJK both collapse. Documented behaviour, not a bug.
    assertEqual(slugify("Café"), "caf");
    assertEqual(slugify("日本語"), "");
  },

  "formatDate: null/undefined return the em-dash placeholder"() {
    assertEqual(formatDate(null), "-");
    assertEqual(formatDate(undefined), "-");
  },

  "formatDate: real dates render in 'MMM d, yyyy'"() {
    const fixed = new Date("2025-03-14T12:00:00Z");
    const out = formatDate(fixed);
    // Don't assert the exact day - that depends on the runner's tz.
    // Assert the shape so a regression in the format string is caught.
    assert(/^[A-Z][a-z]{2} \d{1,2}, \d{4}$/.test(out), `unexpected format: ${out}`);
  },

  "formatRelativeDate: null/undefined return the em-dash placeholder"() {
    assertEqual(formatRelativeDate(null), "-");
    assertEqual(formatRelativeDate(undefined), "-");
  },

  "formatRelativeDate: real dates contain 'ago' or 'in'"() {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const out = formatRelativeDate(past);
    assert(out.includes("ago") || out.includes("day"), `unexpected output: ${out}`);
  },

  "memoryScoreTone: covers the 0/34/67/100 thresholds"() {
    assert(memoryScoreTone(0).includes("red"));
    assert(memoryScoreTone(33).includes("red"));
    assert(memoryScoreTone(34).includes("amber"));
    assert(memoryScoreTone(66).includes("amber"));
    assert(memoryScoreTone(67).includes("green"));
    assert(memoryScoreTone(100).includes("green"));
  },

  "blastRadiusTone: 0/1 are quiet, 2-4 are warning, 5+ are alarm"() {
    assert(blastRadiusTone(0).includes("slate"));
    assert(blastRadiusTone(1).includes("slate"));
    assert(blastRadiusTone(2).includes("amber"));
    assert(blastRadiusTone(4).includes("amber"));
    assert(blastRadiusTone(5).includes("rose"));
    assert(blastRadiusTone(50).includes("rose"));
  },

  "getLabelForValue: returns the human label when matched"() {
    assertEqual(getLabelForValue(CATEGORIES, "engineering"), "Engineering");
    assertEqual(getLabelForValue(STATUSES, "approved"), "Approved");
    assertEqual(getLabelForValue(RELATION_TYPES, "supersedes"), "Supersedes");
  },

  "getLabelForValue: unknown values fall back to the raw value"() {
    // Important - legacy or future enum values shouldn't crash the UI.
    assertEqual(getLabelForValue(STATUSES, "nonexistent_status"), "nonexistent_status");
    assertEqual(getLabelForValue(CATEGORIES, ""), "");
  },
};
