#!/usr/bin/env python3
"""Register sweep — make every German and Dutch email consistently FORMAL
(DE: Sie/Ihnen/Ihr·e, NL: u/uw). The greeting stays "Hallo {{name}}," (already
formal-compatible). Only the strings that still used the informal register
(du/dich/dir/dein·e, je/jij/jou/jouw) are rewritten; everything else is untouched.

Idempotent — safe to re-run. Ends with a lint that fails if any informal marker
remains in de/nl. Run from backend/:  python3 scripts/apply_register_sweep.py
"""
import json, pathlib, re, sys

BASE = pathlib.Path(__file__).resolve().parent.parent

DE = {
    "contributor.crowdfundingUpdate.outro": "Danke, dass Sie diese Kampagne unterstützen. Sie erhalten diese E-Mail, weil Sie bereits beigetragen haben.",
    "contributionReceived.subject": "Sie haben einen Beitrag erhalten – {{amount}} {{currency}}",
    "contributionReceived.outro": "Die vollständige Spenderliste finden Sie im Dashboard Ihrer Kampagne.",
    "contributionThankYou.subject": "Danke für Ihren Beitrag zu {{campaignName}}",
    "contributionThankYou.heading": "Danke, dass Sie {{campaignName}} unterstützen",
    "contributionThankYou.intro": "Ihr Beitrag zu <strong>{{campaignName}}</strong> ist gerade eingetroffen — danke für Ihre Unterstützung.",
    "contributionThankYou.outro": "Der Organisator kann Ihnen Kampagnen-Updates schicken, damit Sie sehen, wohin Ihre Unterstützung fließt.",
    "activation.gate.outro": "Es dauert nur eine Minute, und Sie machen genau dort weiter, wo Sie aufgehört haben.",
    "activation.gate.brand.intro": "Sie wollten einen Zahlungslink erstellen, aber Ihr Konto hat noch keine Marke. Ihr Markenname erscheint im Checkout, auf Rechnungen und Belegen — das Anlegen dauert etwa 30 Sekunden.",
    "activation.gate.wallet.intro": "Sie wollten einen Zahlungslink erstellen, aber in Ihrem Konto ist noch keine Auszahlungs-Wallet hinterlegt. Zahlungen gehen direkt in eine Wallet, die Sie kontrollieren — deshalb brauchen wir eine Adresse, bevor Sie bezahlt werden können.",
    "activation.gate.kyc.intro": "Sie haben bereits über 10.000 $ an Zahlungen abgewickelt — stark. Deshalb ist jetzt eine kurze Identitätsprüfung nötig, bevor Sie neue Zahlungslinks erstellen können. Das dauert meist etwa 5 Minuten.",
    "orderReceipt.subject": "Ihre Bestellung {{ref}} ist bestätigt",
    "orderReceipt.thanks": "Danke für Ihren Einkauf! Ihre Zahlung ist eingegangen und Ihre Bestellung ist bestätigt.",
    "orderReceipt.digitalNote": "Die obigen Download-Links sind 24 Stunden gültig. Brauchen Sie einen neuen Link?",
    "orderReceipt.openOrderPage": "Bestellseite öffnen",
    "orderReceipt.physicalNote": "Der Händler sendet Ihnen per E-Mail eine Sendungsnummer, sobald Ihre Artikel versandt werden.",
    "orderTable.accessPurchase": "Auf Ihren Kauf zugreifen →",
    "orderTable.bookSession": "Session buchen →",
}

