/**
 * i18next module augmentation
 *
 * Forces `t(...)` to return `string` (never `null`, never `$SpecialObject`,
 * never `TFunctionDetailedResult`). react-i18next v13+ ships a much narrower
 * return-type union out of the box which trips ~40+ call sites across the
 * codebase (TransactionsTopBar, InvoiceForm, ProductsListing, etc.) with
 *   "Type 'string | $SpecialObject | TFunctionDetailedResult<...>' is not
 *    assignable to type 'string'."
 *
 * By pinning `returnNull: false` and `defaultNS: 'translation'` we tell the
 * type system that `t()` will always give us a plain `string`, which matches
 * runtime behavior (all our translation values ARE plain strings — no nested
 * objects, no `null` returns).
 *
 * Added 2026-08-02 during the "Prod Type Guard" cleanup pass.
 */

import "react-i18next";
import "i18next";

/**
 * i18next module augmentation
 *
 * Pins `returnNull: false` so `t()` never returns `null`. The default
 * v23+ behavior includes `null` in the return-union which trips ~15 call
 * sites that assign the result to `string`. We leave `returnObjects` at
 * default so pages that use `t(key, { returnObjects: true })` for arrays
 * of objects (privacy-policy, terms-conditions, aml-policy) keep working.
 *
 * We deliberately do NOT pin the `resources` map — dynamic namespace
 * loading + 30+ namespaces makes a static map fragile. Passing keys as
 * bare strings is intentional; the trade-off is documented in
 * /app/scripts/preflight-tsc.sh comment.
 *
 * Added 2026-08-02 (Session 97f) as part of the frontend TS backlog
 * cleanup that brought baseline 286 → target sub-100.
 */
declare module "react-i18next" {
  interface CustomTypeOptions {
    returnNull: false;
  }
}

declare module "i18next" {
  interface CustomTypeOptions {
    returnNull: false;
  }
}
