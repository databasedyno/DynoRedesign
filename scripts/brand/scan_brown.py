"""Scan source for any 'brown' hex colors (warm hue ~20-50 deg, mid saturation/lightness)."""
import os, re, colorsys

ROOTS = ["Components", "styles", "constants", "pages", "assets", "public", "helpers", "hooks", "utils", "contexts", "Redux", "lib", "i18n.js"]
EXCLUDE = ("node_modules", "_archive", ".next", ".git", "test_reports", "email_previews")
HEX = re.compile(r"#([0-9a-fA-F]{6})\b")
exts = (".ts", ".tsx", ".js", ".jsx", ".mjs", ".css", ".scss", ".svg", ".html")

def is_brown(r, g, b):
    h, l, s = colorsys.rgb_to_hls(r/255, g/255, b/255)
    hue = h * 360
    # brown = warm orange hue, not too light, not grayish, and clearly R>G>B
    return (18 <= hue <= 50) and (0.10 <= l <= 0.45) and (s >= 0.20) and (r > g > b)

hits = {}
for root in ROOTS:
    if os.path.isfile(root):
        walk = [(".", [], [root])]
    else:
        walk = os.walk(root)
    for dp, _, files in walk:
        if any(x in dp for x in EXCLUDE):
            continue
        for fn in files:
            if not fn.endswith(exts):
                continue
            p = os.path.join(dp, fn)
            try:
                txt = open(p, encoding="utf-8", errors="ignore").read()
            except Exception:
                continue
            for m in HEX.finditer(txt):
                hexv = m.group(1)
                r, g, b = int(hexv[0:2],16), int(hexv[2:4],16), int(hexv[4:6],16)
                if is_brown(r, g, b):
                    line = txt[:m.start()].count("\n") + 1
                    hits.setdefault(p, []).append((line, "#"+hexv))

if not hits:
    print("NO BROWN HEX COLORS FOUND in source.")
else:
    for p, lst in sorted(hits.items()):
        for line, hexv in lst:
            print(f"{p}:{line}: {hexv}")
    print(f"\nTOTAL brown hits: {sum(len(v) for v in hits.values())} across {len(hits)} files")