NL = {
    "paymentReceived.preheader": "Het geld wordt nu naar uw uitbetalingswallet overgemaakt.",
    "paymentPending.preheader": "We mailen u zodra de betaling on-chain is bevestigd.",
    "paymentConfirming.preheader": "Uw betaling krijgt netwerkbevestigingen.",
    "transactionConfirmed.preheader": "De laatste status van uw transactie.",
    "paymentPartialExpired.preheaderCompleted": "We hebben het deelbedrag dat u betaalde verwerkt.",
    "customerPaymentConfirmation.subject": "Uw betaling aan {{companyName}} is bevestigd",
    "customerPaymentConfirmation.preheader": "Uw betaalbewijs vindt u hieronder in de bijlage.",
    "merchant.welcome.promo": "Uw eerste betaling is van ons — we schelden onze volledige platformkosten kwijt op uw eerste afgewikkelde betaling, ongeacht het bedrag.",
    "merchant.welcome.preheader": "Uw eerste afgehandelde betaling is gratis — zo wordt u betaald.",
    "merchant.emailVerifyOtp.preheader": "Voer deze code in om uw e-mailadres te verifiëren.",
    "merchant.loginOtp.preheader": "Uw code verloopt over enkele minuten. Deel hem nooit.",
    "merchant.passwordChanged.preheader": "Het wachtwoord van uw account is zojuist gewijzigd.",
    "merchant.profileUpdated.preheader": "Er is een wijziging aangebracht in uw accountprofiel.",
    "merchant.profileUpdated.emailChangedPreheader": "Het e-mailadres van uw account is gewijzigd.",
    "merchant.securityAlert.preheader": "We zagen ongebruikelijke activiteit op uw account.",
    "merchant.loginNotification.preheader": "Er is een nieuwe aanmelding gedetecteerd. Was u dat?",
    "merchant.failedLogins.preheader": "Meerdere aanmeldpogingen op uw account zijn mislukt.",
    "merchant.companyCreated.preheader": "Nog één stap voordat u betalingen kunt accepteren.",
    "merchant.companyContactWelcome.preheader": "Uw bedrijf is geregistreerd — welkom aan boord.",
    "merchant.companyUpdated.preheader": "De gegevens van uw bedrijfsprofiel zijn bijgewerkt.",
    "merchant.paymentLinkCreated.preheader": "Uw betaallink is klaar om te delen.",
    "merchant.crowdfundingCreated.preheader": "Uw campagne is live en klaar voor bijdragen.",
    "merchant.kycRequired.preheader": "Verifieer uw identiteit om betalingen boven {{threshold}} te blijven accepteren.",
    "merchant.kycApproved.preheader": "U bent geverifieerd — geen limieten op het accepteren van betalingen.",
    "merchant.kycRejected.preheader": "We konden uw identiteit niet verifiëren — dit kunt u doen.",
    "merchant.kycStarted.preheader": "Rond uw snelle identiteitscontrole af om limieten op te heffen.",
    "merchant.kycResubmission.preheader": "We hebben nog één ding nodig om uw verificatie af te ronden.",
    "merchant.weeklySummary.preheader": "Uw betalingen, uitbetalingen en kosten van deze week.",
    "merchant.invoice.preheader": "Uw nieuwste Dynopay-factuur staat klaar.",
    "merchant.apiKey.preheader": "Er is een nieuwe API-sleutel op uw account aangemaakt.",
    "merchant.subscriptionCreated.custOutro": "Bij elke factuurcyclus sturen we u een beveiligde link om in crypto te betalen. U kunt altijd opzeggen.",
    "merchant.subscriptionCreated.custPreheader": "Uw abonnement is nu actief.",
    "merchant.subscriptionCreated.merchPreheader": "U heeft een nieuwe abonnee.",
    "merchant.subscriptionCancelled.custPreheader": "Uw abonnement is opgezegd.",
    "merchant.subscriptionPaymentFailed.custSteps": "Zo houdt u uw abonnement actief:<br />1. Open de beveiligde betaallink hieronder<br />2. Zorg dat uw wallet genoeg saldo heeft, inclusief netwerkkosten<br />3. Neem contact op met de verkoper als u hulp nodig heeft",
    "merchant.subscriptionPaymentFailed.custPreheader": "Uw abonnementsbetaling is mislukt.",
    "merchant.autoConversion.preheader": "Uw crypto is omgezet en uitbetaald.",
    "merchant.weeklyConversion.preheader": "Een overzicht van uw conversies van afgelopen week.",
    "merchant.volumeTierUpgrade.preheader": "Uw platformtarief is zojuist verlaagd naar {{newPercent}}%.",
    "contributor.crowdfundingUpdate.outro": "Bedankt voor uw steun aan deze campagne. U ontvangt deze e-mail omdat u eerder heeft bijgedragen.",
    "contributionReceived.subject": "U heeft zojuist een bijdrage ontvangen – {{amount}} {{currency}}",
    "contributionReceived.outro": "De volledige donateurslijst vindt u in het dashboard van uw campagne.",
    "contributionReceived.preheader": "Er is zojuist een nieuwe bijdrage voor uw campagne binnengekomen.",
    "contributionThankYou.subject": "Bedankt voor uw bijdrage aan {{campaignName}}",
    "contributionThankYou.heading": "Bedankt dat u {{campaignName}} steunt",
    "contributionThankYou.intro": "Uw bijdrage aan <strong>{{campaignName}}</strong> is zojuist binnengekomen — bedankt voor uw steun.",
    "contributionThankYou.outro": "De organisator kan u campagne-updates sturen zodat u ziet waar uw steun naartoe gaat.",
    "contributionThankYou.preheader": "Bedankt — uw bijdragebewijs zit in de bijlage.",
    "walletOtp.intro": "U valideert een nieuw walletadres voor {{currency}}.",
    "overpayment.merchantBody": "Het volledige verwachte bedrag is aan u bijgeschreven. Het overschot van {{excess}} (≈ {{excessFiat}}) is volgens het beleid voor te veel betalen van uw account doorgestuurd naar Dynopay, dus u hoeft niets te doen.",
    "payoutDigest.headingActive": "Uw wekelijkse uitbetalingsoverzicht",
    "payoutDigest.intro": "Zo zagen de afgelopen 7 dagen eruit voor uw bedrijf op Dynopay.",
    "payoutDigest.firstActiveWeek": "Dit is uw eerste actieve week — welkom bij het wekelijkse overzicht. {{delta}}",
    "payoutDigest.openDashboardBody": "Open uw dashboard om transacties te bekijken, wallets aan te passen of een nieuwe betaallink te delen.",
    "payoutDigest.preheaderActive": "Een overzicht van uw uitbetalingen van afgelopen week.",
    "payoutDigest.preheaderQuiet": "Een korte update over uw account deze week.",
    "activation.step.d1.subject": "Alles klaar — zo ontvangt u uw eerste betaling",
    "activation.step.d1.heading": "Laten we uw eerste betaling binnenhalen",
    "activation.step.d1.intro": "Uw Dynopay-account is klaar. Uw eerste cryptobetaling ontvangen duurt ongeveer 2 minuten — dit is de volgende stap.",
    "activation.step.d3.subject": "We helpen u nog steeds om betaald te worden",
    "activation.step.d3.heading": "Eén stap van uw eerste betaling",
    "activation.step.d3.intro": "Kleine herinnering: nog een paar stappen en u accepteert crypto. Laten we de volgende doen.",
    "activation.step.d7.subject": "Uw Dynopay-account is klaar wanneer u dat bent",
    "activation.step.d7.heading": "Ga verder waar u gebleven was",
    "activation.step.d7.intro": "U heeft Dynopay een week geleden ingesteld. Wanneer u maar wilt: dit is de snelste weg naar uw eerste betaling.",
    "activation.seg.madeLink.line": "U heeft al een betaallink gemaakt — mooi. Voeg een uitbetalingswallet toe zodat we, zodra iemand betaalt, direct uitbetalen naar een wallet die u beheert.",
    "activation.seg.noLink.line": "Maak uw eerste betaallink — deel hem overal en accepteer Bitcoin, Ethereum of stablecoins, zonder terugboekingen.",
    "activation.seg.noLink.cta": "Maak uw eerste link",
    "activation.seg.fundraiser.line": "Lanceer uw inzamelingspagina in enkele minuten — deel één link en ontvang cryptodonaties van over de hele wereld.",
    "activation.common.unsubscribe": "Wilt u deze installatietips niet?",
    "activation.gate.subject": "Rond uw installatie af om betaald te worden",
    "activation.gate.heading": "U bent één stap verwijderd van uw eerste betaling",
    "activation.gate.outro": "Het duurt maar een minuut en u gaat precies verder waar u was gebleven.",
    "activation.gate.brand.intro": "U probeerde een betaallink te maken, maar uw account heeft nog geen merk. Uw merknaam staat op uw checkout, facturen en bonnen — toevoegen duurt ongeveer 30 seconden.",
    "activation.gate.wallet.intro": "U probeerde een betaallink te maken, maar er is nog geen uitbetaalwallet aan uw account gekoppeld. Betalingen worden rechtstreeks afgewikkeld naar een wallet die u beheert, dus we hebben een adres nodig voordat u betaald kunt worden.",
    "activation.gate.kyc.intro": "U heeft al meer dan $10.000 aan betalingen verwerkt — goed bezig. Daarom is nu een korte identiteitscontrole vereist voordat u nieuwe betaallinks kunt maken. Dit duurt meestal ongeveer 5 minuten.",
    "orderReceipt.subject": "Uw bestelling {{ref}} is bevestigd",
    "orderReceipt.thanks": "Bedankt voor uw aankoop! We hebben uw betaling ontvangen en uw bestelling is bevestigd.",
    "orderReceipt.digitalNote": "De downloadlinks hierboven zijn 24 uur geldig. Heeft u een nieuwe link nodig?",
    "orderReceipt.openOrderPage": "Open uw bestelpagina",
    "orderReceipt.physicalNote": "De verkoper mailt u een trackingnummer zodra uw artikelen worden verzonden.",
    "orderTable.accessPurchase": "Toegang tot uw aankoop →",
    "orderTable.bookSession": "Boek uw sessie →",
}

