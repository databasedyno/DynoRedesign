#!/usr/bin/env python3
"""
Codemod: move idiomatic float-rounding onto utils/money (exact decimal.js).

Patterns (semantics preserved, rounding made exact):
  Number(E.toFixed(N)) | parseFloat(E.toFixed(N))         -> toNumber(E, N)
  Number(E).toFixed(N).toString() | Number(E).toFixed(N)  -> toFixedStr(E, N)
  parseFloat(E).toFixed(N)                                -> toFixedStr(E, N)
  E.toFixed(N)                                            -> toFixedStr(E, N)
  Math.round(E * 10^k) / 10^k | Math.round(E * 1ek) / 1ek -> toNumber(E, k)
  Math.floor(E * 10^k) / 10^k                             -> toNumber(E, k, "down")
  Math.round(E * 1e8)  (bare, satoshi conversion)         -> Number(toBaseUnits(E))
Skips optional chaining (`?.toFixed`) and template/regex/comment contexts are not
special-cased (toFixed rarely appears there). Adds the money import per file.

Usage: python3 scripts/codemods/money_codemod.py [--apply] [paths...]
"""
import os, re, sys

ROOT = os.environ.get("CODEMOD_ROOT", "/app/backend")
APPLY = "--apply" in sys.argv
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
SKIP_DIRS = set(os.environ.get("CODEMOD_SKIP", "node_modules,dist,__tests__,scripts,coverage,logs").split(","))
SKIP_FILES = {"utils/money.ts"}
EXTS = tuple(os.environ.get("CODEMOD_EXTS", ".ts").split(","))
IMPORT_SPEC = os.environ.get("CODEMOD_IMPORT")  # e.g. "@/utils/money" for the Next.js alias

IDENT = re.compile(r"[A-Za-z_$][\w$]*")

def find_expr_start(s: str, end: int) -> int:
    """Return start index of the primary expression ending right before index `end`
    (end points at the '.' of '.toFixed' or at the char after the expression)."""
    i = end
    while True:
        # skip whitespace backwards
        j = i
        while j > 0 and s[j - 1] in " \t":
            j -= 1
        if j == 0:
            return i
        c = s[j - 1]
        if c in ")]":
            open_c = "(" if c == ")" else "["
            depth = 0
            k = j - 1
            while k >= 0:
                if s[k] == c:
                    depth += 1
                elif s[k] == open_c:
                    depth -= 1
                    if depth == 0:
                        break
                k -= 1
            if k < 0:
                return i
            i = k
            # a preceding identifier makes this a call/index: foo(...) / arr[...];
            # a preceding ')' or ']' means a chained access: a[0][1], f(x)(y)
            k2 = i
            while k2 > 0 and s[k2 - 1] in " \t":
                k2 -= 1
            mm = re.search(r"[\w$]+$", s[:k2])
            if mm and k2 == i:
                i = mm.start()
                continue
            if k2 == i and k2 > 0 and s[k2 - 1] in ")]":
                continue
            return i
        elif c.isalnum() or c in "_$":
            mm = re.search(r"[\w$]+$", s[:j])
            i = mm.start()
            # numeric literal like 1e8 / 0.5 handled by \w and '.'
            # check for preceding '.' member access or '?.'
            k2 = i
            while k2 > 0 and s[k2 - 1] in " \t":
                k2 -= 1
            if k2 >= 1 and s[k2 - 1] == "." and not (k2 >= 2 and s[k2 - 2] == "?"):
                # decimal literal like "1.5" -> keep scanning digits
                i = k2 - 1
                continue
            if k2 >= 2 and s[k2 - 2:k2] == "?.":
                return -1  # optional chaining: skip
            return i
        elif c == "." and not (j >= 2 and s[j - 2] == "?"):
            i = j - 1  # member access: keep walking to include the object (Math.abs(x))
            continue
        else:
            return i

