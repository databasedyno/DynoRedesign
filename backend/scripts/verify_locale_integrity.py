#!/usr/bin/env python3
"""
Verify locale integrity for backend/locales/*/emails.json
- All 6 languages have identical flattened key sets
- Specific keys DO NOT exist (removed during de-dupe)
- Specific keys DO exist (required keys)
"""

import json
import sys
from pathlib import Path

LOCALES_DIR = Path(__file__).parent.parent / "locales"
LANGUAGES = ["en", "de", "es", "fr", "nl", "pt"]

# Keys that MUST NOT exist (removed during de-dupe)
FORBIDDEN_KEYS = {
    "chrome.greeting",
    "chrome.greetingNoName",
    "common.greetingNoName",
    "common.regards",
    "common.team",
    "common.questions",
    "receipt.platformFee",
    "receipt.tagline",
    "merchant.walletOtp",
}

# Keys that MUST exist (required keys)
REQUIRED_KEYS = {
    "common.greeting",
    "common.greetingDefault",
    "chrome.bestRegards",
    "chrome.teamSignature",
    "labels.platformFee",
    "receipt.contactMerchant",
    "invoice.paid",
    "invoice.termsSettled",
    "orderReceipt.preheader",
    "walletOtp.subject",
}


def flatten_keys(obj, prefix=""):
    """Flatten nested JSON object into dot-notation keys"""
    keys = set()
    if isinstance(obj, dict):
        for k, v in obj.items():
            new_prefix = f"{prefix}.{k}" if prefix else k
            if isinstance(v, dict):
                keys.update(flatten_keys(v, new_prefix))
            else:
                keys.add(new_prefix)
    return keys


def main():
    print(f"Checking locale integrity in {LOCALES_DIR}")
    
    # Load all locale files
    locale_data = {}
    for lang in LANGUAGES:
        locale_file = LOCALES_DIR / lang / "emails.json"
        if not locale_file.exists():
            print(f"❌ FAIL: {locale_file} does not exist")
            sys.exit(1)
        
        with open(locale_file, "r", encoding="utf-8") as f:
            locale_data[lang] = json.load(f)
    
    # Flatten all keys
    flattened_keys = {}
    for lang in LANGUAGES:
        flattened_keys[lang] = flatten_keys(locale_data[lang])
        print(f"  {lang}: {len(flattened_keys[lang])} keys")
    
    # Check all languages have identical key sets
    reference_keys = flattened_keys["en"]
    all_identical = True
    for lang in LANGUAGES[1:]:
        if flattened_keys[lang] != reference_keys:
            print(f"❌ FAIL: {lang} key set differs from en")
            missing = reference_keys - flattened_keys[lang]
            extra = flattened_keys[lang] - reference_keys
            if missing:
                print(f"  Missing in {lang}: {sorted(missing)[:5]}...")
            if extra:
                print(f"  Extra in {lang}: {sorted(extra)[:5]}...")
            all_identical = False
    
    if all_identical:
        print(f"✅ PASS: All {len(LANGUAGES)} languages have identical key sets ({len(reference_keys)} keys)")
    else:
        sys.exit(1)
    
    # Check forbidden keys DO NOT exist
    forbidden_found = reference_keys & FORBIDDEN_KEYS
    if forbidden_found:
        print(f"❌ FAIL: Forbidden keys found: {sorted(forbidden_found)}")
        sys.exit(1)
    else:
        print(f"✅ PASS: No forbidden keys found (checked {len(FORBIDDEN_KEYS)} keys)")
    
    # Check required keys DO exist
    required_missing = REQUIRED_KEYS - reference_keys
    if required_missing:
        print(f"❌ FAIL: Required keys missing: {sorted(required_missing)}")
        sys.exit(1)
    else:
        print(f"✅ PASS: All required keys exist (checked {len(REQUIRED_KEYS)} keys)")
    
    print("\n✅ ALL LOCALE INTEGRITY CHECKS PASSED")
    sys.exit(0)


if __name__ == "__main__":
    main()
