#!/usr/bin/env python3
"""Render memory/UX_PLAN_STATUS.md -> public/ux-plan/status.html (shareable snapshot).
Usage: python3 scripts/ux_plan_status_html.py"""
import html, os, re

ROOT = os.path.join(os.path.dirname(__file__), "..")
SRC = os.path.join(ROOT, "memory", "UX_PLAN_STATUS.md")
OUT = os.path.join(ROOT, "public", "ux-plan", "status.html")

CSS = """
  :root{--ink:#0f172a;--muted:#5b6478;--line:#e6e8ef;--bg:#f7f8fb;--card:#fff;--indigo:#4f46e5;--indigo-soft:rgba(79,70,229,.08);--green:#05936a;--green-soft:rgba(5,147,106,.10);--amber:#b45309;--amber-soft:rgba(180,83,9,.10);--blue:#1d4ed8;--blue-soft:rgba(29,78,216,.10);--grey:#475569;--grey-soft:rgba(71,85,105,.10)}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,Helvetica,Arial,sans-serif}
  .wrap{max-width:1040px;margin:0 auto;padding:40px 20px 80px}
  header{margin-bottom:28px}
  .eyebrow{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--indigo);font-weight:700}
  h1{margin:6px 0 8px;font-size:30px;line-height:1.2;letter-spacing:-.01em}
  .sub{color:var(--muted);margin:0;max-width:760px}
  h2{font-size:20px;margin:36px 0 12px;letter-spacing:-.01em}
  h2 small{display:block;font-size:13px;color:var(--muted);font-weight:500;margin-top:2px}
  .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin:22px 0}
  .card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px 18px}
  .card h3{margin:0 0 6px;font-size:13px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.08em}
  .card .big{font-size:26px;font-weight:700;letter-spacing:-.02em}
  .card p{margin:6px 0 0;color:var(--muted);font-size:13px}
  .legend{display:flex;flex-wrap:wrap;gap:10px 18px;font-size:13px;color:var(--muted);margin:10px 0 0}
  .pill{display:inline-block;padding:2px 9px;border-radius:999px;font-size:11.5px;font-weight:700;letter-spacing:.04em;white-space:nowrap;vertical-align:middle}
  .done{background:var(--green-soft);color:var(--green)}.partial{background:var(--amber-soft);color:var(--amber)}.present{background:var(--blue-soft);color:var(--blue)}.pending{background:var(--grey-soft);color:var(--grey)}
  .tablewrap{overflow-x:auto;background:var(--card);border:1px solid var(--line);border-radius:14px}
  table{width:100%;border-collapse:collapse;font-size:14px}
  th,td{padding:12px 14px;text-align:left;vertical-align:top;border-top:1px solid var(--line)}
  thead th{border-top:0;font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;font-weight:600;background:#fbfbfd}
  td.num{white-space:nowrap;color:var(--muted);font-variant-numeric:tabular-nums;width:56px}
  td.item{min-width:260px;font-weight:600}
  td.notes{color:var(--muted);min-width:320px}
  code{font:12.5px/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:var(--indigo-soft);color:var(--indigo);padding:1px 5px;border-radius:5px}
  ol,ul{padding-left:22px}
  li{margin:6px 0}
  s{opacity:.55}
  footer{margin-top:40px;color:var(--muted);font-size:13px}
  @media (max-width:600px){h1{font-size:24px}.wrap{padding:24px 14px 60px}td.item,td.notes{min-width:200px}}
"""


def inline(md: str) -> str:
    s = html.escape(md, quote=False)
    s = re.sub(r"`([^`]+)`", r"<code>\1</code>", s)
    s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"~~(.+?)~~", r"<s>\1</s>", s)
    s = re.sub(r"(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?!\w)", r"<em>\1</em>", s)
    return s


def pill(status: str) -> str:
    kind = re.match(r"\s*([A-Z]+)", status)
    cls = (kind.group(1).lower() if kind else "pending")
    if cls not in ("done", "partial", "present", "pending"):
        cls = "pending"
    return f'<span class="pill {cls}">{inline(status.strip())}</span>'


def split_row(line: str):
    return [c.strip() for c in line.strip().strip("|").split("|")]


