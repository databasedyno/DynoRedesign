/**
 * REVERSIBLE end-to-end test for the individual -> business upgrade.
 *
 * Creates a THROWAWAY individual company for the test owner (user_id=1), calls
 * the real HTTP endpoint (PUT /api/company/upgrade-to-business/:id) with a Bearer
 * token to flip it to business, asserts the write, then DELETES the scratch row.
 * No real merchant data is touched; the scratch company never has transactions.
 *
 * Run:  cd /app/backend && TOKEN=<jwt> npx ts-node scripts/verify_upgrade_business.ts
 */
import "dotenv/config";
import companyModel from "../models/companyModels/companyModel";

const BASE = "http://localhost:8001";
const USER_ID = 1;
const TOKEN = process.env.TOKEN || "";

async function main() {
  if (!TOKEN) throw new Error("Set TOKEN env (owner JWT for user_id=1)");

  let scratchId: number | null = null;
  try {
    const created: any = await companyModel.create({
      user_id: USER_ID,
      company_name: "__scratch_upgrade_test",
      email: "scratch@dynopaytest.com",
      account_type: "individual",
    } as any);
    scratchId = created?.dataValues?.company_id ?? created?.company_id;
    console.log("CREATED scratch individual company_id =", scratchId, "account_type=individual");

    // Positive flip
    const res = await fetch(`${BASE}/api/company/upgrade-to-business/${scratchId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({
        company_name: "Scratch Biz LLC",
        country: "US",
        website: "https://scratch.example.com",
        vat_number: "",
      }),
    });
    const body: any = await res.json();
    console.log("HTTP", res.status, "message=", body?.message);

    // Read back from DB (source of truth)
    const row: any = await companyModel.findOne({ where: { company_id: scratchId } });
    const d = row?.dataValues || {};
    console.log("DB after flip:", {
      account_type: d.account_type,
      company_name: d.company_name,
      country: d.country,
      website: d.website,
    });

    const ok =
      res.status === 200 &&
      String(d.account_type).toLowerCase() === "business" &&
      d.company_name === "Scratch Biz LLC" &&
      String(d.country).toUpperCase() === "US" &&
      d.website === "https://scratch.example.com";
    console.log(ok ? "POSITIVE FLIP: PASS ✅" : "POSITIVE FLIP: FAIL ❌");

    // Idempotency: second call should now 400 (already business)
    const res2 = await fetch(`${BASE}/api/company/upgrade-to-business/${scratchId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ company_name: "Scratch Biz LLC", country: "US" }),
    });
    const body2: any = await res2.json();
    console.log("SECOND CALL:", res2.status, body2?.message, res2.status === 400 ? "PASS ✅" : "FAIL ❌");
  } finally {
    if (scratchId) {
      const n = await companyModel.destroy({ where: { company_id: scratchId } });
      console.log(`CLEANUP: deleted scratch company_id=${scratchId} (rows=${n})`);
    }
  }
  process.exit(0);
}

main().catch((e) => {
  console.error("ERROR:", e?.message || e);
  process.exit(1);
});
