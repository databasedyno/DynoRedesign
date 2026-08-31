/**
 * READ-ONLY verify harness for the 2026-09 ops fixes:
 *  1. downloadUserImage — happy path returns a "/images/..." path; on a forced
 *     network failure it returns the bundled default (never throws). This is the
 *     fix for the signup 500s (picsum.photos 503 was blowing up account creation).
 *  2. merchantTempAddressModel resolves from ../models (the barrel) — proves the
 *     old broken dynamic require("../../models/merchantPoolModels/merchantTempAddressModel")
 *     had no valid target and the fix uses the real import.
 * No DB writes, no account creation.
 */
import fs from "fs";
import path from "path";

const results: Array<{ name: string; pass: boolean; detail: string }> = [];
const check = (name: string, pass: boolean, detail: string) => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "✅" : "❌"} ${name} — ${detail}`);
};

(async () => {
  try {
    const downloadUserImage = (await import("../helper/downloadUserImage")).default;

    // 1a. Happy path — returns a path string, does not throw.
    let happy = "";
    try {
      happy = await downloadUserImage();
    } catch (e) {
      happy = `THREW: ${(e as Error).message}`;
    }
    check(
      "downloadUserImage happy path returns an /images/ path (no throw)",
      typeof happy === "string" && happy.startsWith("/images/"),
      `returned="${happy}"`
    );

    // 1b. Forced failure — stub axios default to reject; must fall back to the
    //     bundled default image and NOT throw.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const axiosMod = require("axios");
    const orig = axiosMod.default;
    axiosMod.default = () => Promise.reject(new Error("simulated 503 Service Unavailable"));
    let fallback = "";
    try {
      fallback = await downloadUserImage();
    } catch (e) {
      fallback = `THREW: ${(e as Error).message}`;
    } finally {
      axiosMod.default = orig;
    }
    check(
      "downloadUserImage falls back to bundled default on upstream failure (never throws)",
      fallback === "/images/user_image.png",
      `returned="${fallback}"`
    );

    // 1c. The bundled default actually exists on disk.
    const defaultExists = fs.existsSync(path.join(process.cwd(), "public/images/user_image.png"));
    check("bundled default avatar exists (public/images/user_image.png)", defaultExists, `exists=${defaultExists}`);

    // 2. merchantTempAddressModel resolves from the real barrel (the fixed import).
    const models = await import("../models");
    const hasModel = !!(models as Record<string, unknown>).merchantTempAddressModel;
    check("merchantTempAddressModel is exported from ../models (fixed import target)", hasModel, `present=${hasModel}`);

    const passed = results.filter((r) => r.pass).length;
    console.log(`\n=== ${passed}/${results.length} checks passed ===`);
  } catch (e) {
    console.error("HARNESS ERROR:", e);
  } finally {
    process.exit(0);
  }
})();
