#!/usr/bin/env python3
"""
COPY_AUDIT Phase 2 — email templates voice pass (backend/locales/<lang>/emails.json).

1. Brand casing: DynoPay -> Dynopay in overpayment.merchantBody + payoutDigest.intro (all 6).
2. Puffery/speed-claim rewrites (all 6, translated):
   - common.securedBy           "trusted" -> "non-custodial" (factual proof point)
   - merchant.welcome.intro2    drop "fast" speed claim -> wallet-control fact
   - merchant.companyContactWelcome.intro2  "easily and safely" puffery -> non-custodial fact
   - merchant.companyContactWelcome.means2  "Fast and secure transactions" -> wallet-control fact
3. EN-only sentence-case subject fixes (translations already sentence case):
   paymentConfirming, paymentPartialExpired (x2), customerPaymentConfirmation,
   profileUpdated (x2), autoConversion, walletOtp ("OTP for Wallet Address Validation"
   -> "Confirm your wallet address", matching the existing "Confirm your..." family).
Idempotent — safe to re-run.
"""
import json
import os

BASE = os.path.join(os.path.dirname(__file__), "..", "locales")

REWRITES = {
    "en": {
        "common.securedBy": "This payment was processed securely through Dynopay, a non-custodial crypto payment gateway.",
        "merchant.welcome.intro2": "Dynopay makes accepting crypto payments simple and secure — funds settle straight to a wallet you control. Whether you're a freelancer, business owner, or developer, we've got you covered.",
        "merchant.companyContactWelcome.intro2": "Dynopay is a non-custodial crypto payment gateway — businesses accept cryptocurrency payments that settle straight to a wallet they control.",
        "merchant.companyContactWelcome.means2": "2. Funds settle straight to a wallet you control",
        # EN-only sentence-case subject fixes
        "paymentConfirming.subject": "Payment confirming ({{current}}/{{required}}) - Dynopay",
        "paymentPartialExpired.subjectCompleted": "Partial payment processed - Dynopay",
        "paymentPartialExpired.subjectExpired": "Partial payment expired - Dynopay",
        "customerPaymentConfirmation.subject": "Payment successful - Receipt from {{companyName}}",
        "merchant.profileUpdated.subject": "Account profile updated",
        "merchant.profileUpdated.emailChangedSubject": "Your Dynopay email address has been changed",
        "walletOtp.subject": "Confirm your wallet address",
    },
    "de": {
        "common.securedBy": "Diese Zahlung wurde sicher über Dynopay abgewickelt, einen non-custodial Krypto-Zahlungsdienstleister.",
        "merchant.welcome.intro2": "Dynopay macht das Akzeptieren von Krypto-Zahlungen einfach und sicher — Gelder landen direkt in einer Wallet, die Sie kontrollieren. Ob Freelancer, Unternehmer oder Entwickler – wir haben alles für Sie.",
        "merchant.companyContactWelcome.intro2": "Dynopay ist ein non-custodial Krypto-Zahlungsgateway — Unternehmen akzeptieren Kryptowährungszahlungen, die direkt in einer selbst kontrollierten Wallet landen.",
        "merchant.companyContactWelcome.means2": "2. Gelder landen direkt in einer Wallet, die Sie kontrollieren",
    },
    "es": {
        "common.securedBy": "Este pago se procesó de forma segura a través de Dynopay, una pasarela de pagos en cripto sin custodia.",
        "merchant.welcome.intro2": "Dynopay hace que aceptar pagos en cripto sea simple y seguro — los fondos se liquidan directamente en una wallet que tú controlas. Ya sea freelancer, empresario o desarrollador, le tenemos cubierto.",
        "merchant.companyContactWelcome.intro2": "Dynopay es una pasarela de pagos en cripto sin custodia — las empresas aceptan pagos en criptomonedas que se liquidan directamente en una wallet que ellas controlan.",
        "merchant.companyContactWelcome.means2": "2. Los fondos se liquidan directamente en una wallet que tú controlas",
    },
    "fr": {
        "common.securedBy": "Ce paiement a été traité en toute sécurité via Dynopay, une passerelle de paiement crypto non-custodial.",
        "merchant.welcome.intro2": "Dynopay rend l'acceptation des paiements en crypto simple et sécurisée — les fonds arrivent directement dans un wallet que vous contrôlez. Que vous soyez freelance, chef d'entreprise ou développeur, nous avons ce qu'il vous faut.",
        "merchant.companyContactWelcome.intro2": "Dynopay est une passerelle de paiement crypto non-custodial — les entreprises acceptent des paiements en cryptomonnaies qui arrivent directement dans un wallet qu'elles contrôlent.",
        "merchant.companyContactWelcome.means2": "2. Les fonds arrivent directement dans un wallet que vous contrôlez",
    },
    "nl": {
        "common.securedBy": "Deze betaling is veilig verwerkt via Dynopay, een non-custodial crypto-betaalgateway.",
        "merchant.welcome.intro2": "Dynopay maakt het accepteren van cryptobetalingen eenvoudig en veilig — tegoeden komen rechtstreeks terecht in een wallet die u beheert. Of u nu freelancer, ondernemer of ontwikkelaar bent, wij hebben alles voor u.",
        "merchant.companyContactWelcome.intro2": "Dynopay is een non-custodial crypto-betaalgateway — bedrijven accepteren cryptobetalingen die rechtstreeks terechtkomen in een wallet die zij beheren.",
        "merchant.companyContactWelcome.means2": "2. Tegoeden komen rechtstreeks terecht in een wallet die u beheert",
    },
    "pt": {
        "common.securedBy": "Este pagamento foi processado de forma segura através da Dynopay, um gateway de pagamentos em cripto sem custódia.",
        "merchant.welcome.intro2": "A Dynopay torna a aceitação de pagamentos em cripto simples e segura — os fundos são liquidados direto em uma carteira que você controla. Seja freelancer, empresário ou programador, temos tudo o que precisa.",
        "merchant.companyContactWelcome.intro2": "A Dynopay é um gateway de pagamentos em cripto sem custódia — as empresas aceitam pagamentos em criptomoedas liquidados direto em uma carteira que elas controlam.",
        "merchant.companyContactWelcome.means2": "2. Os fundos são liquidados direto em uma carteira que você controla",
    },
}

CASING_KEYS = ["overpayment.merchantBody", "payoutDigest.intro"]


def get_path(d, dotted):
    node = d
    for part in dotted.split("."):
        if not isinstance(node, dict) or part not in node:
            return None, None, None
        parent, key, node = node, part, node[part]
    return parent, key, node


def main():
    total = 0
    for lang in ["en", "de", "es", "fr", "nl", "pt"]:
        path = os.path.join(BASE, lang, "emails.json")
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        changed = 0
        # 1) brand casing everywhere it appears in the two known keys
        for dotted in CASING_KEYS:
            parent, key, val = get_path(data, dotted)
            if isinstance(val, str) and "DynoPay" in val:
                parent[key] = val.replace("DynoPay", "Dynopay")
                changed += 1
        # 2) voice rewrites
        for dotted, new in REWRITES.get(lang, {}).items():
            parent, key, val = get_path(data, dotted)
            if parent is None:
                print(f"  WARN {lang}: key not found: {dotted}")
                continue
            if val != new:
                parent[key] = new
                changed += 1
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print(f"{lang}/emails.json: {changed} strings updated")
        total += changed
    print(f"TOTAL: {total} strings updated")


if __name__ == "__main__":
    main()
