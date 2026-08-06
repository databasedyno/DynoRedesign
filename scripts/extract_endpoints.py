#!/usr/bin/env python3
"""Extract + classify inline API endpoints for the endpoints-migration wave."""
import os
import re

ROOT = os.path.join(os.path.dirname(__file__), "..")
SCAN = ["Components", "pages"]

# axiosBaseApi.<method>(  and  fetch(
CALL_RE = re.compile(r'(axiosBaseApi\.(?:get|post|put|delete|patch)|fetch)\s*\(')


def capture_arg(text, start):
    """Capture the first-arg string/template starting at index `start` (points at char after '(' )."""
    i = start
    n = len(text)
    # skip whitespace
    while i < n and text[i] in " \t\n":
        i += 1
    if i >= n or text[i] not in "\"'`":
        return None, i
    quote = text[i]
    j = i + 1
    buf = quote
    depth = 0
    while j < n:
        c = text[j]
        buf += c
        if c == "\\":
            j += 2
            if j <= n:
                buf += text[j - 1]
            continue
        if quote == "`" and c == "$" and j + 1 < n and text[j + 1] == "{":
            depth += 1
        elif quote == "`" and c == "}" and depth > 0:
            depth -= 1
        elif c == quote and depth == 0:
            return buf, j + 1
        j += 1
    return buf, j


def main():
    statics = {}
    dynamics = {}
    for d in SCAN:
        for base, _, files in os.walk(os.path.join(ROOT, d)):
            if "node_modules" in base:
                continue
            for fn in files:
                if not fn.endswith((".ts", ".tsx")):
                    continue
                path = os.path.join(base, fn)
                with open(path, encoding="utf-8") as f:
                    text = f.read()
                for m in CALL_RE.finditer(text):
                    arg, _ = capture_arg(text, m.end())
                    if not arg:
                        continue
                    inner = arg[1:-1]
                    # only care about API paths
                    if not (inner.startswith("/api/") or inner.startswith("/") ):
                        continue
                    is_fetch = m.group(1) == "fetch"
                    if is_fetch and not inner.startswith("/api/"):
                        continue
                    if "${" in arg:
                        dynamics[arg] = dynamics.get(arg, 0) + 1
                    else:
                        statics[arg] = statics.get(arg, 0) + 1
    print(f"STATIC unique={len(statics)} total={sum(statics.values())}")
    for k in sorted(statics):
        print(f"  [{statics[k]}] {k}")
    print(f"\nDYNAMIC unique={len(dynamics)} total={sum(dynamics.values())}")
    for k in sorted(dynamics):
        print(f"  [{dynamics[k]}] {k}")


if __name__ == "__main__":
    main()
