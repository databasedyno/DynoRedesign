/**
 * Brand (company) name validation.
 *
 * WHY: A brand named `<script>1</script>` was able to reach the DB and then
 * render in the UI as literal markup ("<Script>1</Script>" once CSS
 * text-transform:capitalize ran). The global xss() middleware HTML-escapes
 * request strings, so such a payload can arrive at the controller either raw
 * (`<script>…`) or escaped (`&lt;script&gt;…`). Both forms must be rejected so
 * a brand name is always plain, human-readable text.
 */

const NAMED_ENTITIES: Record<string, string> = {
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&#39;": "'",
  "&#039;": "'",
  "&#x27;": "'",
  "&#x2f;": "/",
  "&#x2F;": "/",
};

/** Decode the small set of HTML entities the xss() middleware can introduce. */
export function decodeBasicEntities(input: unknown): string {
  let s = String(input ?? "");
  // Decimal numeric entities (&#60; etc.)
  s = s.replace(/&#(\d+);/g, (_m, n) => {
    try {
      return String.fromCodePoint(Number(n));
    } catch {
      return _m;
    }
  });
  // Hex numeric entities (&#x3c; etc.)
  s = s.replace(/&#x([0-9a-f]+);/gi, (_m, h) => {
    try {
      return String.fromCodePoint(parseInt(h, 16));
    } catch {
      return _m;
    }
  });
  for (const [ent, chr] of Object.entries(NAMED_ENTITIES)) {
    s = s.split(ent).join(chr);
  }
  // &amp; last so it doesn't double-decode the entities above.
  s = s.split("&amp;").join("&");
  return s;
}

export const MAX_BRAND_NAME_LENGTH = 120;

export type BrandNameResult = { ok: boolean; message?: string; value?: string };

/**
 * Validate a brand/company name. Rejects HTML/markup (raw `<`/`>` or the
 * escaped `&lt;`/`&gt;` / numeric forms) and empty/over-long names.
 * Returns the decoded, trimmed value on success (does NOT mutate storage).
 */
export function validateBrandName(input: unknown): BrandNameResult {
  const raw = String(input ?? "");
  const decoded = decodeBasicEntities(raw).trim();

  if (!decoded) {
    return { ok: false, message: "Please enter a valid brand name." };
  }
  // Angle brackets in decoded text, or their escaped/numeric forms in the raw
  // input, indicate HTML/markup and are never valid in a brand name.
  const hasMarkup =
    /[<>]/.test(decoded) ||
    /&lt;|&gt;/i.test(raw) ||
    /&#0*(?:60|62);/.test(raw) ||
    /&#x0*3[cCeE];/i.test(raw);
  if (hasMarkup) {
    return {
      ok: false,
      message: "Brand name can't contain HTML or the characters < or >.",
    };
  }
  if (decoded.length > MAX_BRAND_NAME_LENGTH) {
    return {
      ok: false,
      message: `Brand name must be ${MAX_BRAND_NAME_LENGTH} characters or fewer.`,
    };
  }
  return { ok: true, value: decoded };
}
