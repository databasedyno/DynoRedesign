"""
Programmatic-SEO content generator for DynoPay.

Uses Claude Sonnet 4.5 (via the Emergent Universal Key + emergentintegrations)
to generate landing-page copy for a curated list of country + vertical
combinations. Results are written to /app/data/seo-pages/{countries,verticals}/{slug}.json
and consumed by the Next.js pages at build time via getStaticProps.

Design goals
------------
* Runs OFFLINE / on-demand — no LLM calls at page-serve time.
* Content is committed to the repo → easy to review, edit, and version.
* Idempotent — re-running only regenerates pages whose JSON is missing or older
  than --max-age-days (unless --force is passed).
* Prompt returns strict JSON so we can validate + fail fast on bad output.

Usage
-----
    # generate everything that doesn't exist yet
    python3 /app/scripts/generate-seo-pages.py

    # regenerate everything (force)
    python3 /app/scripts/generate-seo-pages.py --force

    # regenerate only a specific slug
    python3 /app/scripts/generate-seo-pages.py --only country:united-states
    python3 /app/scripts/generate-seo-pages.py --only vertical:saas
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage

# ─────────────────────────────────────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────────────────────────────────────

# Load env from the same place the backend uses so EMERGENT_LLM_KEY is picked up.
load_dotenv("/app/backend/.env")

MODEL_PROVIDER = "anthropic"
MODEL_NAME = "claude-sonnet-4-5-20250929"  # Claude Sonnet 4.5

OUTPUT_ROOT = Path("/app/data/seo-pages")
COUNTRIES_DIR = OUTPUT_ROOT / "countries"
VERTICALS_DIR = OUTPUT_ROOT / "verticals"

# Curated starter set. Add more entries here and re-run the script; nothing
# else needs to change — the Next.js pages pick them up automatically via
# getStaticPaths reading the JSON files in this directory.
COUNTRIES = [
    # INTENTIONALLY EMPTY — per-country pages were removed 2026-07-11 (user
    # decision, session 27g): promoting crypto payments per-jurisdiction creates
    # regulatory exposure that outweighs the SEO value. Do NOT re-add without
    # explicit user sign-off.
]

VERTICALS = [
    {"slug": "ecommerce", "name": "E-commerce Stores"},
    {"slug": "saas", "name": "SaaS & Subscription Products"},
    {"slug": "freelancers", "name": "Freelancers & Creators"},
    {"slug": "gaming", "name": "Gaming & iGaming"},
    {"slug": "remittance", "name": "Remittance & Cross-Border Payouts"},
    {"slug": "digital-downloads", "name": "Digital Downloads & Course Sellers"},
    {"slug": "hosting", "name": "Web Hosting & Domain Providers"},
    {"slug": "vpn", "name": "VPN & Privacy Software"},
    {"slug": "marketplaces", "name": "Online Marketplaces & Platforms"},
    {"slug": "agencies", "name": "Agencies & Consultants"},
    {"slug": "nonprofits", "name": "Nonprofits & Charities"},
]

# Audience pages — the 4 first-class DynoPay audiences. These render at
# /for/{slug} (stored with _kind="vertical" so the existing verticals system,
# sitemap and cross-links pick them up) but use an audience-tailored prompt so
# the copy matches the exact product surface each audience uses.
AUDIENCES = [
    {
        "slug": "merchants",
        "name": "Merchants & Online Sellers",
        "angle": "sell products and services and get paid in crypto",
        "keyword": "accept crypto payments for your store",
        "surface": "Hosted checkout, no-code payment links, and a full storefront. Every payment settles straight to the merchant's own wallet, with optional auto-conversion to USDT/USDC.",
    },
    {
        "slug": "creators",
        "name": "Creators & Streamers",
        "angle": "get tipped and take fan support in crypto",
        "keyword": "accept crypto tips as a creator",
        "surface": "A personal tip page at dynopay.com/@handle. Fans support the creator in one tap with no signup required; funds go directly to the creator's own wallet.",
    },
    {
        "slug": "fundraisers",
        "name": "Fundraisers & Nonprofits",
        "angle": "run crowdfunding campaigns and collect donations in crypto",
        "keyword": "crypto crowdfunding and donations",
        "surface": "A full campaign page with a funding goal, reward tiers, a progress bar, and updates that email supporters. Raise from anyone, anywhere, with funds settling to the organizer's own wallet.",
    },
    {
        "slug": "developers",
        "name": "Developers & Builders",
        "angle": "integrate crypto payments programmatically",
        "keyword": "crypto payments API",
        "surface": "A REST API, webhooks, official SDKs, a drop-in checkout widget, and a sandbox with test keys. 15+ chains behind one API — no smart contracts to write or audit.",
    },
]

# Facts about DynoPay the model MUST use verbatim (so it doesn't hallucinate
# fees or supported chains). Keep this in sync with the real product.
DYNOPAY_FACTS = """
DynoPay is a non-custodial crypto commerce platform. Merchants, creators,
fundraisers, and developers all receive funds DIRECTLY in their own wallet —
DynoPay never holds customer funds.

