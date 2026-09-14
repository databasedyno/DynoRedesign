/* Read-only VIES + reverse-charge verification (backlog #1). Does NOT create
 * any product order — only exercises verifyVatId()/calculateTax() and the
 * benign tbl_vat_validation cache. Run: ts-node scripts/test_vies_tax.ts */
import "dotenv/config";
import { verifyVatId, calculateTax } from "../controller/payment/taxService";
import { vatValidationModel } from "../models";

const j = (o: unknown) => JSON.stringify(o);

async function main() {
  console.log("=== 1. Format-invalid VAT ===");
  const bad = await verifyVatId("XX999", "FR");
  console.log("verifyVatId(XX999):", j(bad));

  console.log("\n=== 2. Valid-format real EU VAT (live VIES via provider) ===");
  const candidates = ["IE6388047V", "LU26375245", "DE143593636"];
  let goodVat = "";
  let goodCountry = "";
  for (const c of candidates) {
    const r = await verifyVatId(c, "FR");
    console.log(`verifyVatId(${c}):`, j(r));
    if (r.valid && !goodVat) {
      goodVat = r.normalized;
      goodCountry = r.countryCode || "";
    }
  }

  console.log("\n=== 3. calculateTax cross-border B2B (merchant FR, buyer valid EU VAT) → expect reverse_charge ===");
  if (goodVat) {
    const rc = await calculateTax({
      countryCode: goodCountry,
      amount: 100,
      currency: "EUR",
      merchantCountry: "FR",
      customerVatId: goodVat,
      taxCategory: "digital",
    });
    console.log("result:", j(rc));
    console.log(`ASSERT reverse_charge=true tax=0 vies_valid=true source=api? => reverse_charge=${rc?.reverse_charge} tax=${rc?.tax_amount} vies_valid=${rc?.vies_valid} src=${rc?.vies_source} checkedAt=${rc?.vies_checked_at}`);
  } else {
    console.log("!! No provider-valid VAT among candidates — cannot assert positive reverse-charge path. (Provider may be rate-limited or numbers no longer valid.)");
  }

  console.log("\n=== 4. calculateTax with INVALID VAT (merchant FR, buyer DE) → expect VAT charged, no reverse_charge ===");
  const inv = await calculateTax({
    countryCode: "DE",
    amount: 100,
    currency: "EUR",
    merchantCountry: "FR",
    customerVatId: "DE000000000",
    taxCategory: "digital",
  });
  console.log("result:", j(inv));
  console.log(`ASSERT reverse_charge=false tax>0? => reverse_charge=${inv?.reverse_charge} tax=${inv?.tax_amount} rate=${inv?.tax_rate}`);

  console.log("\n=== 5. calculateTax same-country (merchant DE, valid DE VAT) → NOT cross-border → VAT charged ===");
  if (goodVat && goodCountry) {
    const sc = await calculateTax({
      countryCode: goodCountry,
      amount: 100,
      currency: "EUR",
      merchantCountry: goodCountry, // same as buyer country
      customerVatId: goodVat,
      taxCategory: "digital",
    });
    console.log("result:", j(sc));
    console.log(`ASSERT reverse_charge=false (same country) => reverse_charge=${sc?.reverse_charge} tax=${sc?.tax_amount}`);
  } else {
    console.log("(skipped — no valid VAT)");
  }

  console.log("\n=== 6. tbl_vat_validation cache rows written ===");
  const rows = (await vatValidationModel.findAll({ order: [["checked_at", "DESC"]], limit: 5 })) as Array<{ dataValues: Record<string, unknown> }>;
  for (const r of rows) {
    const d = r.dataValues;
    console.log(`  ${d.vat_id} valid=${d.valid} source=${d.source} company=${d.company_name ?? "-"} checked_at=${d.checked_at}`);
  }

  process.exit(0);
}

main().catch((e) => {
  console.error("SCRIPT ERROR:", e);
  process.exit(1);
});
