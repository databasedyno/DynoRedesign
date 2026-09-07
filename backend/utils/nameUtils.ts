/**
 * Name helpers — the single source of truth for turning a person's name into
 * the stored `first_name` / `last_name` columns and back into a display string.
 *
 * Product decision 2026-09-07: every merchant is stored with a combined `name`
 * ("First Last") AND, since the "Split Name Fields" change, discrete
 * `first_name` / `last_name` columns so we can greet "Hi John" and sort by last
 * name. These helpers keep all three consistent no matter which signup path
 * (email OTP, phone, Google, GitHub) or edit surface (profile, NameGate) is used.
 */

export interface NameParts {
  first_name: string | null;
  last_name: string | null;
}

export interface DerivedName extends NameParts {
  /** Combined "First Last" (collapsed whitespace). null when nothing was given. */
  full_name: string | null;
}

/** Collapse runs of whitespace and trim. */
const clean = (v?: string | null): string =>
  (v || "").replace(/\s+/g, " ").trim();

/**
 * Split a combined full name into { first_name, last_name }.
 * - First whitespace-delimited token → first_name.
 * - Everything after it → last_name (may itself contain spaces, e.g. "van Gogh").
 * - Single-word names → first_name only, last_name null.
 * - Empty / blank → both null.
 */
export const splitFullName = (full?: string | null): NameParts => {
  const value = clean(full);
  if (!value) return { first_name: null, last_name: null };
  const spaceIdx = value.indexOf(" ");
  if (spaceIdx === -1) return { first_name: value, last_name: null };
  return {
    first_name: value.slice(0, spaceIdx),
    last_name: value.slice(spaceIdx + 1).trim() || null,
  };
};

/**
 * Derive a consistent { first_name, last_name, full_name } from whatever a
 * caller has: structured first/last inputs take precedence; otherwise a
 * combined name is split. Returns nulls when nothing usable was provided.
 */
export const deriveNameParts = (opts: {
  first?: string | null;
  last?: string | null;
  full?: string | null;
}): DerivedName => {
  const first = clean(opts.first);
  const last = clean(opts.last);
  if (first || last) {
    return {
      first_name: first || null,
      last_name: last || null,
      full_name: `${first} ${last}`.replace(/\s+/g, " ").trim() || null,
    };
  }
  const parts = splitFullName(opts.full);
  return { ...parts, full_name: clean(opts.full) || null };
};