DynoPay is more than a checkout: businesses sell products (hosted checkout,
payment links, storefront), creators collect tips (a personal page at
dynopay.com/@handle), and organizers run crowdfunding campaigns (goal, reward
tiers, updates) — all in crypto — and developers can integrate any of it via a
REST API, webhooks, and SDKs.

Supported chains and assets (verified):
- Bitcoin (BTC), Litecoin (LTC), Bitcoin Cash (BCH), Dogecoin (DOGE)
- Ethereum (ETH, USDT-ERC20, USDC-ERC20, RLUSD-ERC20)
- Polygon (MATIC, USDT-Polygon)
- Tron (TRX, USDT-TRC20)
- Solana (SOL)
- XRP Ledger (XRP, RLUSD on XRPL)

Fees: volume-tiered platform fee — starts at 1.5% + $1 per successful payment
(Starter tier) and falls automatically to as low as 0.5% at scale, based on
settled volume. Every merchant's FIRST payment is completely fee-free.
No monthly fees. No setup fees. No hidden fees. No chargebacks.
IMPORTANT: never describe the fee as a "flat 1.5%" — always phrase it as
"from 1.5%" or "starts at 1.5% and drops to 0.5% at scale".
When counting supported assets, say "15+ cryptocurrencies".

CLAIM RULES (hard requirements — violations get the page rejected):
- KYC: DynoPay DOES require identity verification (KYC) once a merchant's
  settled volume passes a threshold. NEVER claim "no KYC required". Correct
  phrasing: "KYC applies to your account once settled volume passes a
  threshold; fiat off-ramps run their own KYC".
- Recurring billing: crypto has NO card-style auto-charge / pull payments.
  Describe subscriptions as per-cycle payment links (manual or automated via
  the REST API + webhooks). Never say "charge their wallet each cycle".
- NEVER invent statistics or percentages that are not in these facts.
  Industry pain points must be hedged ("can lose", "routinely lose").
- NEVER suggest evading payment-processor blocks, country restrictions,
  licensing, sanctions, or compliance. Merchants remain responsible for
  their own licensing, market rules, and AML obligations — say so on
  regulated verticals (gaming, remittance).
- Settlement speed: say "in minutes" (never "instant"); Bitcoin can take
  10-60 minutes.
- Do not name Shopify as an embed target (their checkout is closed);
  WooCommerce or custom carts are fine.

Onboarding: sign up → verify email → create company → add ONE payout wallet →
generate a payment link or drop the checkout widget on your site. Live in
under 10 minutes.

Global by default: no country restrictions on receiving crypto (KYC applies
to fiat off-ramp in some jurisdictions). Merchants keep custody at all times.
"""

# Strict output schema. If the model returns anything else the record is
# rejected and retried once.
SCHEMA_HINT = """
Return ONLY a valid minified JSON object (no markdown fences, no prose).
The object MUST have exactly these keys and value types:

{
  "meta_title": "string (50-60 chars, includes primary keyword and 'DynoPay')",
  "meta_description": "string (140-155 chars, includes primary keyword + CTA)",
  "h1": "string (60-90 chars, includes primary keyword naturally)",
  "subheading": "string (110-180 chars, expands on H1 with a concrete benefit)",
  "intro_paragraph": "string (60-90 words, sets context, mentions 2 real DynoPay differentiators)",
  "features": [
    {"title": "string (4-7 words)", "description": "string (25-40 words, concrete benefit)"},
    {"title": "string (4-7 words)", "description": "string (25-40 words, concrete benefit)"},
    {"title": "string (4-7 words)", "description": "string (25-40 words, concrete benefit)"}
  ],
  "how_it_works": [
    "string (12-20 words describing step 1)",
    "string (12-20 words describing step 2)",
    "string (12-20 words describing step 3)"
  ],
  "faqs": [
    {"question": "string (natural question a merchant would type into Google)", "answer": "string (35-60 words, answers directly using DynoPay facts)"},
    {"question": "string", "answer": "string"},
    {"question": "string", "answer": "string"},
    {"question": "string", "answer": "string"},
    {"question": "string", "answer": "string"}
  ],
  "cta_headline": "string (5-10 words, action-oriented)",
  "cta_body": "string (15-25 words, one benefit + urgency, no exclamation marks)"
}
"""


def prompt_for_country(c: dict) -> str:
    return f"""
