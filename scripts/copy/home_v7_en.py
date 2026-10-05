#!/usr/bin/env python3
"""Phase 1 conversion copy rewrite — HOME (landing v7), English source of truth.

Deep-merges the new English marketing copy into langs/locales/en/landing.json
under the `v7` subtree. Idempotent. Only touches v7.* leaf strings — every other
namespace/key is left untouched. No interpolation variables exist in these keys.
"""
import json
import os

EN = os.path.join(os.path.dirname(__file__), "..", "..", "langs", "locales", "en", "landing.json")
EN = os.path.abspath(EN)

# New English copy for the home page (v7). Conversion method applied:
# problem -> promise -> proof -> path; specificity over fluff; verb-led CTAs;
# trust cues in the decision zone; objections pre-answered.
V7 = {
    "hero": {
        "eyebrow": "Crypto payments, simplified",
        "headline1": "Accept crypto payments.",
        "headline2": "Get paid your way.",
        "body": "Take Bitcoin, Ethereum, USDT and 40+ assets, then auto-settle to the currency or wallet you pick. Non-custodial, zero chargebacks, live in minutes.",
        "primary": "Start free",
        "secondary": "See how it works",
        "note": "No credit card \u00b7 Non-custodial \u00b7 First payment free",
    },
    "coins": {
        "label": "Accept 40+ coins across every major chain",
    },
    "trust": {
        "eyebrow": "Live proof",
        "paymentsLabel": "Payments settled this month",
        "uptimeLabel": "Uptime over 90 days",
        "countriesLabel": "Countries served",
        "statusLink": "View live status",
    },
    "how": {
        "eyebrow": "How it works",
        "headline": "Get paid in three steps",
        "body": "From zero to your first crypto payment \u2014 no blockchain knowledge required.",
        "steps": {
            "create": {
                "title": "Create a payment",
                "body": "Spin up a payment link, hosted checkout, or API charge in seconds.",
            },
            "pay": {
                "title": "Your customer pays in any coin",
                "body": "They send Bitcoin, Ethereum, USDT or any of 40+ assets from any wallet.",
            },
            "settle": {
                "title": "You settle your way",
                "body": "Dynopay auto-converts and settles to the currency or wallet you choose.",
            },
        },
    },
    "pricing": {
        "eyebrow": "Pricing",
        "headline": "Simple pricing that scales with you",
        "body": "One transparent fee per payment. No setup costs, no monthly minimums, no chargebacks.",
        "startsAt": "Starts at",
        "perPayment": "per settled payment \u00b7 drops with volume",
        "perks": {
            "free": "Your first payment is free",
            "noMonthly": "No monthly or setup fees",
            "noChargebacks": "No chargebacks, ever",
            "volume": "Volume discounts as you grow",
        },
        "cta": "See full pricing",
    },
    "security": {
        "eyebrow": "Security & compliance",
        "headline": "Built to be trusted with money",
        "body": "Funds move on rails you can verify \u2014 never parked on a balance you can't see.",
        "noncustodial": {
            "title": "Non-custodial by design",
            "body": "Settled funds go straight to the wallet you control. Dynopay never holds your balance in between.",
        },
        "compliance": {
            "title": "KYC & AML built in",
            "body": "Identity and anti-money-laundering checks run on merchants above regulatory thresholds, keeping your account in good standing.",
        },
        "keys": {
            "title": "Hardened key infrastructure",
            "body": "Wallet keys are encrypted and isolated. Signing happens in a protected environment \u2014 never in the browser.",
        },
        "uptime": {
            "title": "Verifiable uptime",
            "body": "A public status page and round-the-clock monitoring let you confirm payments and settlement are healthy.",
        },
        "trustLink": "Visit the Trust Centre",
    },
    "ways": {
        "eyebrow": "Three ways to use it",
        "headline": "Whether you code or not",
        "body": "Start with a link today, drop in a hosted checkout tomorrow, or build straight on the API.",
        "nocode": {
            "title": "No code",
            "body": "Create a payment link or creator page and share it anywhere. Nothing to build.",
            "cta": "Explore no-code",
        },
        "checkout": {
            "title": "Hosted checkout",
            "body": "A drop-in checkout that handles coins, live rates and confirmations for you.",
            "cta": "See the demo",
        },
        "api": {
            "title": "Developer API",
            "body": "One REST API to create payments and receive webhooks. Ship in an afternoon.",
            "cta": "Read the docs",
        },
    },
    "proof": {
        "eyebrow": "Customer proof",
        "headline": "Merchants getting paid on Dynopay",
        "devstore": {
            "quote": "We started taking crypto in an afternoon. Payments land in USDC with zero chargebacks \u2014 it just works.",
            "role": "Digital goods merchant",
        },
        "safedeal": {
            "quote": "Dynopay settles straight to our wallet with no custody in between. That trust model is exactly why we build on it.",
            "role": "Escrow marketplace",
        },
    },
    "faq": {
        "eyebrow": "FAQ",
        "headline": "Questions, answered",
        "cost": {
            "q": "How much does it cost?",
            "a": "From 1.5% per settled payment, dropping with volume. There are no setup or monthly fees, and your first payment is free.",
        },
        "speed": {
            "q": "How fast do I get paid?",
            "a": "Most payments settle within minutes of on-chain confirmation \u2014 around 4 minutes on fast chains \u2014 straight to the wallet or account you choose.",
        },
        "custody": {
            "q": "Do you hold my funds?",
            "a": "No. Dynopay is non-custodial: settled funds go directly to the wallet you control. We never take custody of your money.",
        },
        "coins": {
            "q": "Which coins can customers pay with?",
            "a": "Bitcoin, Ethereum, USDT, USDC and 40+ assets across major chains. You choose the currency you want to receive.",
        },
    },
    "finalCta": {
        "eyebrow": "Get started",
        "headline": "Start accepting crypto today",
        "body": "Create your first payment in minutes. No credit card, no contracts \u2014 just get paid.",
        "primary": "Start free",
        "secondary": "Read the docs",
    },
}


def deep_merge(dst, src):
    for k, v in src.items():
        if isinstance(v, dict) and isinstance(dst.get(k), dict):
            deep_merge(dst[k], v)
        else:
            dst[k] = v


def main():
    with open(EN, encoding="utf-8") as f:
        data = json.load(f)
    data.setdefault("v7", {})
    # preserve existing v7.nav etc. that we don't rewrite
    deep_merge(data["v7"], V7)
    with open(EN, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print("updated", EN)


if __name__ == "__main__":
    main()
