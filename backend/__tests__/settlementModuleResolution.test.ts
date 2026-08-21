/**
 * Regression guard for the 2026-08-21 settlement outage.
 *
 * ROOT CAUSE: when the crypto-settlement code was refactored into the deeper
 * `controller/payment/settlement/` folder, several LAZY `require("../../services/…")`
 * calls kept the old 2-level path. From the new location the correct path is
 * `../../../services/…`. Because these are runtime require() string literals (not
 * static imports), `tsc` never validated them — the build was clean but every
 * merchant-pool settlement threw `Cannot find module '../../services/paymentReliability'`
 * (MODULE_NOT_FOUND) at runtime, leaving payments stuck at "Awaiting Confirmation".
 *
 * This test statically validates that EVERY relative require()/import() string in the
 * settlement modules resolves to a real file on disk, so an off-by-one path can never
 * ship again.
 */
import * as fs from "fs";
import * as path from "path";

const SETTLEMENT_DIR = path.join(__dirname, "..", "controller", "payment", "settlement");

/** Extract every relative module path from require("…") and import("…") calls. */
function extractRelativeSpecifiers(src: string): string[] {
  const specs: string[] = [];
  const re = /(?:require|import)\(\s*["'](\.[^"']+)["']\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) specs.push(m[1]);
  return specs;
}

/** True if a relative specifier resolves to a real file (ts/js/index) from `fromFile`. */
function resolves(fromFile: string, spec: string): boolean {
  const base = path.resolve(path.dirname(fromFile), spec);
  const candidates = [
    base,
    base + ".ts",
    base + ".js",
    path.join(base, "index.ts"),
    path.join(base, "index.js"),
  ];
  return candidates.some((c) => fs.existsSync(c));
}

describe("settlement module relative paths resolve", () => {
  const files = fs
    .readdirSync(SETTLEMENT_DIR)
    .filter((f) => f.endsWith(".ts"))
    .map((f) => path.join(SETTLEMENT_DIR, f));

  it("finds the settlement source files", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    it(`all relative require()/import() in ${path.basename(file)} point to real files`, () => {
      const src = fs.readFileSync(file, "utf8");
      const specs = extractRelativeSpecifiers(src);
      const broken = specs.filter((s) => !resolves(file, s));
      expect(broken).toEqual([]);
    });
  }

  it("no settlement file uses the buggy 2-level ../../services/ require (must be ../../../services/)", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const src = fs.readFileSync(file, "utf8");
      if (/require\(\s*["']\.\.\/\.\.\/services\//.test(src)) {
        offenders.push(path.basename(file));
      }
    }
    expect(offenders).toEqual([]);
  });

  it("paymentReliability + tronEnergyService resolve from settleTransaction.ts", () => {
    const f = path.join(SETTLEMENT_DIR, "settleTransaction.ts");
    expect(resolves(f, "../../../services/paymentReliability")).toBe(true);
    expect(resolves(f, "../../../services/tronEnergyService")).toBe(true);
    // the old buggy path must NOT resolve
    expect(resolves(f, "../../services/paymentReliability")).toBe(false);
  });
});
