#!/usr/bin/env python3
"""Assemble /app/plan/audit_phase1.md from findings.json + email_audit.json + page results (+ hand-written summary)."""
import json
from pathlib import Path

PLAN = Path("/app/plan/audit"); PUB = Path("/app/public/audit")
F = json.load(open(PLAN / "findings.json"))
E = json.load(open(PLAN / "emails/email_audit.json"))
pages = []
for f in ["results_public.json", "results_inapp.json"]:
    if (PUB / "pages" / f).exists(): pages += json.load(open(PUB / "pages" / f))
AUD = {"M": "merchant", "B": "buyer", "A": "admin/ops"}
GAL = "/audit/index.html"

def sev(k): return F.get(k, {}).get("severity", "—")
def verdict(k): return F.get(k, {}).get("verdict", "—")
def note(k): return F.get(k, {}).get("note", "")

lines = []
lines.append(open(PLAN / "audit_phase1_head.md").read())

# ── emails per family ──
lines.append("\n## 3. Emails — every sender (138 renders, 21 files)\n")
lines.append(f"Shots: `{GAL}#emails` (600 + 390 px · light / dark / Gmail-inversion). Verdict keys: keep · fix · merge · retire. Severity: blocker · should fix · polish.\n")
fams = {}
for e in E: fams.setdefault(e["family"], []).append(e)
for fam, items in fams.items():
    lines.append(f"\n### {fam}\n")
    lines.append("| # | Sender · variant | Audience | Subject (chars) | Verdict | Severity | Auto-flags | Notes / fields to add or remove |")
    lines.append("|---|---|---|---|---|---|---|---|")
    for e in items:
        k = f"email:{e['sender']}"
        flags = "; ".join(f for f in e.get("flags", []) if not f.startswith("footer") and "text runs" not in f) or "—"
        shot = f"[shot]({GAL}#{e['slug']})"
        lines.append(f"| {e['n']} | `{e['sender']}`{(' · ' + e['variant']) if e['variant'] else ''} {shot} | {AUD.get(e['audience'])} | {e['subject'].replace('|', '/')} ({len(e['subject'])}) | {verdict(k)} | {sev(k)} | {flags} | {note(k).replace('|', '/')} |")

# ── pages ──
groups = {}
for p in pages: groups.setdefault(p["group"], {}).setdefault(p["id"], []).append(p)
TITLES = {"public": "4. Public marketing & auth pages", "checkout": "5. Hosted checkout & buyer pages", "creator": "6. Creator public pages", "inapp": "7. Remaining in-app pages"}
for grp in ["public", "checkout", "creator", "inapp"]:
    lines.append(f"\n## {TITLES[grp]}\n")
    lines.append(f"Shots: `{GAL}#{grp}` (390 / 820 / 1366 / 1920 · light + dark, full page).\n")
    lines.append("| Route | Final URL | Verdict | Severity | Sweep result (overflow / clipped / raw keys / JS / 502) | Notes |")
    lines.append("|---|---|---|---|---|---|")
    for rid, shots in groups.get(grp, {}).items():
        k = f"page:{rid}"
        red = next((s["finalUrl"] for s in shots if s.get("finalUrl") and s["finalUrl"] != s["path"]), "")
        ovf = sum(1 for s in shots if s.get("overflow")); clip = sum(1 for s in shots if s.get("clipped")); raw = sum(1 for s in shots if s.get("rawKeys"))
        js = sum(1 for s in shots if s.get("errors")); gw = sum(1 for s in shots if s.get("gateway") or s.get("error"))
        res = f"{len(shots)} shots · overflow {ovf} · clipped {clip} · raw-keys {raw} · JS {js} · 502/abort {gw}"
        lines.append(f"| `{shots[0]['path']}` | {red or '—'} | {verdict(k)} | {sev(k)} | {res} | {note(k).replace('|', '/')} |")

lines.append(open(PLAN / "audit_phase1_tail.md").read())
Path("/app/plan/audit_phase1.md").write_text("\n".join(lines), encoding="utf-8")
Path("/app/public/audit/audit_phase1.md").write_text("\n".join(lines), encoding="utf-8")
print("report written:", len(lines), "lines")
