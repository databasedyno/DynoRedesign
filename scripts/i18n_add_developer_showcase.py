#!/usr/bin/env python3
"""
Add developer-audience keys to all 6 landing.json locales.
- doors.developer.{kicker,title,desc,cta}
- doors.subtitle (updated to mention developers)
- developerShowcase.* (11 keys)

Idempotent: only sets keys if they're missing OR match the previous English default
(we never overwrite a real translation the user might have polished).
"""
import json
import os
from pathlib import Path

LOCALES_DIR = Path("/app/langs/locales")

# ─── New keys per locale ────────────────────────────────────────────────────

# doors.subtitle old English (session 45): "Pick your door — merchants, campaigns, creators. They all share the same crypto rails."
# The new one adds a 4th audience.
DOORS_SUBTITLE_OLD_TRANSLATIONS = {
    "en": "Pick your door — merchants, campaigns, creators. They all share the same crypto rails.",
    "es": "Elige tu puerta: comercios, campañas, creadores. Todos comparten los mismos rieles cripto.",
    "fr": "Choisissez votre porte — commerçants, campagnes, créateurs. Tous partagent les mêmes rails crypto.",
    "de": "Wähle deine Tür — Händler, Kampagnen, Creator. Alle nutzen dieselben Krypto-Schienen.",
    "nl": "Kies je deur — merchants, campagnes, creators. Ze delen allemaal dezelfde crypto-rails.",
    "pt": "Escolha sua porta — comerciantes, campanhas, criadores. Todos compartilham os mesmos trilhos cripto.",
}

