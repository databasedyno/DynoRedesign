// Navigable landing sections (order = page order). `id` is the DOM anchor,
// `key` resolves to landing:v3.nav.<key>. Header/footer hash links reuse the ids.
export const LANDING_SECTIONS = [
  { id: "how-it-works", key: "howitworks" },
  { id: "use-cases", key: "usecases" },
  { id: "features", key: "features" },
  { id: "why-dynopay", key: "why" },
  { id: "compare", key: "compare" },
  { id: "coins", key: "coins" },
  { id: "developers", key: "developers" },
  { id: "more", key: "more" },
  { id: "faq", key: "faq" },
] as const;

export type LandingSectionId = (typeof LANDING_SECTIONS)[number]["id"];

export const LANDING_SECTION_IDS: readonly string[] = LANDING_SECTIONS.map((s) => s.id);

// Space reserved for the fixed header (+ a little air) when jumping to a section.
export const JUMP_OFFSET_PX = 96;

export const jumpToSection = (id: string) => {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const top = el.getBoundingClientRect().top + window.scrollY - JUMP_OFFSET_PX;
  window.scrollTo({ top: Math.max(0, top), behavior: reduce ? "auto" : "smooth" });
};