# Lint patterns — word-boundary, case-insensitive. (Deliberately broad on DE verbs.)
DE_INFORMAL = re.compile(
    r"\b(du|dich|dir|dein|deine|deinen|deinem|deiner|deines|euch|euer|eure|hast|kannst|bist|willst|möchtest|brauchst|"
    r"musst|solltest|wirst|hattest|wurdest|hättest|könntest|würdest|erhältst|bekommst|siehst|findest|gibst|nimmst|"
    r"klickst|meldest|zahlst|verwendest|bestätigst|nutzt|prüfst|überprüfst|lässt|machst|wolltest)\b", re.I)
NL_INFORMAL = re.compile(r"\b(je|jij|jou|jouw|jullie|jezelf)\b", re.I)


def flat(o, p=""):
    out = {}
    for k, v in o.items():
        kp = f"{p}.{k}" if p else k
        out.update(flat(v, kp)) if isinstance(v, dict) else out.__setitem__(kp, v)
    return out


def setk(d, dotted, v):
    parts = dotted.split(".")
    cur = d
    for p in parts[:-1]:
        cur = cur[p]
    if parts[-1] not in cur:
        raise KeyError(dotted)
    cur[parts[-1]] = v


def apply(lang, mapping, lint):
    p = BASE / "locales" / lang / "emails.json"
    d = json.loads(p.read_text())
    changed = 0
    for k, v in mapping.items():
        cur = flat(d).get(k)
        if cur != v:
            setk(d, k, v)
            changed += 1
    p.write_text(json.dumps(d, indent=2, ensure_ascii=False) + "\n")
    left = {k: v for k, v in flat(d).items() if lint.search(v)}
    print(f"   {lang}: rewrote {changed} strings; informal markers remaining: {len(left)}")
    for k, v in left.items():
        print(f"      ! {k} => {v[:100]}")
    return len(left)


def main():
    bad = apply("de", DE, DE_INFORMAL) + apply("nl", NL, NL_INFORMAL)
    print("OK — DE + NL emails are consistently formal" if bad == 0 else f"FAIL — {bad} informal strings remain")
    return 0 if bad == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
