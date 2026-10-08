#!/usr/bin/env python3
"""Aggregate ux_layout_audit.mjs results into compact cross-device tables.

Usage: python3 scripts/qa/ux_layout_audit_summary.py [OUT_DIR] [--detail page_id] [--device dev_id]
"""
import json
import os
import sys
from collections import defaultdict

OUT = "/app/test_reports/ux_layout_audit_2026-10-08"
argv = sys.argv[1:]
args = []
skip = False
for i, a in enumerate(argv):
    if skip:
        skip = False
        continue
    if a in ("--detail", "--device"):
        skip = True
        continue
    if not a.startswith("--"):
        args.append(a)
if args:
    OUT = args[0]
detail = None
device_filter = None
if "--detail" in sys.argv:
    detail = sys.argv[sys.argv.index("--detail") + 1]
if "--device" in sys.argv:
    device_filter = sys.argv[sys.argv.index("--device") + 1]

ORDER = [
    "desktop-2560", "desktop-1920", "desktop-1440", "desktop-1440-dark", "desktop-1280",
    "ipad-pro11-landscape", "ipad-mini-landscape", "ipad-pro11-portrait", "ipad-mini-portrait",
    "galaxy-tab-s4", "iphone-16-pro-max", "pixel-8", "iphone-15-pro", "iphone-15-pro-dark",
    "galaxy-s24", "iphone-se3",
]
EXCLUDE_PAGES = {"saved", "wallet-security"}

data = {}
for d in sorted(os.listdir(OUT)):
    for fn in ("results.json", "results_extra.json"):
        p = os.path.join(OUT, d, fn)
        if os.path.exists(p):
            r = json.load(open(p))
            key = d if fn == "results.json" else d + "+extra"
            data[key] = r

devs = [d for d in ORDER if d in data] + [d for d in data if d not in ORDER]
if device_filter:
    devs = [d for d in devs if device_filter in d]

if detail:
    for d in devs:
        pg = data[d]["pages"].get(detail)
        if not pg:
            continue
        print(f"\n### {d} — {detail}")
        for k in ("url", "loadMs", "chromeTopPx", "contentViewportPct", "topbarH", "banners", "pageHeaderH", "bottomNavH",
                  "sidebarW", "mainW", "contentColW", "mainPadX", "mainScrollH", "distinctFontSizes", "fontSizes", "tinyText", "smallText",
                  "truncated", "clippedRight", "hScrollers", "small24", "small44", "inputsUnder16", "containedAboveFold",
                  "h1", "navActive", "mainStack", "fixed", "longLines", "bottom", "errors", "apiErr", "pageAction"):
            if k in pg:
                v = pg[k]
                if v in (None, [], {}, 0, ""):
                    continue
                print(f"  {k}: {json.dumps(v)[:600]}")
    sys.exit(0)

# overview table per device (averages over in-app pages)
print("device | vw x vh | sidebar | topbar | chromeTop avg | content% avg | colW max | fs avg | tap<24 tot | tap<44 tot | trunc tot | clipR tot | hscroll pages | iosZoom pages | slow>8s")
for d in devs:
    r = data[d]
    pages = {k: v for k, v in r["pages"].items() if k not in EXCLUDE_PAGES and "error" not in v}
    if not pages:
        continue
    vp = r["viewport"]
    n = len(pages)
    avg = lambda k: round(sum(p.get(k, 0) or 0 for p in pages.values()) / n)
    tot = lambda k: sum(p.get(k, 0) or 0 for p in pages.values())
    sb = max(p.get("sidebarW", 0) for p in pages.values())
    tb = max(p.get("topbarH", 0) for p in pages.values())
    colw = max(p.get("contentColW", 0) for p in pages.values())
    hs = sum(1 for p in pages.values() if p.get("hScrollers"))
    iz = sum(1 for p in pages.values() if p.get("inputsUnder16"))
    slow = sum(1 for p in pages.values() if (p.get("loadMs") or 0) > 8000)
    print(f"{d} | {vp['width']}x{vp['height']} | {sb} | {tb} | {avg('chromeTopPx')} | {avg('contentViewportPct')} | {colw} | {avg('distinctFontSizes')} | {tot('small24Count')} | {tot('small44Count')} | {tot('truncatedCount')} | {tot('clippedRightCount')} | {hs} | {iz} | {slow}")

print("\nPER-PAGE content% (usable content height at first paint, % of viewport)")
allpages = []
for d in devs:
    for k in data[d]["pages"]:
        if k not in allpages and k not in EXCLUDE_PAGES:
            allpages.append(k)
print("page | " + " | ".join(devs))
for pgid in allpages:
    row = []
    for d in devs:
        p = data[d]["pages"].get(pgid)
        row.append(str(p.get("contentViewportPct", "-")) if p and "error" not in p else "-")
    print(pgid + " | " + " | ".join(row))

print("\nFLAGS per page/device (hscroll, clippedRight, trunc, tap<24, tap<44 (touch only), iosZoom, JS errors, API errors)")
for pgid in allpages:
    for d in devs:
        p = data[d]["pages"].get(pgid)
        if not p or "error" in p:
            continue
        touch = data[d]["cls"] != "desktop"
        f = []
        if p.get("hScrollers"):
            f.append("HSCROLL " + ";".join(f"{h['d'][:40]} {h['sw']}/{h['cw']}" for h in p["hScrollers"][:2]))
        if p.get("clippedRightCount"):
            f.append(f"CLIP-R {p['clippedRightCount']}: " + "; ".join(p["clippedRight"][:2]))
        if p.get("truncatedCount"):
            f.append(f"trunc {p['truncatedCount']}: " + "; ".join(p["truncated"][:3]))
        if p.get("small24Count"):
            f.append(f"tap<24 {p['small24Count']}")
        if touch and p.get("small44Count"):
            f.append(f"tap<44 {p['small44Count']}")
        if touch and p.get("inputsUnder16"):
            f.append("iosZoom " + "; ".join(p["inputsUnder16"][:2]))
        if p.get("errors"):
            f.append("JSERR " + " | ".join(p["errors"][:2])[:160])
        if p.get("apiErr"):
            f.append("API " + " | ".join(p["apiErr"][:3])[:160])
        if f:
            print(f"- {pgid} @ {d}: " + " || ".join(f))

print("\nOVERLAYS / FIRST VISIT / BLOCKED WRITES")
for d in devs:
    r = data[d]
    fv = r.get("firstVisit") or {}
    print(f"- {d}: firstVisit dialogs={fv.get('dialogs')} banners={fv.get('banners')} | overlays=" + json.dumps({k: (v.get('m') or v.get('missing') or 'ok') for k, v in r.get('overlays', {}).items()})[:400] + f" | blocked={r.get('blockedWrites')}")
