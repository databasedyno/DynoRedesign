#!/usr/bin/env python3
"""Company -> Brand terminology sweep for the user-facing UI locales (6 langs). Idempotent.

Only strings where "company" means the merchant's brand entity are touched; legal
text (AML/privacy), the marketing "Company" nav group, press copy and example
domains (yourcompany.com) are intentionally left alone.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "langs" / "locales"
LANGS = ["en", "de", "es", "fr", "nl", "pt"]

# file::dotted.key -> {lang: value}
CHANGES = {
    "apiScreen.json::validation.selectCompany": {
        "en": "Please select a brand", "de": "Bitte wählen Sie eine Marke aus", "es": "Por favor, selecciona una marca",
        "fr": "Veuillez sélectionner une marque", "nl": "Selecteer een merk", "pt": "Selecione uma marca"},
    "apiScreen.json::company.selectCompany": {
        "en": "Select brand", "de": "Marke auswählen", "es": "Seleccionar marca",
        "fr": "Sélectionner une marque", "nl": "Merk selecteren", "pt": "Selecionar marca"},
    "apiScreen.json::company.label": {
        "en": "Brand name", "de": "Markenname", "es": "Nombre de la marca",
        "fr": "Nom de la marque", "nl": "Merknaam", "pt": "Nome da marca"},
    "apiScreen.json::keys.liveUnlockHint": {
        "en": "Your live key activates automatically once you add (or reuse) your first wallet on this brand.",
        "de": "Ihr Live-Schlüssel wird automatisch aktiviert, sobald Sie Ihre erste Wallet für diese Marke hinzufügen (oder wiederverwenden).",
        "es": "Tu clave en vivo se activa automáticamente cuando añades (o reutilizas) tu primera billetera en esta marca.",
        "fr": "Votre clé en direct s'active automatiquement dès que vous ajoutez (ou réutilisez) votre premier portefeuille sur cette marque.",
        "nl": "Uw live-sleutel wordt automatisch geactiveerd zodra u uw eerste wallet aan dit merk toevoegt (of hergebruikt).",
        "pt": "Sua chave em produção é ativada automaticamente assim que você adiciona (ou reutiliza) a primeira carteira nesta marca."},
    "apiScreen.json::buyButtons.selectCompany": {
        "en": "Select a brand to manage its buy buttons.", "de": "Wählen Sie eine Marke aus, um deren Kauf-Buttons zu verwalten.",
        "es": "Selecciona una marca para gestionar sus botones de compra.", "fr": "Sélectionnez une marque pour gérer ses boutons d'achat.",
        "nl": "Selecteer een merk om de koopknoppen te beheren.", "pt": "Selecione uma marca para gerir os seus botões de compra."},
    "apiScreen.json::pk.selectCompany": {
        "en": "Select a brand to manage its publishable keys.", "de": "Wählen Sie eine Marke aus, um deren veröffentlichbare Schlüssel zu verwalten.",
        "es": "Selecciona una marca para gestionar sus claves publicables.", "fr": "Sélectionnez une marque pour gérer ses clés publiables.",
        "nl": "Selecteer een merk om de publiceerbare sleutels te beheren.", "pt": "Selecione uma marca para gerenciar suas chaves publicáveis."},
    "apiScreen.json::webhook.selectCompany": {
        "en": "Select a brand to configure webhooks.", "de": "Wählen Sie eine Marke aus, um Webhooks zu konfigurieren.",
        "es": "Selecciona una marca para configurar webhooks.", "fr": "Sélectionnez une marque pour configurer les webhooks.",
        "nl": "Selecteer een merk om webhooks te configureren.", "pt": "Selecione uma marca para configurar webhooks."},
    "apiScreen.json::webhook.pausedManual": {
        "en": "You paused webhook deliveries to your brand's webhook URL", "de": "Sie haben die Webhook-Zustellungen an die Webhook-URL Ihrer Marke pausiert",
        "es": "Has pausado las entregas de webhook a la URL de tu marca", "fr": "Vous avez mis en pause les livraisons de webhook vers l'URL de votre marque",
        "nl": "U heeft de webhookleveringen naar de webhook-URL van uw merk gepauzeerd", "pt": "Você pausou as entregas de webhook para a URL da sua marca"},
    "apiScreen.json::webhook.deliverPaused": {
        "en": "Paused — events are not being sent to your brand's webhook URL.", "de": "Pausiert — Ereignisse werden nicht an die Webhook-URL Ihrer Marke gesendet.",
        "es": "Pausado — los eventos no se envían a la URL de tu marca.", "fr": "Mise en pause — les événements ne sont pas envoyés à l'URL de votre marque.",
        "nl": "Gepauzeerd — evenementen worden niet naar de webhook-URL van uw merk verzonden.", "pt": "Pausado — eventos não estão a ser enviados para a URL da sua marca."},
    "apiScreen.json::webhook.deliverActive": {
        "en": "Active — events are sent to your brand's webhook URL.", "de": "Aktiv — Ereignisse werden an die Webhook-URL Ihrer Marke gesendet.",
        "es": "Activo — los eventos se envían a la URL de tu marca.", "fr": "Actif — les événements sont envoyés à l'URL de votre marque.",
        "nl": "Actief — evenementen worden naar de webhook-URL van uw merk verzonden.", "pt": "Ativo — eventos são enviados para a URL da sua marca."},
    "common.json::settingsPage.description": {
        "en": "Manage your account, brand, and integration configuration", "de": "Verwalten Sie Konto, Marke und Integrations-Konfiguration",
        "es": "Gestione su cuenta, marca y configuración de integraciones", "fr": "Gérez votre compte, votre marque et vos intégrations",
        "nl": "Beheer uw account, merk en integratie-instellingen", "pt": "Gerencie sua conta, marca e configurações de integração"},
    "common.json::taxSettings.inheritNote": {
        "en": "Showing your account-wide defaults — saving here creates tax settings specific to the selected brand.",
        "de": "Zeigt Ihre kontoweiten Standardwerte an – Änderungen hier erstellen steuerliche Einstellungen, die spezifisch für die ausgewählte Marke sind.",
        "es": "Mostrando tus valores predeterminados de cuenta — guardar aquí crea configuraciones fiscales específicas para la marca seleccionada.",
        "fr": "Affichage de vos paramètres par défaut de compte — enregistrer ici crée des paramètres fiscaux spécifiques à la marque sélectionnée.",
        "nl": "Toont uw accountbrede standaardinstellingen — opslaan hier creëert belastinginstellingen specifiek voor het geselecteerde merk.",
        "pt": "A mostrar os seus padrões de conta — salvar aqui cria definições fiscais específicas para a marca selecionada."},
    "common.json::appliesToThisCompanyOnly": {
        "en": "Applies to this brand only", "de": "Gilt nur für diese Marke", "es": "Se aplica solo a esta marca",
        "fr": "S'applique uniquement à cette marque", "nl": "Geldt alleen voor dit merk", "pt": "Aplica-se apenas a esta marca"},
    "common.json::storefront.compare.subtitle": {
        "en": "Views, tips and product sales per brand — last 30 days.", "de": "Aufrufe, Trinkgelder und Produktverkäufe pro Marke — letzte 30 Tage.",
        "es": "Vistas, propinas y ventas de productos por marca — últimos 30 días.", "fr": "Vues, pourboires et ventes de produits par marque — 30 derniers jours.",
        "nl": "Weergaven, fooien en productverkopen per merk — laatste 30 dagen.", "pt": "Visualizações, gorjetas e vendas de produtos por marca — últimos 30 dias."},
    "common.json::storefront.compare.colCompany": {"en": "Brand", "de": "Marke", "es": "Marca", "fr": "Marque", "nl": "Merk", "pt": "Marca"},
    "common.json::storefront.compare.companyN": {"en": "Brand {{n}}", "de": "Marke {{n}}", "es": "Marca {{n}}", "fr": "Marque {{n}}", "nl": "Merk {{n}}", "pt": "Marca {{n}}"},
    "common.json::setupPrompt.createCompany": {
        "en": "Create a brand", "de": "Marke anlegen", "es": "Crear una marca", "fr": "Créer une marque", "nl": "Merk aanmaken", "pt": "Criar uma marca"},
    "createPaymentLinkScreen.json::company": {"en": "Brand", "de": "Marke", "es": "Marca", "fr": "Marque", "nl": "Merk", "pt": "Marca"},
    "createPaymentLinkScreen.json::companyPaysFees": {
        "en": "Brand (we pay the fees)", "de": "Marke (wir übernehmen die Gebühren)", "es": "Marca (nosotros pagamos las comisiones)",
        "fr": "Marque (nous payons les frais)", "nl": "Merk (wij betalen de kosten)", "pt": "Marca (nós pagamos as taxas)"},
    # NOTE: de/es/fr/nl previously said "paid by the customer" here — a mistranslation (key = merchant pays).
    "createPaymentLinkScreen.json::paidByClient": {
        "en": "Paid by the brand", "de": "Von der Marke bezahlt", "es": "Pagado por la marca",
        "fr": "Payé par la marque", "nl": "Betaald door het merk", "pt": "Pago pela marca"},
    "createPaymentLinkScreen.json::setupStepCompanyLabel": {
        "en": "Create a brand", "de": "Marke erstellen", "es": "Crea una marca", "fr": "Créez une marque", "nl": "Maak een merk aan", "pt": "Crie uma marca"},
    "dashboardLayout.json::companySetupWarning": {
        "en": "Complete brand setup", "de": "Markeneinrichtung abschließen", "es": "Completar configuración de la marca",
        "fr": "Terminer la configuration de la marque", "nl": "Merkinstelling voltooien", "pt": "Concluir configuração da marca"},
    "dashboardLayout.json::companySetupWarningShort": {
        "en": "Brand setup", "de": "Marke einrichten", "es": "Configuración de la marca", "fr": "Configuration de la marque", "nl": "Merkinstelling", "pt": "Configuração da marca"},
    "dashboardLayout.json::emptyCreateCompany": {
        "en": "Create your brand", "de": "Erstellen Sie Ihre Marke", "es": "Crea tu marca", "fr": "Créez votre marque", "nl": "Maak je merk aan", "pt": "Crie a sua marca"},
    "dashboardLayout.json::obCompanyLabel": {
        "en": "Create your brand", "de": "Erstellen Sie Ihre Marke", "es": "Crea tu marca", "fr": "Créez votre marque", "nl": "Maak je merk aan", "pt": "Crie a sua marca"},
    "dashboardLayout.json::attnAddCompanyTitle": {
        "en": "Add your brand", "de": "Fügen Sie Ihre Marke hinzu", "es": "Agrega tu marca", "fr": "Ajoutez votre marque", "nl": "Voeg je merk toe", "pt": "Adicione a sua marca"},
    "dashboardLayout.json::attnAddCompanyCta": {
        "en": "Add brand", "de": "Marke hinzufügen", "es": "Agregar marca", "fr": "Ajouter la marque", "nl": "Merk toevoegen", "pt": "Adicionar marca"},
    "helpAndSupport.json::gettingStarted.step2.desc": {
        "en": "Add your brand details, such as brand name and operating country. Depending on your use case and volume, Dynopay may request additional verification later, but you can start testing payments right away.",
        "de": "Fügen Sie Ihre Markendaten hinzu, wie z. B. den Markennamen und das Betriebsland. Je nach Anwendungsfall und Volumen kann Dynopay später zusätzliche Verifizierungen anfordern, aber Sie können sofort mit dem Testen von Zahlungen beginnen.",
        "es": "Agrega los detalles de tu marca, como el nombre de la marca y el país de operación. Dependiendo de tu caso de uso y volumen, Dynopay puede solicitar verificación adicional más adelante, pero puedes comenzar a probar pagos de inmediato.",
        "fr": "Ajoutez les détails de votre marque, tels que le nom de la marque et le pays d'exploitation. En fonction de votre cas d'utilisation et de votre volume, Dynopay peut demander une vérification supplémentaire plus tard, mais vous pouvez commencer à tester les paiements immédiatement.",
        "nl": "Voeg uw merkgegevens toe, zoals merknaam en land van vestiging. Afhankelijk van uw gebruiksdoel en volume kan Dynopay later om aanvullende verificatie vragen, maar u kunt direct beginnen met het testen van betalingen.",
        "pt": "Adicione os detalhes da sua marca, como o nome da marca e o país de operação. Dependendo do seu caso de uso e volume, a Dynopay pode solicitar verificação adicional mais tarde, mas pode começar a testar pagamentos imediatamente."},
    "notifications.json::companyRoutingTitle": {
        "en": "Brand email routing", "de": "E-Mail-Weiterleitung der Marke", "es": "Enrutamiento de correos de la marca",
        "fr": "Acheminement des e-mails de la marque", "nl": "E-mailroutering van het merk", "pt": "Encaminhamento de e-mails da marca"},
    "notifications.json::companyEmailLabel": {
        "en": "Brand notification email", "de": "Benachrichtigungs-E-Mail der Marke", "es": "Correo de notificaciones de la marca",
        "fr": "E-mail de notification de la marque", "nl": "Notificatie-e-mail van het merk", "pt": "E-mail de notificações da marca"},
    "notifications.json::categoriesHelper": {
        "en": "Choose which kinds of brand emails are sent. All on by default.", "de": "Wähle, welche Marken-E-Mails gesendet werden. Standardmäßig alle aktiviert.",
        "es": "Elige qué tipos de correos de la marca se envían. Todos activados por defecto.", "fr": "Choisissez quels types d'e-mails de la marque sont envoyés. Tous activés par défaut.",
        "nl": "Kies welke soorten merk-e-mails worden verzonden. Standaard allemaal aan.", "pt": "Escolha que tipos de e-mails da marca são enviados. Todos ativos por predefinição."},
    "pageTitles.json::company_title": {
        "en": "Brand Settings · Dynopay", "de": "Markeneinstellungen · Dynopay", "es": "Configuración de marca · Dynopay",
        "fr": "Paramètres de la marque · Dynopay", "nl": "Merkinstellingen · Dynopay", "pt": "Configurações da marca · Dynopay"},
    "pageTitles.json::company_desc": {
        "en": "Manage your brand profile, payment preferences, and settlement options.", "de": "Verwalte dein Markenprofil, Zahlungspräferenzen und Abrechnungsoptionen.",
        "es": "Gestiona el perfil de tu marca, las preferencias de pago y las opciones de liquidación.", "fr": "Gérez le profil de votre marque, vos préférences de paiement et vos options de règlement.",
        "nl": "Beheer je merkprofiel, betalingsvoorkeuren en afrekenopties.", "pt": "Gerencie o perfil da sua marca, as preferências de pagamento e as opções de liquidação."},
    "walletScreen.json::walletCompanyFirstTitle": {
        "en": "Create a brand first", "de": "Erstellen Sie zuerst eine Marke", "es": "Primero crea una marca",
        "fr": "Créez d'abord une marque", "nl": "Maak eerst een merk aan", "pt": "Crie primeiro uma marca"},
    "walletScreen.json::walletCompanyFirstBody": {
        "en": "You need to create a brand profile before adding wallet addresses. Tap here to get started.",
        "de": "Sie müssen ein Markenprofil erstellen, bevor Sie Wallet-Adressen hinzufügen. Tippen Sie hier, um zu beginnen.",
        "es": "Debes crear un perfil de marca antes de añadir direcciones de monedero. Toca aquí para empezar.",
        "fr": "Vous devez créer un profil de marque avant d'ajouter des adresses de portefeuille. Appuyez ici pour commencer.",
        "nl": "Je moet een merkprofiel aanmaken voordat je walletadressen toevoegt. Tik hier om te beginnen.",
        "pt": "Precisa de criar um perfil de marca antes de adicionar endereços de carteira. Toque aqui para começar."},
    # Translations that lagged behind EN ("Brand logo")
    "companyDialog.json::fields.brandLogo.label": {"de": "Markenlogo", "nl": "Merklogo"},
}


def set_path(obj: dict, dotted: str, value: str) -> str:
    parts = dotted.split(".")
    for part in parts[:-1]:
        obj = obj[part]
    old = obj[parts[-1]]
    obj[parts[-1]] = value
    return old


def main() -> None:
    touched: dict[str, int] = {}
    for lang in LANGS:
        files: dict[str, dict] = {}
        for key, per_lang in CHANGES.items():
            if lang not in per_lang:
                continue
            fname, dotted = key.split("::")
            if fname not in files:
                files[fname] = json.loads((ROOT / lang / fname).read_text(encoding="utf-8"))
            old = set_path(files[fname], dotted, per_lang[lang])
            if old != per_lang[lang]:
                touched[lang] = touched.get(lang, 0) + 1
        for fname, data in files.items():
            path = ROOT / lang / fname
            text = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
            path.write_text(text, encoding="utf-8")
    print("changed strings per language:", touched)


if __name__ == "__main__":
    main()
