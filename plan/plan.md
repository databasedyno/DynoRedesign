# Applying Emergent's Landing Design to DynoPay

Goal: take the things that make the Emergent landing feel clean and premium and
decide how far to carry them across DynoPay — end to end.

This builds on the change already in progress: Inter is now DynoPay's body/UI
font and the dark‑mode greys have been neutralised (less blue, cleaner).

---

## What the Emergent landing actually does (observations)

Typography
- Two typefaces: a **display font ("Brockmann")** for headlines and **Inter**
  for everything else (buttons, body, legal, labels).
- Big text uses **tight negative letter‑spacing** (roughly ‑1px to ‑1.6px) and a
  **medium/semibold** weight — not bold‑heavy.
- Headlines carry a **soft glow** (a faint text‑shadow) so they feel "lit" on
  the dark panel.

Colour
- A **semantic colour system** (foreground / background / muted / primary /
  ring) used consistently, with light **opacity tints** for subtle surfaces
  (e.g. a 5–10% foreground fill for secondary buttons).
- Greys are **clean neutral grey** (#808080 / #8a8a8a) — no blue/colour tint.

Buttons & inputs
- **Fully rounded ("pill") buttons**, generously tall (48–56px).
- Hover = **soft outer glow + a small lift** (moves up a few px), ~300ms ease.
- Inputs are also pill‑shaped with a clear focus ring.

Hero & layout
- **Split screen**: sign‑in on the left, an **animated gradient panel** on the
  right with **device mock‑ups** (phone + browser frames), a **glass "YC S24"
  badge**, a **"10M+ users"** social‑proof stat, dashed dividers, and **pill
  progress dots** for the carousel.
- Overall: the marketing/auth surface is **expressive and glowing**; the content
  is otherwise restrained and legible.

---

## Proposed adoption for DynoPay

The ideas are grouped by where they should apply, because DynoPay's dashboard is
deliberately calm ("Quiet Money") and data‑dense — some of Emergent's expressive
choices belong only on marketing/auth/checkout, not on the working dashboard.

### A. Universal — apply everywhere, including the dashboard
- **Inter** as the body/UI font (already in progress) — validated by Emergent.
- **Tighter letter‑spacing on large headings** for the premium look.
- **One clean neutral grey scale** (remove the blue tint) used consistently in
  both themes, still meeting accessibility contrast.
- **Consistent hover feel** on cards/buttons: subtle lift + soft shadow, smooth
  ~200–300ms transitions.
- Crisper text rendering (already in progress).

### B. Expressive — marketing landing, auth pages, and public checkout/receipt
- **Hero headlines**: larger, tighter tracking, a subtle glow, on the display
  font.
- **Primary hero/auth call‑to‑action buttons**: larger and more rounded (pill),
  with the glow + lift hover.
- **Animated gradient hero** on the marketing landing (an indigo→violet
  "aurora"), a **device / screenshot showcase**, **glassmorphism badges** for
  social proof, dashed dividers, and pill progress dots.
- Keep gradients and glows to these hero/primary areas only.

### C. Intentionally NOT copying (unless you say otherwise)
- **Not** turning the whole dashboard into pill buttons and heavy glows — that
  would undo the recent, deliberate "clean/calm dashboard" direction and hurt
  readability of dense data.
- **Not** licensing Emergent's exact display font ("Brockmann") — it is a paid
  commercial font. DynoPay's existing **Manrope** (free, already loaded) plays
  the same display role.

---

## Decisions to confirm

1. **Scope of the expressive treatment.** Marketing + auth + public checkout
   only (recommended), or push the glowing/pill/gradient style into the
   dashboard too?
2. **Display font.** Keep **Manrope** for headlines (free, recommended), or
   budget to license a Brockmann‑style commercial font to match Emergent exactly?
3. **Button shape.** Keep DynoPay's current squared 8px buttons on the dashboard
   and use **pill CTAs only on hero/auth** (recommended), or move everything to
   pills?
4. **Intensity of gradients/glows.** Subtle and reserved (recommended), or bold
   and prominent like Emergent's animated hero?
5. **How much to build now.** Start with the safe universal refinements
   (typography tightening, neutral greys, hover polish) — or also build the full
   animated‑gradient hero + device‑mockup showcase on the landing in this pass?

---

## Assumed defaults (used unless you push back)
- Keep **Manrope** for display; no paid font.
- Expressive treatment on **marketing + auth + public checkout**; the dashboard
  gets only the **universal** refinements.
- **Pill CTAs on hero/auth only**; dashboard controls stay 8px.
- Gradients/glows stay **subtle and reserved**.
- This pass delivers the **universal refinements + an upgraded marketing/auth
  hero** (glow headings, pill CTAs, gradient hero panel, social‑proof badges);
  the full device‑mockup carousel is optional and can follow.
