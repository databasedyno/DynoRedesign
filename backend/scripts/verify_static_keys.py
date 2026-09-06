#!/usr/bin/env python3
"""
Check all t('x.y')/t("x.y")/tr('x.y') string-literal keys in backend code
and confirm every one resolves in backend/locales/en/emails.json
"""

import json
import re
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).parent.parent
LOCALES_FILE = BACKEND_DIR / "locales" / "en" / "emails.json"
SEARCH_DIRS = [
    BACKEND_DIR / "services",
    BACKEND_DIR / "controller",
    BACKEND_DIR / "routes",
    BACKEND_DIR / "utils",
    BACKEND_DIR / "helper",
]

# Regex patterns to match t('key', ...), t("key", ...), tr('key', ...), tr("key", ...)
PATTERNS = [
    re.compile(r"""\bt\(['"]([a-zA-Z0-9_.]+)['"]"""),
    re.compile(r"""\btr\(['"]([a-zA-Z0-9_.]+)['"]"""),
]


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


def extract_translation_keys(file_path):
    """Extract all t('key') and tr('key') calls from a file"""
    keys = set()
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
            for pattern in PATTERNS:
                matches = pattern.findall(content)
                keys.update(matches)
    except Exception as e:
        print(f"Warning: Could not read {file_path}: {e}")
    return keys


def main():
    print(f"Loading locale keys from {LOCALES_FILE}")
    
    # Load locale keys
    with open(LOCALES_FILE, "r", encoding="utf-8") as f:
        locale_data = json.load(f)
    
    valid_keys = flatten_keys(locale_data)
    print(f"  Found {len(valid_keys)} valid keys in emails.json")
    
    # Scan all source files
    all_used_keys = set()
    file_count = 0
    
    for search_dir in SEARCH_DIRS:
        if not search_dir.exists():
            print(f"Warning: {search_dir} does not exist, skipping")
            continue
        
        print(f"  Scanning {search_dir.name}...")
        for file_path in search_dir.rglob("*.ts"):
            keys = extract_translation_keys(file_path)
            all_used_keys.update(keys)
            if keys:
                file_count += 1
    
    print(f"  Scanned {file_count} TypeScript files")
    print(f"  Found {len(all_used_keys)} unique translation keys in code")
    
    # Check for dangling keys
    dangling_keys = all_used_keys - valid_keys
    
    if dangling_keys:
        print(f"\n❌ FAIL: Found {len(dangling_keys)} dangling keys (not in emails.json):")
        for key in sorted(dangling_keys)[:20]:  # Show first 20
            print(f"  - {key}")
        if len(dangling_keys) > 20:
            print(f"  ... and {len(dangling_keys) - 20} more")
        sys.exit(1)
    else:
        print(f"\n✅ PASS: All {len(all_used_keys)} translation keys resolve in emails.json")
        print("  No dangling keys found")
    
    sys.exit(0)


if __name__ == "__main__":
    main()
