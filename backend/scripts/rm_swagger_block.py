#!/usr/bin/env python3
"""Remove top-level swagger path blocks (e.g. "  '/api/pay/authStep': {") by brace matching."""
import re
import sys


def remove_block(src: str, key: str) -> str:
    idx = src.find(key)
    if idx < 0:
        print(f"  ! not found: {key.strip()}")
        return src
    line_start = src.rfind("\n", 0, idx) + 1
    brace = src.find("{", idx)
    depth = 0
    i = brace
    in_str = None
    while i < len(src):
        c = src[i]
        if in_str:
            if c == "\\":
                i += 2
                continue
            if c == in_str:
                in_str = None
        elif c in ("'", '"', "`"):
            in_str = c
        elif c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                break
        i += 1
    end = i + 1
    if end < len(src) and src[end] == ",":
        end += 1
    while end < len(src) and src[end] == "\n":
        end += 1
    # also swallow a preceding comment line that only introduces this block
    prev = src[:line_start]
    m = re.search(r"\n([ \t]*//[^\n]*\n)+$", prev)
    if m and key.split(":")[0].strip("' ").split("/")[-1].lower() in m.group(0).lower():
        line_start = m.start() + 1
    print(f"  - removed {key.strip()}")
    return src[:line_start] + src[end:]


if __name__ == "__main__":
    path = sys.argv[1]
    keys = sys.argv[2:]
    with open(path) as f:
        s = f.read()
    for k in keys:
        s = remove_block(s, k)
    with open(path, "w") as f:
        f.write(s)