You are writing a merchant-acquisition landing page for DynoPay, targeting
businesses in {c['name']} that want to ACCEPT cryptocurrency payments.

Primary keyword: "accept crypto payments in {c['name']}"
Local currency to reference: {c['currency']}

DYNOPAY FACTS (use these — do not invent features or fees):
{DYNOPAY_FACTS}

Write for a busy business owner. Concrete, benefit-first, no fluff, no
buzzwords like "revolutionary" / "cutting-edge" / "seamless" / "unlock".
Do not promise regulatory approval that isn't documented. Use active voice.
Reference {c['currency']} once in the intro or features to make it feel local.

{SCHEMA_HINT}
""".strip()


def prompt_for_vertical(v: dict) -> str:
    return f"""
You are writing a merchant-acquisition landing page for DynoPay, targeting
{v['name']} that want to accept cryptocurrency payments.

Primary keyword: "crypto payments for {v['name'].lower()}"

DYNOPAY FACTS (use these — do not invent features or fees):
{DYNOPAY_FACTS}

Write for someone running this specific type of business. Show you understand
their pain (chargebacks for e-commerce, involuntary churn for SaaS, paying
international freelancers, KYC friction for gaming, remittance corridors,
piracy/refund abuse for digital goods — pick what fits).

Concrete, benefit-first, no fluff, no buzzwords like "revolutionary" /
"cutting-edge" / "seamless" / "unlock". Use active voice. Do not promise
regulatory approval that isn't documented.

{SCHEMA_HINT}
""".strip()


def prompt_for_audience(a: dict) -> str:
    return f"""
You are writing a landing page for DynoPay, targeting {a['name']} who want to
{a['angle']}.

Primary keyword: "{a['keyword']}"

DYNOPAY FACTS (use these — do not invent features or fees):
{DYNOPAY_FACTS}

THE EXACT PRODUCT SURFACE THIS AUDIENCE USES (center the page on this):
{a['surface']}

Write directly to this specific audience — speak to their real goals and the
exact DynoPay surface above, not generic "accept payments" copy. Concrete,
benefit-first, no fluff, no buzzwords like "revolutionary" / "cutting-edge" /
"seamless" / "unlock". Use active voice. Do not promise regulatory approval
that isn't documented. The FAQs must be questions THIS audience would actually
type into Google.

