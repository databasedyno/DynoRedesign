#!/usr/bin/env python3
"""Add the login/register brand-panel trust strings (AuthBrandPanel.tsx) to every auth.json locale. Idempotent."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2] / "langs" / "locales"
KEYS = ["brandTrustCustodyTitle", "brandTrustCustodyDesc", "brandTrustChainsTitle", "brandTrustChainsDesc",
        "brandTrustSettlementTitle", "brandTrustSettlementDesc", "brandTrustComplianceTitle", "brandTrustComplianceDesc",
        "brandFooterStatus", "brandFooterCompliance", "brandFooterFee", "brandSubheadline"]
T = {
    "en": ["Non-custodial", "Payments settle straight to a wallet you control — we never hold your funds.",
           "9 chains · 15 assets", "BTC, ETH, SOL, USDT, USDC, XRP, BNB, TRX & Polygon.",
           "Instant settlement", "On-chain, with no holding periods. Fees from 0.5%.",
           "Security & compliance", "KYC/AML above threshold, encrypted & hardened key infrastructure.",
           "Public status page", "KYC/AML compliant", "Fees from 0.5%",
           "Funds settle on-chain, straight to a wallet you control — across 9 blockchains and 15 assets. No custody. No lock-ups."],
    "de": ["Nicht verwahrend", "Zahlungen gehen direkt an eine Wallet, die Sie kontrollieren — wir verwahren Ihre Gelder nie.",
           "9 Chains · 15 Assets", "BTC, ETH, SOL, USDT, USDC, XRP, BNB, TRX & Polygon.",
           "Sofortige Abrechnung", "On-Chain, ohne Haltefristen. Gebühren ab 0,5 %.",
           "Sicherheit & Compliance", "KYC/AML ab Schwellenwert, verschlüsselte & gehärtete Schlüssel-Infrastruktur.",
           "Öffentliche Statusseite", "KYC/AML-konform", "Gebühren ab 0,5 %",
           "Gelder werden on-chain abgerechnet, direkt in eine Wallet, die Sie kontrollieren — über 9 Blockchains und 15 Assets. Keine Verwahrung. Keine Sperrfristen."],
    "fr": ["Non-custodial", "Les paiements arrivent directement dans un wallet que vous contrôlez — nous ne détenons jamais vos fonds.",
           "9 blockchains · 15 actifs", "BTC, ETH, SOL, USDT, USDC, XRP, BNB, TRX et Polygon.",
           "Règlement instantané", "On-chain, sans période de blocage. Frais dès 0,5 %.",
           "Sécurité et conformité", "KYC/AML au-delà d'un seuil, infrastructure de clés chiffrée et renforcée.",
           "Page de statut publique", "Conforme KYC/AML", "Frais dès 0,5 %",
           "Les fonds sont réglés on-chain, directement dans un wallet que vous contrôlez — sur 9 blockchains et 15 actifs. Aucune garde. Aucun blocage."],
    "es": ["No custodial", "Los pagos se liquidan directamente en una billetera que tú controlas — nunca retenemos tus fondos.",
           "9 blockchains · 15 activos", "BTC, ETH, SOL, USDT, USDC, XRP, BNB, TRX y Polygon.",
           "Liquidación instantánea", "On-chain, sin periodos de retención. Comisiones desde el 0,5 %.",
           "Seguridad y cumplimiento", "KYC/AML por encima del umbral, infraestructura de claves cifrada y reforzada.",
           "Página de estado pública", "Cumple con KYC/AML", "Comisiones desde el 0,5 %",
           "Los fondos se liquidan on-chain, directamente en una billetera que tú controlas — en 9 blockchains y 15 activos. Sin custodia. Sin bloqueos."],
    "nl": ["Niet-bewaarplichtig", "Betalingen gaan rechtstreeks naar een wallet die jij beheert — wij houden je geld nooit vast.",
           "9 chains · 15 assets", "BTC, ETH, SOL, USDT, USDC, XRP, BNB, TRX & Polygon.",
           "Directe afwikkeling", "On-chain, zonder wachttijden. Kosten vanaf 0,5%.",
           "Beveiliging & compliance", "KYC/AML boven de drempel, versleutelde en geharde sleutelinfrastructuur.",
           "Openbare statuspagina", "KYC/AML-conform", "Kosten vanaf 0,5%",
           "Geld wordt on-chain afgewikkeld, rechtstreeks naar een wallet die jij beheert — op 9 blockchains en 15 assets. Geen bewaring. Geen blokkering."],
    "pt": ["Não custodial", "Os pagamentos são liquidados diretamente numa carteira que controla — nunca guardamos os seus fundos.",
           "9 blockchains · 15 ativos", "BTC, ETH, SOL, USDT, USDC, XRP, BNB, TRX e Polygon.",
           "Liquidação instantânea", "On-chain, sem períodos de retenção. Taxas a partir de 0,5%.",
           "Segurança e conformidade", "KYC/AML acima do limite, infraestrutura de chaves encriptada e reforçada.",
           "Página de estado pública", "Em conformidade com KYC/AML", "Taxas a partir de 0,5%",
           "Os fundos são liquidados on-chain, diretamente numa carteira que controla — em 9 blockchains e 15 ativos. Sem custódia. Sem bloqueios."],
}

for lang, values in T.items():
    path = ROOT / lang / "auth.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    added = 0
    for k, v in zip(KEYS, values):
        if k not in data:
            data[k] = v
            added += 1
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{lang}: +{added}")
