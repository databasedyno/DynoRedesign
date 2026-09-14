// Frontend exact-rounding helper checks. Run: node tests/unit/money.test.mjs
// (compiles utils/money.ts on the fly with the local TypeScript compiler)
import { execSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = mkdtempSync(join(tmpdir(), "money-"));
execSync(`node_modules/.bin/tsc utils/money.ts --target es2020 --module es2020 --types --skipLibCheck --outDir ${out} || true`, { cwd: new URL("../..", import.meta.url).pathname, stdio: "inherit" });
const { toFixedStr, toNumber, toPlainDecimal, trimZeros, formatExact } = await import(join(out, "money.js"));

const cases = [
  [toFixedStr(1.005, 2), "1.01"], [toFixedStr("1.005", 2), "1.01"], [toFixedStr(0.1 + 0.2, 8), "0.30000000"],
  [toFixedStr(1e-7, 8), "0.00000010"], [toFixedStr("2.5e3", 2), "2500.00"], [toFixedStr(-1.005, 2), "-1.01"],
  [toFixedStr(0.123456789, 8, "down"), "0.12345678"], [toFixedStr(0.129, 2, "up"), "0.13"], [toFixedStr(null, 2), "0.00"],
  [toFixedStr("abc", 2), "0.00"], [toFixedStr(1234.5, 0), "1235"], [toFixedStr(-0.001, 2), "0.00"], [toFixedStr("0.00033163515000000004", 8), "0.00033164"],
  [toNumber("19.999", 2), 20], [trimZeros(toFixedStr(25, 8)), "25"], [trimZeros(toFixedStr("0.001", 8)), "0.001"],
  [toPlainDecimal(1e21), "1000000000000000000000"], [formatExact("1234567.891", 2), "1,234,567.89"], [formatExact(1.005, 2, { style: "currency", currency: "USD" }), "$1.01"],
];
let bad = 0;
for (const [got, exp] of cases) if (got !== exp) { bad++; console.log("FAIL", JSON.stringify(got), "!=", JSON.stringify(exp)); }
console.log(bad ? `${bad} failures` : `all ${cases.length} passed`);
process.exit(bad ? 1 : 0);
