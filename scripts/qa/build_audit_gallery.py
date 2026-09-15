#!/usr/bin/env python3
"""Build the Phase-1 audit gallery → /app/public/audit/index.html (served by Next.js at /audit/index.html).
Inputs: plan/audit/emails/html/manifest.json, plan/audit/emails/email_audit.json, public/audit/pages/results_*.json,
plan/audit/findings.json (verdicts/severity per item)."""
import json, html, os
from pathlib import Path

PUB = Path("/app/public/audit")
PLAN = Path("/app/plan/audit")
esc = html.escape

emails = json.load(open(PLAN / "emails/email_audit.json")) if (PLAN / "emails/email_audit.json").exists() else json.load(open(PLAN / "emails/html/manifest.json"))
findings = json.load(open(PLAN / "findings.json")) if (PLAN / "findings.json").exists() else {}
pages = []
for f in ["results_public.json", "results_inapp.json"]:
    if (PUB / "pages" / f).exists():
        pages += json.load(open(PUB / "pages" / f))

SEV_ORDER = {"blocker": 0, "should fix": 1, "polish": 2, "keep": 3}
SEV_CLASS = {"blocker": "b", "should fix": "s", "polish": "p", "keep": "k", "retire": "r", "merge": "s"}
AUD = {"M": "Merchant", "B": "Buyer", "A": "Admin/ops"}

def sev_chip(sev, verdict=None):
    if not sev and not verdict: return '<span class="chip k">not scored</span>'
    label = (verdict or sev)
    return f'<span class="chip {SEV_CLASS.get(sev or verdict, "k")}">{esc(label)}</span>' + (f' <span class="chip {SEV_CLASS.get(sev, "k")}">{esc(sev)}</span>' if sev and verdict and sev != verdict else "")

def finding_for(key):
    return findings.get(key) or {}

# ── Emails ──
fam_groups = {}
for e in emails:
    fam_groups.setdefault(e["family"], []).append(e)

email_sections = []
for fam, items in fam_groups.items():
    cards = []
    for e in items:
        if not e.get("file"):
            continue
        slug = e["slug"]
        fk = f"email:{e['sender']}"
        fd = finding_for(fk) or finding_for(f"email:{e['sender']}:{e['variant']}")
        shots = "".join(
            f'<a href="emails/{slug}__{w}__{m}.png" target="_blank" title="{w}px · {m}"><img loading="lazy" src="emails/{slug}__{w}__{m}.png" alt="{esc(slug)} {w} {m}"><span>{w} · {m}</span></a>'
            for w in (600, 390) for m in ("light", "dark", "gmail")
        )
        flags = [f for f in e.get("flags", []) if not f.startswith("footer") and "text runs" not in f]
        cards.append(f'''
        <article class="card" id="{esc(slug)}">
          <header><div><b>{esc(e["sender"])}</b>{(" · <i>" + esc(e["variant"]) + "</i>") if e["variant"] else ""} <span class="aud">{AUD.get(e["audience"], e["audience"])}</span></div>
          <div>{sev_chip(fd.get("severity"), fd.get("verdict"))}</div></header>
          <p class="subj"><b>Subject:</b> {esc(e["subject"])} <span class="muted">({len(e["subject"])} chars)</span> · <a href="../plan-audit-html/{esc(e["file"])}" class="muted" onclick="return false">{esc(e["file"])}</a></p>
          {("<p class='note'>" + esc(fd["note"]) + "</p>") if fd.get("note") else ""}
          {("<ul class='flags'>" + "".join(f"<li>{esc(f)}</li>" for f in flags) + "</ul>") if flags else ""}
          <div class="shots">{shots}</div>
        </article>''')
    email_sections.append(f'<section><h3>{esc(fam)} <span class="muted">({len([i for i in items if i.get("file")])})</span></h3>{"".join(cards)}</section>')

# ── Pages ──
page_groups = {}
for p in pages:
    page_groups.setdefault(p["group"], {}).setdefault(p["id"], []).append(p)
GROUP_TITLE = {"public": "Public marketing & auth pages", "checkout": "Hosted checkout & buyer pages", "creator": "Creator public pages", "inapp": "Remaining in-app pages"}
page_sections = []
for grp in ["public", "checkout", "creator", "inapp"]:
    routes = page_groups.get(grp, {})
    cards = []
    for rid, shots in routes.items():
        fd = finding_for(f"page:{rid}")
        path = shots[0]["path"]
        issues = []
        for s in shots:
            if s.get("error"): issues.append(f'{s["theme"]} {s["w"]}: load error {s["error"][:80]}')
            if s.get("overflow"): issues.append(f'{s["theme"]} {s["w"]}: horizontal overflow ({s["scrollWidth"]}/{s["innerWidth"]}) ' + " | ".join(s.get("offenders", [])[:2]))
            if s.get("clipped"): issues.append(f'{s["theme"]} {s["w"]}: clipped text ' + " | ".join(s["clipped"][:2]))
            if s.get("rawKeys"): issues.append(f'{s["theme"]} {s["w"]}: raw i18n keys ' + ",".join(s["rawKeys"]))
            if s.get("errors"): issues.append(f'{s["theme"]} {s["w"]}: JS error ' + " | ".join(s["errors"][:1]))
            if s.get("gateway"): issues.append(f'{s["theme"]} {s["w"]}: gateway error page')
        redirect = next((s["finalUrl"] for s in shots if s.get("finalUrl") and s["finalUrl"] != s["path"]), None)
        imgs = "".join(
            f'<a href="pages/{s["file"]}" target="_blank" title="{s["w"]} · {s["theme"]}"><img loading="lazy" src="pages/{s["file"]}" alt="{esc(rid)} {s["w"]} {s["theme"]}"><span>{s["w"]} · {s["theme"]}</span></a>'
            for s in sorted(shots, key=lambda x: (x["theme"], x["w"])) if not s.get("error")
        )
        cards.append(f'''
        <article class="card" id="page-{esc(rid)}">
          <header><div><b>{esc(rid)}</b> <code>{esc(path)}</code>{(" → <code>" + esc(redirect) + "</code>") if redirect else ""}</div><div>{sev_chip(fd.get("severity"), fd.get("verdict"))}</div></header>
          {("<p class='note'>" + esc(fd["note"]) + "</p>") if fd.get("note") else ""}
          {("<ul class='flags'>" + "".join(f"<li>{esc(i)}</li>" for i in sorted(set(issues))[:8]) + "</ul>") if issues else ""}
          <div class="shots pages">{imgs}</div>
        </article>''')
    if cards:
        page_sections.append(f'<section id="{grp}"><h2>{GROUP_TITLE[grp]} <span class="muted">({len(routes)} routes)</span></h2>{"".join(cards)}</section>')

