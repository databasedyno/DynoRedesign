#!/usr/bin/env python3
"""
Wider Primitive Rollout — accent wave.

Replaces the hardcoded brand hex "#4F46E5" with the `BRAND_ACCENT` token in
frontend files, context-aware so we never break syntax:

  - JSX attribute:  prop="#4F46E5"      -> prop={BRAND_ACCENT}
  - Value position: color: "#4F46E5"    -> color: BRAND_ACCENT
                    fn("#4F46E5")        -> fn(BRAND_ACCENT)
                    const x = "#4F46E5"  -> const x = BRAND_ACCENT

Only quoted standalone hexes are touched. Bare hexes inside template literals
(e.g. styled-components `box-shadow: 0 0 0 #4F46E5`) are LEFT and reported as
residuals for a manual follow-up. Backend files are out of scope (no @/ alias).

Guarded by a tsc baseline-diff run by the caller — any new parse/name error
means revert.
"""

import os
import re

ROOT = os.path.join(os.path.dirname(__file__), "..")
SCAN_DIRS = ["Components", "pages", "styles"]
IMPORT_RE = re.compile(r'import\s*\{[^}]*\bBRAND_ACCENT\b[^}]*\}\s*from\s*["\']@/constants/theme["\']')
IMPORT_LINE = 'import { BRAND_ACCENT } from "@/constants/theme";'


def iter_files():
    for d in SCAN_DIRS:
        for base, _, files in os.walk(os.path.join(ROOT, d)):
            if "node_modules" in base:
                continue
            for fn in files:
                if fn.endswith((".ts", ".tsx")):
                    yield os.path.join(base, fn)


def add_import(text: str) -> str:
    if IMPORT_RE.search(text):
        return text  # BRAND_ACCENT already imported
    lines = text.split("\n")
    last_import_idx = -1
    for i, line in enumerate(lines):
        s = line.strip()
        if s.startswith("import ") and s.endswith(";"):
            last_import_idx = i
    if last_import_idx == -1:
        insert_at = 0
        for i, line in enumerate(lines[:3]):
            if line.strip().startswith(('"use', "'use")):
                insert_at = i + 1
        lines.insert(insert_at, IMPORT_LINE)
    else:
        lines.insert(last_import_idx + 1, IMPORT_LINE)
    return "\n".join(lines)


def main() -> None:
    total_files = 0
    total_repl = 0
    residual_files = []
    for path in iter_files():
        with open(path, "r", encoding="utf-8") as f:
            text = f.read()
        if "#4F46E5" not in text:
            continue
        rel = os.path.relpath(path, ROOT)
        new = text
        # 1) JSX attributes (no spaces around '=') -> expression container
        new = re.sub(r'([A-Za-z0-9_]+)="#4F46E5"', r"\1={BRAND_ACCENT}", new)
        new = re.sub(r"([A-Za-z0-9_]+)='#4F46E5'", r"\1={BRAND_ACCENT}", new)
        # 2) Quoted standalone value positions
        new = new.replace('"#4F46E5"', "BRAND_ACCENT")
        new = new.replace("'#4F46E5'", "BRAND_ACCENT")

        n_repl = text.count("#4F46E5") - new.count("#4F46E5")
        if n_repl > 0 and new != text:
            new = add_import(new)
            with open(path, "w", encoding="utf-8") as f:
                f.write(new)
            total_files += 1
            total_repl += n_repl
            residual = new.count("#4F46E5")
            tag = f" | RESIDUAL bare-hex x{residual}" if residual else ""
            print(f"{rel}: {n_repl} replaced{tag}")
        elif "#4F46E5" in new:
            residual_files.append((rel, new.count("#4F46E5")))

    print(f"\nTOTAL: {total_repl} replacements across {total_files} files")
    if residual_files:
        print("Files with ONLY bare-hex residuals (left for manual review):")
        for rel, c in residual_files:
            print(f"  {rel}: {c}")


if __name__ == "__main__":
    main()
