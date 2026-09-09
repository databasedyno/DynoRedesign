/**
 * Brand/company name display sanitiser (frontend).
 *
 * Defensive companion to the backend `validateBrandName` guard: legacy rows
 * created before that guard existed can still hold markup like
 * `<script>1</script>`. React renders it safely (as text) but it looks broken
 * — and CSS `text-transform:capitalize` turns it into "<Script>1</Script>".
 * This decodes basic HTML entities and strips any tags so the name always
 * shows as plain, human-readable text. A normal name is returned unchanged.
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

function decodeBasicEntities(input: string): string {
  let s = input;
  s = s.replace(/&#(\d+);/g, (_m, n) => {
    try {
      return String.fromCodePoint(Number(n));
    } catch {
      return _m;
    }
  });
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
  return s.split("&amp;").join("&");
}

/** Decode entities, strip HTML tags, collapse whitespace. Safe for any string. */
export function sanitizeBrandName(input: unknown): string {
  const decoded = decodeBasicEntities(String(input ?? ""));
  const stripped = decoded.replace(/<[^>]*>/g, "");
  const clean = stripped.replace(/\s+/g, " ").trim();
  return clean;
}

export default sanitizeBrandName;
