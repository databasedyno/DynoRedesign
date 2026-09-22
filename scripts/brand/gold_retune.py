#!/usr/bin/env python3
"""Targeted aqua/teal -> gold/brown literal retune for Dynopay surfaces (2026-09).
Skips SafeDeal, logo sources, coin colours, merchant-owned creator accents."""
import os, re, sys

ROOT = "/app"
DIRS = ["Components", "pages", "styles", "helpers", "constants", "assets", "utils", "hooks",
        "backend/utils", "backend/services", "public"]
EXTS = {".ts", ".tsx", ".css", ".svg"}
SKIP_SUBSTR = ["SafeDeal", "safedeal", "node_modules", ".next", "assets/Icons/Logo.tsx",
               "assets/Icons/logoMarkPaths.ts", "constants/theme.ts", "dynopay-blackLogo.svg", "dynopay-whiteLogo.svg", "auth/dynopay-logo.svg", "public/favicon.svg", "public/press", "theme.v3.ts",
               "Components/UI/StatusDot.tsx", "helpers/avatarGradient.ts", "constants/creatorTheme.ts",
               "helpers/assetColor.ts", "public/og", "backend/public/email"]

HEX_MAP = {
    "#2BD4C4": "#FFD100", "#0F8F86": "#8B5E00", "#0F766E": "#8B5E00", "#0D5C56": "#6B4800",
    "#2DD4BF": "#FFD100", "#5EEAD4": "#FFDA33", "#0B6F68": "#6B4800", "#E6F7F5": "#FFF6CC",
    "#0D9488": "#8B5E00", "#14B8A6": "#FFD100", "#99F6E4": "#FFE566", "#CCFBF1": "#FFF6CC",
    "#F0FDFA": "#FFFBE6", "#134E4A": "#3A2A1F", "#115E59": "#6B4800", "#0E4F4A": "#3A2A1F",
    "#123632": "#3A2A1F", "#CFF5F1": "#F3EDE2",
}
RGBA_MAP = [
    (re.compile(r"rgba\(\s*43\s*,\s*212\s*,\s*196\s*,"), "rgba(255,209,0,"),
    (re.compile(r"rgba\(\s*15\s*,\s*143\s*,\s*134\s*,"), "rgba(139,94,0,"),
    (re.compile(r"rgba\(\s*45\s*,\s*212\s*,\s*191\s*,"), "rgba(255,209,0,"),
    (re.compile(r"rgba\(\s*13\s*,\s*148\s*,\s*136\s*,"), "rgba(139,94,0,"),
]
IDENT_MAP = [
    (re.compile(r"\bAQUA_DEEP\b"), "GOLD_DEEP"),
    (re.compile(r"\bAQUA\b"), "GOLD"),
    (re.compile(r"\baquaAlpha\b"), "goldAlpha"),
]
HEX_RE = re.compile("|".join(re.escape(k) for k in HEX_MAP), re.IGNORECASE)

changed = []
for d in DIRS:
    base = os.path.join(ROOT, d)
    for dirpath, _, files in os.walk(base):
        if any(s in dirpath for s in SKIP_SUBSTR):
            continue
        for fn in files:
            path = os.path.join(dirpath, fn)
            rel = os.path.relpath(path, ROOT)
            if os.path.splitext(fn)[1] not in EXTS or any(s in rel for s in SKIP_SUBSTR):
                continue
            try:
                src = open(path, encoding="utf-8").read()
            except (UnicodeDecodeError, OSError):
                continue
            out = HEX_RE.sub(lambda m: HEX_MAP[m.group(0).upper()], src)
            for rx, rep in RGBA_MAP:
                out = rx.sub(rep, out)
            if "@/constants/theme" in out or "constants/theme" in out:
                for rx, rep in IDENT_MAP:
                    out = rx.sub(rep, out)
            if out != src:
                open(path, "w", encoding="utf-8").write(out)
                changed.append(rel)

print(f"{len(changed)} files changed")
for c in changed:
    print(" ", c)
