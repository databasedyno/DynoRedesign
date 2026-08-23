import json, sys

LOCALES = ["en", "pt", "fr", "es", "de", "nl"]
DASH_KEYS = ["periodVsPrevious", "volumeOver", "taxCollectedAllTime", "taxAcross_one",
             "taxAcross_other", "qaShortcutPayLinks", "rangeDays7", "rangeDays30",
             "rangeDays90", "rangeMonths12", "taxCollected"]
problems = []
for l in LOCALES:
    d = json.load(open(f"/app/langs/locales/{l}/dashboardLayout.json"))
    for k in DASH_KEYS:
        v = d.get(k)
        if not v:
            problems.append(f"{l}/dashboardLayout.{k} MISSING")
    # placeholder style checks
    if d.get("periodVsPrevious") and "{count}" not in d["periodVsPrevious"]:
        problems.append(f"{l}/periodVsPrevious missing single-brace {{count}}: {d.get('periodVsPrevious')}")
    if d.get("periodVsPrevious") and "{{count}}" in d["periodVsPrevious"]:
        problems.append(f"{l}/periodVsPrevious uses double-brace (breaks .replace): {d['periodVsPrevious']}")
    if d.get("volumeOver") and ("{range}" not in d["volumeOver"] or "{{range}}" in d["volumeOver"]):
        problems.append(f"{l}/volumeOver placeholder issue: {d['volumeOver']}")
    for k in ["taxAcross_one", "taxAcross_other"]:
        if d.get(k) and "{{count}}" not in d[k]:
            problems.append(f"{l}/{k} should use i18next {{{{count}}}}: {d[k]}")
    qacats = [k for k in d if k.startswith("qaCat")]
    if not qacats:
        problems.append(f"{l}/dashboardLayout missing qaCat* keys")

    c = json.load(open(f"/app/langs/locales/{l}/common.json"))
    if not c.get("appliesToThisCompanyOnly"):
        problems.append(f"{l}/common.appliesToThisCompanyOnly MISSING")
    sp = c.get("settingsPage") or {}
    for k in ["scopeAccount", "scopeCompany", "selectedCompanyFallback"]:
        if not sp.get(k):
            problems.append(f"{l}/common.settingsPage.{k} MISSING")
    if sp.get("scopeCompany") and "{{company}}" not in sp["scopeCompany"]:
        problems.append(f"{l}/scopeCompany missing {{{{company}}}}: {sp['scopeCompany']}")

    tr = json.load(open(f"/app/langs/locales/{l}/transactions.json"))
    if not tr.get("sourcePaymentLinks"):
        problems.append(f"{l}/transactions.sourcePaymentLinks MISSING")

print("\n".join(problems) if problems else "ALL LOCALE KEYS PRESENT AND WELL-FORMED")
sys.exit(1 if problems else 0)
