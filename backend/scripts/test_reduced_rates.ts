/* Read-only reduced/zero VAT verification (backlog #5). Exercises calculateTax
 * with tax treatments — no orders created. Run: ts-node scripts/test_reduced_rates.ts */
import "dotenv/config";
import { calculateTax } from "../controller/payment/taxService";
import { resolveReducedRate } from "../utils/reducedRates";

const run = async (label: string, input: any) => {
  const r = await calculateTax(input);
  console.log(`${label}: rate=${r?.tax_rate}% tax=${r?.tax_amount} treatment=${r?.tax_treatment} cat=${r?.reduced_category ?? "-"} exempt=${r?.exempt_reason ?? "-"}`);
};

async function main() {
  console.log("=== resolveReducedRate spot checks ===");
  console.log("DE ebooks (std19):", resolveReducedRate("DE", "ebooks", 19), "(expect 7)");
  console.log("FR ebooks (std20):", resolveReducedRate("FR", "ebooks", 20), "(expect 5.5)");
  console.log("IE ebooks (std23):", resolveReducedRate("IE", "ebooks", 23), "(expect 0)");
  console.log("DE general (std19):", resolveReducedRate("DE", "general", 19), "(expect 7)");
  console.log("DK general (std25):", resolveReducedRate("DK", "general", 25), "(expect 25 fallback)");
  console.log("XX general (std10):", resolveReducedRate("XX", "general", 10), "(expect 10 fallback)");

  console.log("\n=== calculateTax treatments (amount 100) ===");
  await run("DE standard digital", { countryCode: "DE", amount: 100, currency: "EUR", taxTreatment: "standard" });
  await run("DE reduced ebooks   ", { countryCode: "DE", amount: 100, currency: "EUR", taxTreatment: "reduced", reducedCategory: "ebooks" });
  await run("FR reduced ebooks   ", { countryCode: "FR", amount: 100, currency: "EUR", taxTreatment: "reduced", reducedCategory: "ebooks" });
  await run("IE reduced ebooks(0)", { countryCode: "IE", amount: 100, currency: "EUR", taxTreatment: "reduced", reducedCategory: "ebooks" });
  await run("DE zero-rated       ", { countryCode: "DE", amount: 100, currency: "EUR", taxTreatment: "zero" });
  await run("DE reduced general  ", { countryCode: "DE", amount: 100, currency: "EUR", taxTreatment: "reduced", reducedCategory: "general" });
  await run("DE exempt category  ", { countryCode: "DE", amount: 100, currency: "EUR", taxCategory: "exempt", taxTreatment: "reduced", reducedCategory: "ebooks" });
  process.exit(0);
}
main().catch((e) => { console.error("ERR", e); process.exit(1); });