n_email = len([e for e in emails if e.get("file")])
n_pages = len({p["id"] for p in pages})
n_blk = sum(1 for v in findings.values() if v.get("severity") == "blocker")
n_sf = sum(1 for v in findings.values() if v.get("severity") == "should fix")
n_pol = sum(1 for v in findings.values() if v.get("severity") == "polish")

page = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Dynopay — Phase 1 audit gallery</title>
<style>
:root{{--bg:#0b0f19;--panel:#111827;--line:#1f2937;--txt:#e5e7eb;--mut:#9ca3af;--acc:#818cf8}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--txt);font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif}}
header.top{{position:sticky;top:0;z-index:5;background:rgba(11,15,25,.92);backdrop-filter:blur(12px);border-bottom:1px solid var(--line);padding:14px 24px;display:flex;gap:18px;align-items:center;flex-wrap:wrap}}
header.top h1{{font-size:18px;margin:0}}header.top nav a{{color:var(--acc);margin-right:14px;text-decoration:none;font-weight:600}}
main{{max-width:1500px;margin:0 auto;padding:24px}}
h2{{font-size:20px;margin:36px 0 10px;border-left:4px solid var(--acc);padding-left:10px}}h3{{font-size:15px;margin:22px 0 8px;color:var(--acc);text-transform:uppercase;letter-spacing:.06em}}
.card{{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:14px 16px;margin:0 0 14px}}
.card header{{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}}.card code{{background:#0b0f19;padding:2px 6px;border-radius:6px;color:#c7d2fe}}
.subj{{margin:6px 0;font-size:13px}}.muted{{color:var(--mut);font-weight:400}}.aud{{font-size:11px;background:#1e293b;color:#cbd5e1;padding:1px 7px;border-radius:999px;margin-left:6px}}
.note{{margin:6px 0;color:#fde68a;font-size:13px}}.flags{{margin:6px 0 8px;padding-left:18px;color:#fca5a5;font-size:12.5px}}
.shots{{display:flex;gap:10px;overflow-x:auto;padding:6px 0 4px}}.shots a{{flex:0 0 auto;text-align:center;color:var(--mut);font-size:11px;text-decoration:none}}
.shots img{{height:260px;width:auto;max-width:360px;object-fit:cover;object-position:top;border:1px solid var(--line);border-radius:8px;background:#fff;display:block;margin-bottom:3px;transition:transform .15s}}
.shots img:hover{{transform:translateY(-2px);border-color:var(--acc)}}.shots.pages img{{height:300px}}
.chip{{display:inline-block;font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;background:#1f2937;color:#cbd5e1;letter-spacing:.02em}}
.chip.b{{background:#7f1d1d;color:#fecaca}}.chip.s{{background:#78350f;color:#fde68a}}.chip.p{{background:#1e3a8a;color:#bfdbfe}}.chip.k{{background:#064e3b;color:#a7f3d0}}.chip.r{{background:#374151;color:#e5e7eb}}
.stats{{display:flex;gap:10px;flex-wrap:wrap;margin:10px 0 0}}.stats div{{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:8px 14px}}.stats b{{font-size:18px;display:block}}
</style></head><body>
<header class="top"><h1>Dynopay · Phase 1 audit gallery</h1><nav><a href="#emails">Emails</a><a href="#public">Public</a><a href="#checkout">Checkout</a><a href="#creator">Creator</a><a href="#inapp">In-app</a><a href="/audit/audit_phase1.md" target="_blank">Report (md)</a></nav>
<span class="muted">Generated from SAFE MODE renders — nothing sent, nothing mutated. Click a thumbnail for the full-size shot.</span></header>
<main>
<div class="stats"><div><b>{n_email}</b>emails rendered (600 + 390 px · light / dark / Gmail-inversion)</div><div><b>{n_pages}</b>routes shot (390 / 820 / 1366 / 1920 · light + dark)</div><div><b>{n_blk}</b>blockers</div><div><b>{n_sf}</b>should fix</div><div><b>{n_pol}</b>polish</div></div>
<section id="emails"><h2>Emails <span class="muted">({n_email})</span></h2>{"".join(email_sections)}</section>
{"".join(page_sections)}
</main></body></html>'''
(PUB / "index.html").write_text(page, encoding="utf-8")
print(f"gallery → {PUB/'index.html'} · emails={n_email} routes={n_pages} findings={len(findings)}")
