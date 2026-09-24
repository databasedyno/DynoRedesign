"""One-off palette migration: warm brown/cream tokens → Bybit neutral greys (2026-09).
Usage: python3 scripts/migrate-brown-palette.py [--apply]
"""
import os
import re
import sys

ROOTS = ["Components", "Containers", "Redux", "api", "helpers", "pages", "styles", "constants", "contexts", "hooks", "utils", "lib", "public/site.webmanifest"]
EXT = (".ts", ".tsx", ".css", ".scss", ".js", ".jsx", ".webmanifest")
SKIP = ("Components/SafeDeal/sdTheme.ts",)

HEX = {
    "0B0908": "0A0A0D",
    "1A120D": "101014",
    "22170F": "0F1013",
    "2B1D14": "121214",
    "3A2A1F": "222227",
    "4E3B2E": "404347",
    "1F140D": "121214",
    "5C4B3E": "6A6E73",
    "7A6A5C": "81858C",
    "FAF6EF": "F5F7FA",
    "FFFDF7": "FFFFFF",
    "F3EDE2": "E9ECF0",
    "EAE1D3": "E1E5EA",
    "E8DFD2": "E1E5EA",
    "D6C9B6": "D5DAE0",
    "D9CFC2": "ADB1B8",
    "A99A8A": "81858C",
}
RGBA = {
    (255, 240, 210): (255, 255, 255),
    (255, 253, 247): (255, 255, 255),
    (43, 29, 20): (18, 18, 20),
}

hex_re = re.compile(r"#(" + "|".join(HEX) + r")\b", re.I)
rgba_re = re.compile(r"rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(,|\))")


def migrate(text: str) -> str:
    text = hex_re.sub(lambda m: "#" + HEX[m.group(1).upper()], text)

    def rgba(m):
        key = (int(m.group(1)), int(m.group(2)), int(m.group(3)))
        if key not in RGBA:
            return m.group(0)
        r, g, b = RGBA[key]
        return f"rgba({r},{g},{b}{m.group(4)}" if m.group(4) == "," else f"rgb({r},{g},{b})"

    return rgba_re.sub(rgba, text)


def walk():
    for root in ROOTS:
        if os.path.isfile(root):
            yield root
            continue
        for dp, _, fn in os.walk(root):
            for f in fn:
                if f.endswith(EXT):
                    yield os.path.join(dp, f)


apply = "--apply" in sys.argv
changed = 0
for p in walk():
    if p in SKIP:
        continue
    src = open(p, encoding="utf-8").read()
    out = migrate(src)
    if out != src:
        changed += 1
        print(("APPLY " if apply else "would change ") + p)
        if apply:
            open(p, "w", encoding="utf-8").write(out)
print(f"{changed} files")
