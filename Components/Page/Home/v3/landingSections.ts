// Navigable landing sections (order = page order, §2.3 of the v6 proposal). `id` is the DOM anchor,
// `key` resolves to landing:v3.nav.<key>. Header/footer hash links reuse the ids.
export const LANDING_SECTIONS = [
  { id: "products", key: "products" },
  { id: "how-it-works", key: "howitworks" },
  { id: "coins", key: "global" },
  { id: "developers", key: "developers" },
  { id: "pricing", key: "pricing" },
  { id: "security", key: "security" },
  { id: "faq", key: "faq" },
] as const;

export type LandingSectionId = (typeof LANDING_SECTIONS)[number]["id"];

export const LANDING_SECTION_IDS: readonly string[] = LANDING_SECTIONS.map((s) => s.id);

// Space reserved for the fixed header (+ the chip bar) when jumping to a section.
export const JUMP_OFFSET_PX = 120;

export const jumpToSection = (id: string) => {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const top = el.getBoundingClientRect().top + window.scrollY - JUMP_OFFSET_PX;
  window.scrollTo({ top: Math.max(0, top), behavior: reduce ? "auto" : "smooth" });
};
