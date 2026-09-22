#!/usr/bin/env python3
"""One-off rebrand sweep: indigo/violet → yellow (fills) / aqua (text, tints). Run from /app."""
import os, re, sys

ROOT = "/app"
SCOPE = ["Components", "pages", "hooks", "helpers", "utils", "contexts", "styles"]
EXCLUDE = ["/SafeDeal/", "constants/theme.ts", "styles/appTheme.ts", "/Home/v3/theme.v3.ts", "node_modules", ".next"]
ONLY = sys.argv[1:]  # optional path filters

FILL_KEYS = re.compile(r"(background(-color)?|backgroundColor|bgcolor|linear-gradient|radial-gradient|fill=|stroke=|boxShadow|box-shadow|border(Color)?:|outline)", re.I)

DEEP = {"#4f46e5", "#4338ca", "#3730a3", "#312e81", "#4c1d95", "#5b21b6", "#6c5ce7", "#5046e5", "#4e46e5", "#5b5bd6", "#6748e6"}
LIGHT = {"#818cf8", "#a5b4fc", "#c7d2fe", "#c4b5fd", "#a78bfa", "#6d74e8", "#7075e8", "#6366f1", "#5a6bef", "#6d70f5", "#9b6bff", "#7c5cff", "#8b5cf6", "#7c3aed", "#6d28d9", "#4fd1ff"}
TINT = {"#eef2ff": "#E6F7F5", "#e0e7ff": "#CDEDE9", "#eef0fd": "#E6F7F5", "#f0f5ff": "#E6F7F5", "#e6eeff": "#CDEDE9", "#f5f7ff": "#F0FAF9", "#f5f6fe": "#F0FAF9", "#e0e3f7": "#CDEDE9", "#ede9fe": "#E6F7F5", "#ddd6fe": "#CDEDE9", "#f5f3ff": "#F0FAF9", "#fbfaff": "#FAF6EF", "#f0f1fe": "#F3EDE2", "#3a3a5a": "#3A2A1F", "#0c1022": "#1A120D", "#090c16": "#0B0908", "#0b0f19": "#0B0908", "#111827": "#1A120D"}
RGBA = [
    (re.compile(r"rgba\(\s*(129|99|165|124|139|108)\s*,\s*(140|102|180|92|92|92)\s*,\s*(248|241|252|255|246|231)\s*,", re.I), "rgba(43,212,196,"),
    (re.compile(r"rgba\(\s*(79|67|55|49)\s*,\s*(70|56|48|46)\s*,\s*(229|202|163|129)\s*,", re.I), "rgba(15,143,134,"),
]
HEX_RE = re.compile(r"#([0-9a-fA-F]{6})\b")
WHITE_RE = re.compile(r"""color:\s*(['"])(#fff|#FFF|#ffffff|#FFFFFF|white)\1""")

YELLOW, YELLOW_DEEP, AQUA, AQUA_DEEP, AMBER = "#FFD100", "#F0C300", "#2BD4C4", "#0F8F86", "#FFB300"

def convert_line(line: str) -> str:
    orig = line
    is_fill = bool(FILL_KEYS.search(line))
    def hex_sub(m):
        h = "#" + m.group(1).lower()
        if h in TINT: return TINT[h]
        if h in DEEP:
            if is_fill: return YELLOW_DEEP if "hover" in line.lower() else YELLOW
            return AQUA_DEEP
        if h in LIGHT:
            if is_fill:
                if h in {"#7c5cff", "#8b5cf6", "#7c3aed", "#6d28d9", "#a78bfa", "#c4b5fd"}: return AMBER
                return YELLOW
            return AQUA
        return m.group(0)
    line = HEX_RE.sub(hex_sub, line)
    for rx, rep in RGBA: line = rx.sub(rep, line)
    if line != orig and is_fill and (YELLOW in line or YELLOW_DEEP in line or AMBER in line):
        line = WHITE_RE.sub(lambda m: f"color: {m.group(1)}#2B1D14{m.group(1)}", line)
    return line

changed = {}
for base in SCOPE:
    for dp, _, files in os.walk(os.path.join(ROOT, base)):
        for fn in files:
            if not fn.endswith((".ts", ".tsx", ".css")): continue
            p = os.path.join(dp, fn)
            rel = os.path.relpath(p, ROOT)
            if any(x in rel or x in p for x in EXCLUDE): continue
            if ONLY and not any(o in rel for o in ONLY): continue
            src = open(p, encoding="utf-8").read()
            out = "\n".join(convert_line(l) for l in src.split("\n"))
            if out != src:
                open(p, "w", encoding="utf-8").write(out)
                changed[rel] = sum(1 for a, b in zip(src.split("\n"), out.split("\n")) if a != b)
for k, v in sorted(changed.items(), key=lambda kv: -kv[1]): print(v, k)
print("files changed:", len(changed))