LOCALE_STRINGS = {
    "en": {
        "doors.subtitle": "Pick your door — merchants, campaigns, creators, developers. They all share the same crypto rails.",
        "doors.developer.kicker": "Developers",
        "doors.developer.title": "Ship in an afternoon",
        "doors.developer.desc": "REST, webhooks, embeds and drop-in checkout — one API for 15+ chains. Sandbox key is public.",
        "doors.developer.cta": "See the API",
        "developerShowcase.eyebrow": "For developers",
        "developerShowcase.title": "Integrate in ~10 minutes.",
        "developerShowcase.titleTail": "15+ chains. One API. No smart contracts.",
        "developerShowcase.subtitle": "Ship a crypto checkout in an afternoon. REST + webhooks, idempotent everywhere, signed with HMAC-SHA256, and a sandbox key you can copy right now — the same primitives you already know from Stripe, but for on-chain money.",
        "developerShowcase.feature1": "REST + webhooks · idempotency keys · signed with HMAC-SHA256",
        "developerShowcase.feature2": "TypeScript / Node SDK · Python examples · OpenAPI spec",
        "developerShowcase.feature3": "Sandbox key is public — no signup to play, no CC to test",
        "developerShowcase.feature4": "Drop-in checkout, Elements widgets, Buy Buttons — pick your surface",
        "developerShowcase.cta": "Read the docs",
        "developerShowcase.ctaSecondary": "Try it live",
        "developerShowcase.mockCaption": "// PUBLIC SANDBOX · TRY WITHOUT AN ACCOUNT",
        "developerShowcase.copied": "cURL copied",
    },
    "es": {
        "doors.subtitle": "Elige tu puerta: comercios, campañas, creadores y desarrolladores. Todos comparten los mismos rieles cripto.",
        "doors.developer.kicker": "Desarrolladores",
        "doors.developer.title": "Integra en una tarde",
        "doors.developer.desc": "REST, webhooks, embeds y checkout listo para usar — una API para 15+ cadenas. La clave sandbox es pública.",
        "doors.developer.cta": "Ver la API",
        "developerShowcase.eyebrow": "Para desarrolladores",
        "developerShowcase.title": "Integra en ~10 minutos.",
        "developerShowcase.titleTail": "15+ cadenas. Una API. Sin smart contracts.",
        "developerShowcase.subtitle": "Lanza un checkout en cripto en una tarde. REST + webhooks, idempotente en todo, firmado con HMAC-SHA256, y una clave sandbox que puedes copiar ahora mismo — las primitivas que ya conoces de Stripe, pero para dinero on-chain.",
        "developerShowcase.feature1": "REST + webhooks · claves de idempotencia · firmado con HMAC-SHA256",
        "developerShowcase.feature2": "SDK TypeScript / Node · ejemplos en Python · especificación OpenAPI",
        "developerShowcase.feature3": "Clave sandbox pública — sin registro para probar, sin tarjeta",
        "developerShowcase.feature4": "Checkout embebido, widgets Elements, botones de compra — elige tu superficie",
        "developerShowcase.cta": "Leer los docs",
        "developerShowcase.ctaSecondary": "Prueba en vivo",
        "developerShowcase.mockCaption": "// SANDBOX PÚBLICO · PRUEBA SIN CUENTA",
        "developerShowcase.copied": "cURL copiado",
    },
    "fr": {
        "doors.subtitle": "Choisissez votre porte — commerçants, campagnes, créateurs, développeurs. Tous partagent les mêmes rails crypto.",
        "doors.developer.kicker": "Développeurs",
        "doors.developer.title": "Intégrez en un après-midi",
        "doors.developer.desc": "REST, webhooks, intégrations et checkout clé en main — une API pour 15+ chaînes. La clé sandbox est publique.",
        "doors.developer.cta": "Voir l’API",
        "developerShowcase.eyebrow": "Pour les développeurs",
        "developerShowcase.title": "Intégrez en ~10 minutes.",
        "developerShowcase.titleTail": "15+ chaînes. Une API. Pas de smart contracts.",
        "developerShowcase.subtitle": "Lancez un checkout crypto en un après-midi. REST + webhooks, idempotence partout, signature HMAC-SHA256, et une clé sandbox à copier maintenant — les mêmes primitives que Stripe, pour l’argent on-chain.",
        "developerShowcase.feature1": "REST + webhooks · clés d’idempotence · signés en HMAC-SHA256",
        "developerShowcase.feature2": "SDK TypeScript / Node · exemples Python · spécification OpenAPI",
        "developerShowcase.feature3": "Clé sandbox publique — pas d’inscription pour tester, pas de CB",
        "developerShowcase.feature4": "Checkout intégré, widgets Elements, boutons d’achat — à vous de choisir",
        "developerShowcase.cta": "Lire la doc",
        "developerShowcase.ctaSecondary": "Essayez en direct",
        "developerShowcase.mockCaption": "// SANDBOX PUBLIC · ESSAYEZ SANS COMPTE",
        "developerShowcase.copied": "cURL copié",
    },
    "de": {
        "doors.subtitle": "Wähle deine Tür — Händler, Kampagnen, Creator, Entwickler. Alle nutzen dieselben Krypto-Schienen.",
        "doors.developer.kicker": "Entwickler",
        "doors.developer.title": "In einem Nachmittag live",
        "doors.developer.desc": "REST, Webhooks, Embeds und fertiges Checkout — eine API für 15+ Chains. Sandbox-Key ist öffentlich.",
        "doors.developer.cta": "Zur API",
        "developerShowcase.eyebrow": "Für Entwickler",
        "developerShowcase.title": "Integriert in ~10 Minuten.",
        "developerShowcase.titleTail": "15+ Chains. Eine API. Keine Smart Contracts.",
        "developerShowcase.subtitle": "Bring ein Crypto-Checkout an einem Nachmittag live. REST + Webhooks, überall idempotent, HMAC-SHA256-signiert, und einen Sandbox-Key, den du sofort kopieren kannst — dieselben Primitiven wie Stripe, nur für On-Chain-Geld.",
        "developerShowcase.feature1": "REST + Webhooks · Idempotency-Keys · HMAC-SHA256-signiert",
        "developerShowcase.feature2": "TypeScript- / Node-SDK · Python-Beispiele · OpenAPI-Spec",
        "developerShowcase.feature3": "Sandbox-Key ist öffentlich — kein Konto, keine Kreditkarte",
        "developerShowcase.feature4": "Embedded Checkout, Elements-Widgets, Buy Buttons — such dir aus",
        "developerShowcase.cta": "Zur Doku",
        "developerShowcase.ctaSecondary": "Live testen",
        "developerShowcase.mockCaption": "// ÖFFENTLICHE SANDBOX · OHNE KONTO TESTEN",
        "developerShowcase.copied": "cURL kopiert",
    },
    "nl": {
        "doors.subtitle": "Kies je deur — merchants, campagnes, creators, developers. Ze delen allemaal dezelfde crypto-rails.",
        "doors.developer.kicker": "Developers",
        "doors.developer.title": "Klaar in één middag",
        "doors.developer.desc": "REST, webhooks, embeds en kant-en-klare checkout — één API voor 15+ chains. Sandbox-sleutel is publiek.",
        "doors.developer.cta": "Bekijk de API",
        "developerShowcase.eyebrow": "Voor developers",
        "developerShowcase.title": "Integreer in ~10 minuten.",
        "developerShowcase.titleTail": "15+ chains. Eén API. Geen smart contracts.",
        "developerShowcase.subtitle": "Lever een crypto-checkout in één middag op. REST + webhooks, overal idempotent, ondertekend met HMAC-SHA256, en een sandbox-sleutel die je nu kunt kopiëren — dezelfde primitieven als Stripe, maar dan voor on-chain geld.",
        "developerShowcase.feature1": "REST + webhooks · idempotency-keys · HMAC-SHA256-ondertekend",
        "developerShowcase.feature2": "TypeScript- / Node-SDK · Python-voorbeelden · OpenAPI-spec",
        "developerShowcase.feature3": "Sandbox-sleutel is publiek — geen account, geen creditcard",
        "developerShowcase.feature4": "Embedded checkout, Elements-widgets, Buy Buttons — kies zelf",
        "developerShowcase.cta": "Lees de docs",
        "developerShowcase.ctaSecondary": "Probeer live",
        "developerShowcase.mockCaption": "// PUBLIEKE SANDBOX · PROBEER ZONDER ACCOUNT",
        "developerShowcase.copied": "cURL gekopieerd",
    },
    "pt": {
        "doors.subtitle": "Escolha sua porta — comerciantes, campanhas, criadores, desenvolvedores. Todos compartilham os mesmos trilhos cripto.",
        "doors.developer.kicker": "Desenvolvedores",
        "doors.developer.title": "No ar em uma tarde",
        "doors.developer.desc": "REST, webhooks, embeds e checkout pronto — uma API para 15+ redes. Chave sandbox é pública.",
        "doors.developer.cta": "Ver a API",
        "developerShowcase.eyebrow": "Para desenvolvedores",
        "developerShowcase.title": "Integre em ~10 minutos.",
        "developerShowcase.titleTail": "15+ redes. Uma API. Sem smart contracts.",
        "developerShowcase.subtitle": "Coloque um checkout cripto no ar em uma tarde. REST + webhooks, idempotente em tudo, assinado com HMAC-SHA256, e uma chave sandbox que você pode copiar agora — as mesmas primitivas que já conhece do Stripe, para dinheiro on-chain.",
        "developerShowcase.feature1": "REST + webhooks · chaves de idempotência · assinado com HMAC-SHA256",
        "developerShowcase.feature2": "SDK TypeScript / Node · exemplos em Python · spec OpenAPI",
        "developerShowcase.feature3": "Chave sandbox pública — sem cadastro para testar, sem cartão",
        "developerShowcase.feature4": "Checkout embutido, widgets Elements, Buy Buttons — escolha sua superfície",
        "developerShowcase.cta": "Ler a documentação",
        "developerShowcase.ctaSecondary": "Testar ao vivo",
        "developerShowcase.mockCaption": "// SANDBOX PÚBLICO · TESTE SEM CONTA",
        "developerShowcase.copied": "cURL copiado",
    },
}