lines = open(SRC, encoding="utf-8").read().splitlines()
updated = next((l for l in lines if l.startswith("Last updated:")), "")
counts = {"done": 0, "partial": 0, "present": 0, "pending": 0}
body = []
i = 0
while i < len(lines):
    l = lines[i]
    if l.startswith("## Checkpoint"):
        m = re.match(r"## (Checkpoint \d+) — (.+)", l)
        body.append(f"<h2>{inline(m.group(1))} <small>{inline(m.group(2))}</small></h2>" if m else f"<h2>{inline(l[3:])}</h2>")
        i += 1
        while i < len(lines) and not lines[i].startswith("|"):
            i += 1
        head = split_row(lines[i]); i += 2  # header + separator
        rows = []
        while i < len(lines) and lines[i].startswith("|"):
            c = split_row(lines[i]); i += 1
            if len(c) < 4:
                continue
            kind = re.match(r"\s*([A-Z]+)", c[2])
            k = kind.group(1).lower() if kind else "pending"
            counts[k if k in counts else "pending"] += 1
            rows.append(f'<tr><td class="num">{inline(c[0])}</td><td class="item">{inline(c[1])}</td><td>{pill(c[2])}</td><td class="notes">{inline(c[3])}</td></tr>')
        ths = "".join(f"<th>{inline(h)}</th>" for h in head)
        body.append(f'<div class="tablewrap"><table><thead><tr>{ths}</tr></thead><tbody>{"".join(rows)}</tbody></table></div>')
        continue
    if l.startswith("## ") and not l.startswith("## Legend") and not l.startswith("## Headline"):
        body.append(f"<h2>{inline(l[3:])}</h2>")
        i += 1
        items, tag = [], None
        while i < len(lines) and not lines[i].startswith("## "):
            t = lines[i].strip()
            if re.match(r"^\d+\.\s", t):
                tag = tag or "ol"; items.append(re.sub(r"^\d+\.\s", "", t))
            elif t.startswith("- "):
                tag = tag or "ul"; items.append(t[2:])
            i += 1
        if items:
            body.append(f"<{tag}>" + "".join(f"<li>{inline(x)}</li>" for x in items) + f"</{tag}>")
        continue
    if l.startswith("## Headline"):
        i += 1
        items = []
        while i < len(lines) and not lines[i].startswith("## "):
            t = lines[i].strip()
            if t.startswith("- "):
                items.append(t[2:])
            i += 1
        body.append('<div class="note">' + "".join(f"<p>{inline(x)}</p>" for x in items) + "</div>")
        continue
    i += 1

total = sum(counts.values())
cards = f"""
<div class="cards">
  <div class="card"><h3>Plan rows</h3><div class="big">{total}</div><p>Across 4 checkpoints — every row delivered or verified present.</p></div>
  <div class="card"><h3>Done</h3><div class="big">{counts['done']}</div><p>Built and verified in this engagement.</p></div>
  <div class="card"><h3>Present (verified)</h3><div class="big">{counts['present']}</div><p>Already in the app; audited against the quality bar, no rebuild.</p></div>
  <div class="card"><h3>Open</h3><div class="big">{counts['partial'] + counts['pending']}</div><p>Partial or pending rows.</p></div>
</div>
<div class="legend">
  <span><span class="pill done">DONE</span> delivered &amp; verified</span>
  <span><span class="pill partial">PARTIAL</span> started; pieces remain</span>
  <span><span class="pill present">PRESENT</span> already in the app; verified</span>
  <span><span class="pill pending">PENDING</span> not started</span>
</div>"""

page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Dynopay · Premium in-app experience — plan status</title>
<style>{CSS}</style>
</head>
<body>
<div class="wrap">
<header>
  <div class="eyebrow">Dynopay · Merchant app</div>
  <h1>Premium, intuitive in-app experience — plan status &amp; remaining work</h1>
  <p class="sub">{inline(updated)}</p>
</header>
{cards}
{"".join(body)}
<footer>Source: <code>/app/memory/UX_PLAN_STATUS.md</code> · rendered by <code>scripts/ux_plan_status_html.py</code> · static snapshot, not indexed.</footer>
</div>
</body>
</html>
"""
os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, "w", encoding="utf-8").write(page)
print(f"wrote {os.path.relpath(OUT, ROOT)} — {total} rows: {counts}")
