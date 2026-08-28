import sequelize from "../../utils/dbInstance";

/**
 * Session 36 invoice semantic cleanup (2026-07-12).
 *
 * Adds two nullable columns to `tbl_invoice`:
 *   - `transaction_amount` DECIMAL(18,8) — the GROSS transaction amount this
 *     invoice relates to (informational context). NULL on legacy v1 rows.
 *   - `invoice_version` VARCHAR(10) — "v1" legacy (unit_price == tx amount)
 *     or "v2" bookkeeping-correct (unit_price == service fee only). NULL
 *     rows are treated as v1 by the renderer.
 *
 * Additive / idempotent. Legacy rows are LEFT UNTOUCHED — they will still
 * render via the v1 code path. All new auto-generated invoices from this
 * deploy onward will be v2.
 */
async function addInvoiceTransactionAmount() {
  try {
    await sequelize.query(
      `ALTER TABLE tbl_invoice ADD COLUMN IF NOT EXISTS transaction_amount DECIMAL(18,8)`
    );
    await sequelize.query(
      `ALTER TABLE tbl_invoice ADD COLUMN IF NOT EXISTS invoice_version VARCHAR(10)`
    );
    // Back-tag existing rows as v1 so we can distinguish them at read time
    // without having to guess based on column presence.
    await sequelize.query(
      `UPDATE tbl_invoice SET invoice_version = 'v1' WHERE invoice_version IS NULL`
    );
    console.log("✅ tbl_invoice: transaction_amount + invoice_version columns added; legacy rows tagged v1");
  } catch (error: unknown) {
    const err = error as { message?: string };
    if (err.message?.includes("already exists") || err.message?.includes("duplicate")) {
      console.log("✅ Invoice v2 columns already exist");
    } else {
      console.error("❌ Error:", err.message);
      process.exit(1);
    }
  }
  process.exit(0);
}

addInvoiceTransactionAmount();