def set_by_dotted(d, dotted, value, allow_overwrite_if_equals=None):
    """Set d[a][b][c] = value for dotted 'a.b.c'.
    Skip if the key already exists and is different from allow_overwrite_if_equals.
    """
    parts = dotted.split(".")
    cur = d
    for p in parts[:-1]:
        if p not in cur or not isinstance(cur[p], dict):
            cur[p] = {}
        cur = cur[p]
    leaf = parts[-1]
    if leaf not in cur:
        cur[leaf] = value
        return "added"
    if allow_overwrite_if_equals is not None and cur[leaf] == allow_overwrite_if_equals:
        cur[leaf] = value
        return "updated (matched old default)"
    if cur[leaf] == value:
        return "skipped (already correct)"
    return f"skipped (existing custom value kept: {cur[leaf]!r})"


for locale, strings in LOCALE_STRINGS.items():
    path = LOCALES_DIR / locale / "landing.json"
    if not path.exists():
        print(f"[{locale}] MISSING landing.json, skipping")
        continue
    data = json.loads(path.read_text(encoding="utf-8"))
    print(f"\n[{locale}] {path}")
    for dotted, val in strings.items():
        old_default = None
        if dotted == "doors.subtitle":
            old_default = DOORS_SUBTITLE_OLD_TRANSLATIONS.get(locale)
        result = set_by_dotted(data, dotted, val, allow_overwrite_if_equals=old_default)
        print(f"  {dotted:<40s} → {result}")
    path.write_text(
        json.dumps(data, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"[{locale}] ✅ written")

print("\nDone.")
