#!/usr/bin/env python3
"""Inventory every email builder: hero? CTA? subject source. Usage: python3 scripts/audit_email_builders.py"""
import re, glob, os, sys

root = os.path.join(os.path.dirname(__file__), "..")
rows = []
for f in sorted(glob.glob(os.path.join(root, "services/email/*.ts"))):
    src = open(f).read()
    # split on exported async functions
    parts = re.split(r"\nexport (?:const|async function) ", src)
    for part in parts[1:]:
        name = re.match(r"([A-Za-z0-9_]+)", part).group(1)
        if not name.startswith("send"):
            continue
        body = part
        uses_tpl = "dynoPayEmailTemplate(" in body or "dynoPayGreetingTemplate(" in body or "baseEmailTemplate(" in body
        hero = re.search(r"hero:\s*['\"]([a-z-]+)['\"]", body)
        if not hero:
            # positional 8th arg of dynoPayEmailTemplate: ..., L, 'hero')
            hero = re.search(r",\s*(?:L|lang|userLang|undefined|null|\"\"|'')\s*,\s*['\"]([a-z-]+)['\"]\s*\)", body)
        if not hero:
            hero = re.search(r"dynoPayGreetingTemplate\([^;]*?,\s*['\"]([a-z-]+)['\"]", body, re.S)
        cta = bool(re.search(r"dynoPayEmailTemplate\([^;]*?,\s*true\s*,", body, re.S)) or "cta:" in body or "cta = " in body or "showButton: true" in body or "buttonText" in body or "<a " in body
        subj = re.search(r"subject\s*=\s*([^;\n]+)", body)
        rows.append((os.path.basename(f), name, uses_tpl, hero.group(1) if hero else "-", "yes" if cta else "NO", (subj.group(1)[:70] if subj else "?")))

w = max(len(r[1]) for r in rows)
print(f"{'file':28} {'fn':{w}} tpl hero            cta  subject")
for r in rows:
    print(f"{r[0]:28} {r[1]:{w}} {'y' if r[2] else 'n'}   {r[3]:15} {r[4]:4} {r[5]}")
print(f"\n{len(rows)} builders; no-hero={sum(1 for r in rows if r[3]=='-')}; no-cta={sum(1 for r in rows if r[4]=='NO')}")
