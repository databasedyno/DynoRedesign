# Dynopay rebrand — yellow · dark brown · black · aqua, new logo, cleaner landing
**Starting point: the merchant dashboard (per user).** Landing page follows after.

## Goal
Give Dynopay (the merchant crypto-payments product — NOT SafeDeal) a new visual identity built on yellow, dark brown, black and turquoise/aqua, replace the current indigo look everywhere a customer or merchant sees it, ship a new logo that fits the palette, and remove the decorative square that sits behind the landing-page hero.

## 1. Brand palette
| Role | Colour | Where it is used |
|---|---|---|
| Yellow (primary) | bright signal yellow `#FFD100`, hover `#F0C300` | primary buttons, key numbers, active nav item, selected states, logo mark, highlights |
| Dark brown (dominant dark) | espresso `#2B1D14`, raised surfaces `#3A2A1F` | sidebar, hero/footer grounds, dark-mode page background, headings/text on light surfaces (`#1F140D`) |
| Black | near-black `#0B0908` | deepest backgrounds in dark mode, code/QR/address blocks, logo on light |
| Aqua (secondary) | `#2BD4C4` on dark, `#0F8F86` on light (for readable text/links) | links, secondary/outlined buttons, focus rings, "live on-chain"/status indicators, chart lines, hover glows, progress steps |
| Light neutrals | cream page `#FAF6EF`, card `#FFFDF7`, hairline `#E8DFD2` | light-mode backgrounds and borders (warm, never blue-grey) |

Rules:
- Yellow always carries dark-brown text (never white-on-yellow).
- Money semantics stay conventional: green for received/up, red for failed/down. Aqua is a brand accent, not a "success" colour.
- Both light and dark modes ship. Dark mode = dark brown/black grounds with yellow + aqua accents; light mode = cream grounds with dark-brown text.
- Standard alert/notice boxes get solid, readable backgrounds in the new palette (fixes the faint-alert problem that already exists in the shared theme).
- Typography is unchanged; only colour, texture, shapes and the logo change.

## 2. Logo
- The current indigo logo does not fit the palette, so a new one is made.
- Direction: a geometric "D" monogram whose inner counter is cut like a coin edge, with a single small aqua spark/dot marking the on-chain moment; yellow mark on dark brown, with a clean "Dynopay" wordmark beside it.
- Delivered as scalable vector so it renders crisp everywhere, in four variants: full colour on dark, full colour on light, single-colour dark, single-colour light.
- Derived assets: favicon set, browser/app icon, social-share (Open Graph) image, email header image, and the small square mark used in the dashboard sidebar and hosted checkout.
- Checkpoint: two or three rendered logo concepts are shown for a pick before the chosen one is rolled out. Because the dashboard sidebar carries the logo, this pick happens at the very start.

## 3. Delivery order
**Step 1 — Dashboard first (start here)**
1. Logo concepts → pick.
2. Merchant dashboard and every in-app page: sidebar + top bar, company selector, overview/command-centre cards, charts, tables, chips/status badges, buttons, dialogs, forms, settings, wallets, payment links, invoices, customers, transactions, get-started wizard, 2FA banners/interstitial. Light and dark mode.
3. Sign-in / sign-up / password / 2FA screens (they share the app shell).

**Step 2 — Public surfaces**
4. Marketing landing page: the large geometric square/tile behind the hero is removed (nothing geometric replaces it); the hero gets a soft aqua→yellow glow bleeding from one corner over the dark-brown ground plus a fine grain texture. Other decorative squares/tiles down the page are removed the same way. Whole page recoloured to the palette, new logo in header/footer.
5. Fees page and other marketing pages sharing the landing layout.
6. Hosted checkout (`/pay`), payment receipts (web + PDF) and the public receipt page.

**Step 3 — Comms and internal**
7. Transactional emails (header, buttons, footer) for the Dynopay brand.
8. Admin panel accents (low priority; functional, not a redesign).

Explicitly unchanged:
- SafeDeal keeps its own gold/black identity, logo and pages. Only the tiny legal line that mentions Dynopay stays as is.
- Merchant storefront/checkout pages that are branded with the merchant's own colours/logo keep the merchant's branding.
- Layout, navigation, copy and features do not change — this is colour, texture and logo only (except the removed landing squares).

## 4. What "done" looks like (per step)
- Dashboard: no indigo/violet/blue brand colour remains on any in-app page in light or dark mode; the new logo sits in the sidebar; active nav item, primary buttons and key numbers are yellow-on-brown; links/focus/status use aqua; charts use aqua/yellow lines; alerts are solid and readable.
- Landing: no geometric background shapes; hero uses the glow + grain treatment; new logo in header, footer, favicon and social-share preview.
- Everywhere: yellow buttons carry dark-brown text; aqua text uses the darker shade on light backgrounds; contrast meets accessibility norms.

## Assumptions (change if wrong)
- Full-product rebrand is wanted; the dashboard ships first, then landing/checkout, then emails/admin.
- Dynopay's yellow is deliberately a touch brighter/cooler than SafeDeal's gold so the two products stay recognisably related but distinct.
- The dark-brown sidebar is the dashboard's anchor in both light and dark mode (light mode = brown sidebar on cream page; dark mode = brown sidebar on black page).
- The landing square is removed outright rather than swapped for another shape.
- Existing fonts stay; the logo wordmark is drawn as vector, not dependent on a new web font.
- Dark brown (not pure black) is the dominant dark; black is reserved for the deepest layers so the UI feels warm rather than stark.
