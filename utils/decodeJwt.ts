/**
 * Decode a JWT payload (base64url) WITHOUT verifying the signature.
 * Client-safe and dependency-free — keeps the heavy Node `jsonwebtoken` lib (and
 * its Buffer polyfill) out of the browser bundle. Signature verification stays
 * server-side. Mirrors `jwt.decode(token)` (returns the payload or null).
 */
export function decodeJwt<T = Record<string, unknown>>(
  token: string | null | undefined,
): T | null {
  try {
    const part = (token ?? "").split(".")[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

export default decodeJwt;