{SCHEMA_HINT}
""".strip()


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _strip_code_fence(s: str) -> str:
    s = s.strip()
    if s.startswith("```"):
        s = re.sub(r"^```(?:json)?\s*", "", s)
        s = re.sub(r"\s*```$", "", s)
    return s.strip()


def _validate(payload: dict) -> tuple[bool, str]:
    required = [
        "meta_title", "meta_description", "h1", "subheading",
        "intro_paragraph", "features", "how_it_works", "faqs",
        "cta_headline", "cta_body",
    ]
    for k in required:
        if k not in payload:
            return False, f"missing key: {k}"
    if not isinstance(payload["features"], list) or len(payload["features"]) != 3:
        return False, "features must be a list of 3 items"
    for i, f in enumerate(payload["features"]):
        if not isinstance(f, dict) or "title" not in f or "description" not in f:
            return False, f"feature[{i}] must have title + description"
    if not isinstance(payload["how_it_works"], list) or len(payload["how_it_works"]) != 3:
        return False, "how_it_works must be a list of 3 strings"
    if not isinstance(payload["faqs"], list) or len(payload["faqs"]) != 5:
        return False, "faqs must be a list of 5 items"
    for i, q in enumerate(payload["faqs"]):
        if not isinstance(q, dict) or "question" not in q or "answer" not in q:
            return False, f"faq[{i}] must have question + answer"
    return True, ""


async def _call_claude(prompt: str, session_id: str, api_key: str) -> str:
    """One-shot call to Claude Sonnet 4.5. Non-streaming — this runs offline."""
    chat = LlmChat(
        api_key=api_key,
        session_id=session_id,
        system_message=(
            "You are an experienced conversion copywriter for a B2B fintech. "
            "You always return valid JSON that exactly matches the requested schema. "
            "You never use markdown code fences."
        ),
    ).with_model(MODEL_PROVIDER, MODEL_NAME)
    return await chat.send_message(UserMessage(text=prompt))


async def _generate_one(kind: str, entry: dict, api_key: str) -> dict:
    """kind: 'country' | 'vertical' | 'audience'"""
    if kind == "country":
        prompt = prompt_for_country(entry)
    elif kind == "audience":
        prompt = prompt_for_audience(entry)
    else:
        prompt = prompt_for_vertical(entry)
    session_id = f"seo-{kind}-{entry['slug']}-{uuid.uuid4().hex[:8]}"

    last_err = ""
    for attempt in range(2):
        raw = await _call_claude(prompt, session_id, api_key)
        cleaned = _strip_code_fence(raw)
        try:
            payload = json.loads(cleaned)
        except json.JSONDecodeError as e:
            last_err = f"JSON parse error: {e}\n--- raw ---\n{raw[:500]}"
            continue
        ok, err = _validate(payload)
        if not ok:
            last_err = f"schema error: {err}"
            continue
        return payload

    raise RuntimeError(f"failed after 2 attempts: {last_err}")


def _out_path(kind: str, slug: str) -> Path:
    return (COUNTRIES_DIR if kind == "country" else VERTICALS_DIR) / f"{slug}.json"


def _should_skip(path: Path, force: bool, max_age_days: int) -> bool:
    if force:
        return False
    if not path.exists():
        return False
    if max_age_days <= 0:
        return True
    try:
        data = json.loads(path.read_text())
        generated_at = data.get("_generated_at")
        if not generated_at:
            return False
        gen_dt = datetime.fromisoformat(generated_at.replace("Z", "+00:00"))
        age_days = (datetime.now(timezone.utc) - gen_dt).days
        return age_days < max_age_days
    except Exception:
        return False


async def _run():
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="Regenerate even if JSON exists")
    parser.add_argument(
        "--max-age-days", type=int, default=30,
        help="If a JSON is younger than this many days, skip regeneration (default: 30)",
    )
    parser.add_argument(
        "--only", type=str, default="",
        help="Regenerate only this slug (format: country:<slug> or vertical:<slug>)",
    )
    args = parser.parse_args()

    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        print("ERROR: EMERGENT_LLM_KEY not set in /app/backend/.env", file=sys.stderr)
        sys.exit(1)

    COUNTRIES_DIR.mkdir(parents=True, exist_ok=True)
    VERTICALS_DIR.mkdir(parents=True, exist_ok=True)

    only_kind, only_slug = None, None
    if args.only:
        if ":" not in args.only:
            print("ERROR: --only must be like country:<slug> or vertical:<slug>", file=sys.stderr)
            sys.exit(1)
        only_kind, only_slug = args.only.split(":", 1)

    jobs: list[tuple[str, dict]] = []
    for c in COUNTRIES:
        if only_kind and (only_kind != "country" or only_slug != c["slug"]):
            continue
        jobs.append(("country", c))
    for v in VERTICALS:
        if only_kind and (only_kind != "vertical" or only_slug != v["slug"]):
            continue
        jobs.append(("vertical", v))
    for a in AUDIENCES:
        if only_kind and (only_kind != "audience" or only_slug != a["slug"]):
            continue
        jobs.append(("audience", a))

    print(f"→ {len(jobs)} candidate page(s) using {MODEL_PROVIDER}/{MODEL_NAME}")

    ok_count = skipped_count = failed_count = 0
    for kind, entry in jobs:
        out = _out_path(kind, entry["slug"])
        label = f"[{kind}/{entry['slug']}]"

        if _should_skip(out, args.force, args.max_age_days):
            print(f"  {label} SKIP (fresh, <{args.max_age_days}d old)")
            skipped_count += 1
            continue

        print(f"  {label} generating...", end="", flush=True)
        t0 = time.time()
        try:
            payload = await _generate_one(kind, entry, api_key)
        except Exception as e:
            failed_count += 1
            print(f" FAILED ({e})")
            continue

        payload["_generated_at"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        payload["_model"] = f"{MODEL_PROVIDER}/{MODEL_NAME}"
        payload["_kind"] = "vertical" if kind == "audience" else kind
        payload["_slug"] = entry["slug"]
        payload["_display_name"] = entry["name"]
        if kind == "country":
            payload["_currency"] = entry.get("currency", "")
            payload["_flag"] = entry.get("flag", "")

        out.write_text(json.dumps(payload, indent=2, ensure_ascii=False))
        ok_count += 1
        print(f" OK ({time.time() - t0:.1f}s → {out.relative_to(OUTPUT_ROOT.parent)})")

    print(f"\nDone. {ok_count} generated, {skipped_count} skipped, {failed_count} failed.")


if __name__ == "__main__":
    asyncio.run(_run())
