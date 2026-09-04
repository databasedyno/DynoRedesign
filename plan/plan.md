# SEO audit of dynopay.com — findings and fixes

Audit run against the live domain (sitemap, robots.txt, home, /fees, /for/saas, a blog post, /help-support, /fees?lang=fr, /dashboard) plus the code that generates the `<head>` tags.

## What passed

- `https://dynopay.com/sitemap.xml` — 200, valid XML, ~75 URLs, all absolute, no private routes. Storefront/creator/product entries are present, so the backend is reachable at render time.
- `https://dynopay.com/robots.txt` — the correct (newer) file is live; declares the sitemap; blocks dashboard/auth/checkout/API.
- Home, /fees, /for/* and blog posts each have a unique title, meta description and canonical; blog posts also ship Article JSON-LD and OG images.
- `/dashboard` and other in-app routes carry `noindex, nofollow`.

## What Google will flag (to be fixed)

**1. Help Center is submitted in the sitemap but marked `noindex`.** `/help-support` and every `/help-support/{slug}` article is in the sitemap and allowed by robots.txt, yet the global head marks the whole `/help-support` prefix as private → Search Console error "Submitted URL marked noindex". Fix: stop treating `/help-support` as private.

**2. Help articles are missing from the sitemap and invisible to crawlers.** The live Help Center lists 8 articles, but the sitemap has zero `/help-support/{slug}` entries, and the article pages fetch their content in the browser only (server sends a spinner). Fix: (a) correct the article fetch used by the sitemap so the 8 articles are listed with real `lastmod`, (b) render article content, title, description and canonical on the server so Google indexes the actual text.

**3. hreflang alternates point at pages that don't exist as translations.** Every page (and the sitemap) advertises `?lang=pt|fr|es|de|nl` alternates, but the server always renders English regardless of `?lang=` (language is applied in the browser from localStorage). `/fees?lang=fr` is byte-for-byte English with `<html lang="en">`. Google will report hreflang errors and treat the six URLs as duplicates. Two ways to resolve — **decision needed**:
   - **A (recommended now, small):** remove the hreflang alternates from the head and the sitemap; keep English as the single indexable version. Zero risk, immediately clean report. Translated pages remain available to users via the language switcher exactly as today.
   - **B (larger, later):** make `?lang=xx` render server-side in that language with its own canonical and `<html lang>`, so the alternates become real. Requires server-side locale loading and hydration changes across the app. Proposed as a follow-up, not part of this fix.

**4. Blog posts inherit wrong hreflang.** Because of (3), a post such as `/blog/how-to-accept-crypto-payments-on-your-website` declares alternates for `/blog?lang=fr` (the index page). Resolved automatically by fix 3A.

**5. Creator pages emit two canonical tags.** `/{handle}` pages (e.g. `/tuhin`) output their own canonical plus the global fallback (`https://dynopay.com/`), so Google may pick the homepage as canonical and drop the creator page. Fix: one-line dedupe on the creator page.

**6. Stale duplicate robots.txt in the repo** (`assets/public-runtime/robots.txt`, older rules that block the Help Center). Not served, but a future build-config change could pick it up. Fix: delete it.

**7. Legacy IndexNow script lists only 7 URLs.** Refresh it to read the live sitemap so Bing/Yandex get the full page list. (Low priority; only relevant if Bing coverage is wanted.)

## Not changed (deliberately)

- Blog has only 4 posts and the country landing pages (`/accept-crypto-payments-in/*`) are not in the sitemap — content decisions, not SEO defects.
- JSON-LD is only on the homepage and blog; adding FAQ/Product schema to /fees and /for/* is a separate enhancement.
- Google Analytics / Tag Manager — out of scope.

## After the fix is deployed (user, in Search Console)

1. Sitemaps → submit `sitemap.xml` (or "resubmit" if already added).
2. URL Inspection → `https://dynopay.com/help-support` → Request indexing; repeat for `/`, `/fees`, `/blog`.
3. Expect the "Pages" report to show the Help Center and creator pages as indexed within 1–2 weeks; hreflang/duplicate warnings should not appear.

## Assumptions

- Fix 3 is implemented as option **A** (remove alternates) unless told otherwise.
- The Help Center is meant to be public and indexable (it is linked from the homepage FAQ and marketing footer).
- Changes ship on the next "Save to GitHub" push, which triggers the DigitalOcean deploy; the live re-check happens after that deploy.