def transform(src: str):
    out = src
    used = set()
    changes = 0

    # --- Pattern group 1: .toFixed(N) with wrappers -------------------------------------
    pat = re.compile(r"\.toFixed\(")
    pos = 0
    while True:
        m = pat.search(out, pos)
        if not m:
            break
        dot = m.start()
        # optional chaining directly before
        if out[dot - 1:dot] == "?":
            pos = m.end(); continue
        # find N argument (balanced)
        k = m.end(); depth = 1
        while k < len(out) and depth:
            if out[k] == "(": depth += 1
            elif out[k] == ")": depth -= 1
            k += 1
        n_arg = out[m.end():k - 1].strip() or "0"
        after = k
        start = find_expr_start(out, dot)
        if start < 0 or start >= dot:
            pos = m.end(); continue
        expr = out[start:dot].strip()
        # unwrap Number(...) / parseFloat(...) wrappers around expr
        wm = re.match(r"^(Number|parseFloat)\((.*)\)$", expr, re.S)
        if wm and balanced(wm.group(2)):
            expr = wm.group(2).strip()
        # what surrounds: Number( E.toFixed(N) ) or parseFloat( ... ) ?
        before = out[:start]
        bm = re.search(r"(Number|parseFloat)\(\s*$", before)
        tail = out[after:]
        tm = re.match(r"\s*\)", tail)
        if bm and tm:
            # Number(E.toFixed(N)) -> toNumber(E, N)
            new = f"toNumber({expr}, {n_arg})"
            s0 = bm.start(); e0 = after + tm.end()
            out = out[:s0] + new + out[e0:]
            used.add("toNumber"); changes += 1
            pos = s0 + len(new)
            continue
        # E.toFixed(N).toString() -> toFixedStr(E, N)
        ts = re.match(r"\.toString\(\)", tail)
        e0 = after + (ts.end() if ts else 0)
        new = f"toFixedStr({expr}, {n_arg})"
        out = out[:start] + new + out[e0:]
        used.add("toFixedStr"); changes += 1
        pos = start + len(new)

    # --- Pattern group 2: Math.round/floor(E * 10^k) / 10^k ------------------------------
    def pow_of_ten(tok: str):
        tok = tok.strip()
        m1 = re.fullmatch(r"1e(\d+)", tok)
        if m1: return int(m1.group(1))
        m2 = re.fullmatch(r"1(0+)", tok)
        if m2: return len(m2.group(1))
        m3 = re.fullmatch(r"Math\.pow\(10,\s*(\w+)\)", tok)
        if m3: return m3.group(1)
        return None

    pat2 = re.compile(r"Math\.(round|floor|ceil)\(")
    pos = 0
    while True:
        m = pat2.search(out, pos)
        if not m:
            break
        k = m.end(); depth = 1
        while k < len(out) and depth:
            if out[k] == "(": depth += 1
            elif out[k] == ")": depth -= 1
            k += 1
        inner = out[m.end():k - 1]
        mm = re.match(r"^\s*(.*?)\s*\*\s*([\w.]+(?:\([^()]*\))?)\s*$", inner, re.S)
        if not mm:
            pos = k; continue
        expr, factor = mm.group(1), mm.group(2)
        kpow = pow_of_ten(factor)
        if kpow is None or not balanced(expr):
            pos = k; continue
        tail = out[k:]
        dm = re.match(r"\s*/\s*([\w.]+(?:\([^()]*\))?)", tail)
        mode = m.group(1)
        if dm and pow_of_ten(dm.group(1)) == kpow:
            modearg = "" if mode == "round" else (', "down"' if mode == "floor" else ', "up"')
            new = f"toNumber({expr.strip()}, {kpow}{modearg})"
            out = out[:m.start()] + new + out[k + dm.end():]
            used.add("toNumber"); changes += 1
            pos = m.start() + len(new)
        elif mode == "round" and kpow == 8 and not dm and not IMPORT_SPEC:
            new = f"Number(toBaseUnits({expr.strip()}))"
            out = out[:m.start()] + new + out[k:]
            used.add("toBaseUnits"); changes += 1
            pos = m.start() + len(new)
        else:
            pos = k

    return out, used, changes

def balanced(s: str) -> bool:
    d = 0
    for ch in s:
        if ch == "(": d += 1
        elif ch == ")":
            d -= 1
            if d < 0: return False
    return d == 0

def rel_import(path: str) -> str:
    rel = os.path.relpath(os.path.join(ROOT, "utils/money"), os.path.dirname(path))
    if not rel.startswith("."):
        rel = "./" + rel
    return rel.replace(os.sep, "/")

def add_import(src: str, names, path: str) -> str:
    names = sorted(names)
    spec = IMPORT_SPEC or rel_import(path)
    m = re.search(r'^import \{([^}]*)\} from "((?:\.{1,2}/[^"]*|@/)utils/money)";\s*$', src, re.M)
    if m:
        have = [n.strip() for n in m.group(1).split(",") if n.strip()]
        merged = sorted(set(have) | set(names))
        return src[:m.start()] + f'import {{ {", ".join(merged)} }} from "{m.group(2)}";' + src[m.end():]
    line = f'import {{ {", ".join(names)} }} from "{spec}";'
    imports = list(re.finditer(r"^import [^;\n]*(;|['\"])[ \t]*$", src, re.M))
    if imports:
        last = imports[-1]
        return src[:last.end()] + "\n" + line + src[last.end():]
    return line + "\n" + src

def iter_files():
    targets = ARGS or [ROOT]
    for t in targets:
        if os.path.isfile(t):
            yield t; continue
        for dp, dns, fns in os.walk(t):
            dns[:] = [d for d in dns if d not in SKIP_DIRS and not d.startswith(".")]
            for fn in fns:
                if fn.endswith(EXTS) and not fn.endswith(".d.ts"):
                    p = os.path.join(dp, fn)
                    if os.path.relpath(p, ROOT) in SKIP_FILES: continue
                    yield p

total = 0; files = 0
for p in iter_files():
    src = open(p).read()
    if ".toFixed(" not in src and "Math.round(" not in src and "Math.floor(" not in src:
        continue
    new, used, n = transform(src)
    if n == 0:
        continue
    new = add_import(new, used, p)
    total += n; files += 1
    print(f"{n:3d}  {os.path.relpath(p, ROOT)}  {sorted(used)}")
    if APPLY:
        open(p, "w").write(new)
print(f"\n{'APPLIED' if APPLY else 'DRY RUN'}: {total} replacements in {files} files")
