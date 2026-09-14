#!/usr/bin/env python3
"""Inject the brand-deletion / API-key-revoked email strings into all 6 emails.json (idempotent)."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "locales"

BRAND_LABEL = {"en": "Brand", "de": "Marke", "es": "Marca", "fr": "Marque", "nl": "Merk", "pt": "Marca"}

NEW = {
    "en": {
        "companyDeleteOtp": {
            "subject": "Confirm brand deletion – {{companyName}}",
            "heading": "Confirm Brand Deletion",
            "intro": "You're about to <strong>permanently delete</strong> the brand <strong>{{companyName}}</strong>. Its payment links, API keys and settings will be removed. Enter the code below to confirm:",
            "expiry": "This code expires in <strong>10 minutes</strong>. If you didn't request this, ignore this email and secure your account immediately.",
            "preheader": "Your one-time code to confirm deleting {{companyName}}."
        },
        "companyDeleted": {
            "subject": "Brand deleted – {{companyName}}",
            "heading": "Brand Deleted",
            "intro": "The brand <strong>{{companyName}}</strong> has been permanently deleted from your Dynopay account.",
            "removedTitle": "What was removed",
            "removed1": "All payment links belonging to this brand",
            "removed2": "API keys ({{apiKeys}}) — revoked immediately",
            "removed3": "Brand settings, webhooks and auto-conversion preferences",
            "note": "Your transaction history is kept for your records. Payout wallets that were assigned to this brand are no longer linked to it.",
            "didntDoThis": "<strong>Didn't do this?</strong><br />If you didn't delete this brand, please secure your account immediately and contact support.",
            "cta": "Go to dashboard",
            "preheader": "{{companyName}} was removed from your account."
        },
        "apiKeyRevoked": {
            "subject": "API key revoked – {{keyType}} environment",
            "heading": "API Key Revoked",
            "intro": "A <strong>{{keyType}}</strong> API key was deleted from <strong>{{companyName}}</strong>. Any integration still using it will stop working immediately.",
            "nextTitle": "What to do next",
            "next1": "Update any integration that used this key to a current key",
            "next2": "If you still need API access, create a new key from the Developers page",
            "didntDoThis": "<strong>Didn't do this?</strong><br />If you didn't revoke this API key, please secure your account immediately and contact support.",
            "cta": "View API keys",
            "preheader": "A key on {{companyName}} no longer works."
        }
    },
    "de": {
        "companyDeleteOtp": {
            "subject": "Markenlöschung bestätigen – {{companyName}}",
            "heading": "Markenlöschung bestätigen",
            "intro": "Sie sind dabei, die Marke <strong>{{companyName}}</strong> <strong>dauerhaft zu löschen</strong>. Zahlungslinks, API-Schlüssel und Einstellungen werden entfernt. Geben Sie zur Bestätigung den folgenden Code ein:",
            "expiry": "Dieser Code läuft in <strong>10 Minuten</strong> ab. Falls Sie dies nicht angefordert haben, ignorieren Sie diese E-Mail und sichern Sie Ihr Konto umgehend.",
            "preheader": "Ihr Einmalcode zur Bestätigung der Löschung von {{companyName}}."
        },
        "companyDeleted": {
            "subject": "Marke gelöscht – {{companyName}}",
            "heading": "Marke gelöscht",
            "intro": "Die Marke <strong>{{companyName}}</strong> wurde dauerhaft aus Ihrem Dynopay-Konto gelöscht.",
            "removedTitle": "Was entfernt wurde",
            "removed1": "Alle Zahlungslinks dieser Marke",
            "removed2": "API-Schlüssel ({{apiKeys}}) – sofort widerrufen",
            "removed3": "Markeneinstellungen, Webhooks und Auto-Umwandlungs-Einstellungen",
            "note": "Ihr Transaktionsverlauf bleibt für Ihre Unterlagen erhalten. Auszahlungs-Wallets, die dieser Marke zugeordnet waren, sind nicht mehr mit ihr verknüpft.",
            "didntDoThis": "<strong>Waren Sie das nicht?</strong><br />Falls Sie diese Marke nicht gelöscht haben, sichern Sie bitte umgehend Ihr Konto und kontaktieren Sie den Support.",
            "cta": "Zum Dashboard",
            "preheader": "{{companyName}} wurde aus Ihrem Konto entfernt."
        },
        "apiKeyRevoked": {
            "subject": "API-Schlüssel widerrufen – {{keyType}}-Umgebung",
            "heading": "API-Schlüssel widerrufen",
            "intro": "Ein <strong>{{keyType}}</strong>-API-Schlüssel wurde von <strong>{{companyName}}</strong> gelöscht. Integrationen, die ihn noch verwenden, funktionieren ab sofort nicht mehr.",
            "nextTitle": "Nächste Schritte",
            "next1": "Aktualisieren Sie alle Integrationen, die diesen Schlüssel verwendet haben, auf einen aktuellen Schlüssel",
            "next2": "Wenn Sie weiterhin API-Zugriff benötigen, erstellen Sie auf der Entwicklerseite einen neuen Schlüssel",
            "didntDoThis": "<strong>Waren Sie das nicht?</strong><br />Falls Sie diesen API-Schlüssel nicht widerrufen haben, sichern Sie bitte umgehend Ihr Konto und kontaktieren Sie den Support.",
            "cta": "API-Schlüssel anzeigen",
            "preheader": "Ein Schlüssel von {{companyName}} funktioniert nicht mehr."
        }
    },
    "es": {
        "companyDeleteOtp": {
            "subject": "Confirme la eliminación de la marca – {{companyName}}",
            "heading": "Confirmar eliminación de la marca",
            "intro": "Está a punto de <strong>eliminar permanentemente</strong> la marca <strong>{{companyName}}</strong>. Se eliminarán sus enlaces de pago, claves API y ajustes. Introduzca el código siguiente para confirmar:",
            "expiry": "Este código caduca en <strong>10 minutos</strong>. Si no solicitó esto, ignore este correo y proteja su cuenta de inmediato.",
            "preheader": "Su código de un solo uso para confirmar la eliminación de {{companyName}}."
        },
        "companyDeleted": {
            "subject": "Marca eliminada – {{companyName}}",
            "heading": "Marca eliminada",
            "intro": "La marca <strong>{{companyName}}</strong> se ha eliminado permanentemente de su cuenta de Dynopay.",
            "removedTitle": "Qué se eliminó",
            "removed1": "Todos los enlaces de pago de esta marca",
            "removed2": "Claves API ({{apiKeys}}): revocadas de inmediato",
            "removed3": "Ajustes de la marca, webhooks y preferencias de conversión automática",
            "note": "Su historial de transacciones se conserva para sus registros. Las billeteras de pago asignadas a esta marca ya no están vinculadas a ella.",
            "didntDoThis": "<strong>¿No fue usted?</strong><br />Si no eliminó esta marca, proteja su cuenta de inmediato y contacte con soporte.",
            "cta": "Ir al panel",
            "preheader": "{{companyName}} se eliminó de su cuenta."
        },
        "apiKeyRevoked": {
            "subject": "Clave API revocada – entorno de {{keyType}}",
            "heading": "Clave API revocada",
            "intro": "Se eliminó una clave API de <strong>{{keyType}}</strong> de <strong>{{companyName}}</strong>. Cualquier integración que aún la use dejará de funcionar de inmediato.",
            "nextTitle": "Qué hacer ahora",
            "next1": "Actualice las integraciones que usaban esta clave con una clave vigente",
            "next2": "Si aún necesita acceso a la API, cree una nueva clave desde la página de desarrolladores",
            "didntDoThis": "<strong>¿No fue usted?</strong><br />Si no revocó esta clave API, proteja su cuenta de inmediato y contacte con soporte.",
            "cta": "Ver claves API",
            "preheader": "Una clave de {{companyName}} ya no funciona."
        }
    },
    "fr": {
        "companyDeleteOtp": {
            "subject": "Confirmez la suppression de la marque – {{companyName}}",
            "heading": "Confirmer la suppression de la marque",
            "intro": "Vous êtes sur le point de <strong>supprimer définitivement</strong> la marque <strong>{{companyName}}</strong>. Ses liens de paiement, clés API et paramètres seront supprimés. Saisissez le code ci-dessous pour confirmer :",
            "expiry": "Ce code expire dans <strong>10 minutes</strong>. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail et sécurisez immédiatement votre compte.",
            "preheader": "Votre code à usage unique pour confirmer la suppression de {{companyName}}."
        },
        "companyDeleted": {
            "subject": "Marque supprimée – {{companyName}}",
            "heading": "Marque supprimée",
            "intro": "La marque <strong>{{companyName}}</strong> a été définitivement supprimée de votre compte Dynopay.",
            "removedTitle": "Ce qui a été supprimé",
            "removed1": "Tous les liens de paiement de cette marque",
            "removed2": "Clés API ({{apiKeys}}) — révoquées immédiatement",
            "removed3": "Paramètres de la marque, webhooks et préférences de conversion automatique",
            "note": "Votre historique de transactions est conservé pour vos archives. Les portefeuilles de paiement associés à cette marque n'y sont plus liés.",
            "didntDoThis": "<strong>Ce n'était pas vous ?</strong><br />Si vous n'avez pas supprimé cette marque, sécurisez immédiatement votre compte et contactez le support.",
            "cta": "Accéder au tableau de bord",
            "preheader": "{{companyName}} a été supprimée de votre compte."
        },
        "apiKeyRevoked": {
            "subject": "Clé API révoquée – environnement {{keyType}}",
            "heading": "Clé API révoquée",
            "intro": "Une clé API <strong>{{keyType}}</strong> a été supprimée de <strong>{{companyName}}</strong>. Toute intégration qui l'utilise encore cessera de fonctionner immédiatement.",
            "nextTitle": "Prochaines étapes",
            "next1": "Mettez à jour les intégrations qui utilisaient cette clé avec une clé active",
            "next2": "Si vous avez encore besoin d'un accès API, créez une nouvelle clé depuis la page Développeurs",
            "didntDoThis": "<strong>Ce n'était pas vous ?</strong><br />Si vous n'avez pas révoqué cette clé API, sécurisez immédiatement votre compte et contactez le support.",
            "cta": "Voir les clés API",
            "preheader": "Une clé de {{companyName}} ne fonctionne plus."
        }
    },
    "nl": {
        "companyDeleteOtp": {
            "subject": "Bevestig merkverwijdering – {{companyName}}",
            "heading": "Merkverwijdering bevestigen",
            "intro": "U staat op het punt het merk <strong>{{companyName}}</strong> <strong>definitief te verwijderen</strong>. De betaallinks, API-sleutels en instellingen worden verwijderd. Voer de onderstaande code in om te bevestigen:",
            "expiry": "Deze code verloopt over <strong>10 minuten</strong>. Als u dit niet hebt aangevraagd, negeer dan deze e-mail en beveilig uw account onmiddellijk.",
            "preheader": "Uw eenmalige code om het verwijderen van {{companyName}} te bevestigen."
        },
        "companyDeleted": {
            "subject": "Merk verwijderd – {{companyName}}",
            "heading": "Merk verwijderd",
            "intro": "Het merk <strong>{{companyName}}</strong> is definitief uit uw Dynopay-account verwijderd.",
            "removedTitle": "Wat er is verwijderd",
            "removed1": "Alle betaallinks van dit merk",
            "removed2": "API-sleutels ({{apiKeys}}) – direct ingetrokken",
            "removed3": "Merkinstellingen, webhooks en voorkeuren voor automatische omzetting",
            "note": "Uw transactiegeschiedenis blijft bewaard voor uw administratie. Uitbetaalwallets die aan dit merk waren toegewezen, zijn er niet langer aan gekoppeld.",
            "didntDoThis": "<strong>Was u dit niet?</strong><br />Als u dit merk niet hebt verwijderd, beveilig dan onmiddellijk uw account en neem contact op met support.",
            "cta": "Naar het dashboard",
            "preheader": "{{companyName}} is uit uw account verwijderd."
        },
        "apiKeyRevoked": {
            "subject": "API-sleutel ingetrokken – {{keyType}}-omgeving",
            "heading": "API-sleutel ingetrokken",
            "intro": "Een <strong>{{keyType}}</strong>-API-sleutel is verwijderd van <strong>{{companyName}}</strong>. Integraties die deze sleutel nog gebruiken, werken per direct niet meer.",
            "nextTitle": "Wat nu te doen",
            "next1": "Werk integraties die deze sleutel gebruikten bij naar een actieve sleutel",
            "next2": "Hebt u nog API-toegang nodig? Maak dan een nieuwe sleutel aan op de pagina Ontwikkelaars",
            "didntDoThis": "<strong>Was u dit niet?</strong><br />Als u deze API-sleutel niet hebt ingetrokken, beveilig dan onmiddellijk uw account en neem contact op met support.",
            "cta": "API-sleutels bekijken",
            "preheader": "Een sleutel van {{companyName}} werkt niet meer."
        }
    },
    "pt": {
        "companyDeleteOtp": {
            "subject": "Confirme a eliminação da marca – {{companyName}}",
            "heading": "Confirmar eliminação da marca",
            "intro": "Está prestes a <strong>eliminar permanentemente</strong> a marca <strong>{{companyName}}</strong>. Os seus links de pagamento, chaves API e definições serão removidos. Introduza o código abaixo para confirmar:",
            "expiry": "Este código expira em <strong>10 minutos</strong>. Se não fez este pedido, ignore este e-mail e proteja a sua conta de imediato.",
            "preheader": "O seu código único para confirmar a eliminação de {{companyName}}."
        },
        "companyDeleted": {
            "subject": "Marca eliminada – {{companyName}}",
            "heading": "Marca eliminada",
            "intro": "A marca <strong>{{companyName}}</strong> foi eliminada permanentemente da sua conta Dynopay.",
            "removedTitle": "O que foi removido",
            "removed1": "Todos os links de pagamento desta marca",
            "removed2": "Chaves API ({{apiKeys}}) — revogadas imediatamente",
            "removed3": "Definições da marca, webhooks e preferências de conversão automática",
            "note": "O seu histórico de transações é mantido para os seus registos. As carteiras de pagamento atribuídas a esta marca deixaram de estar associadas a ela.",
            "didntDoThis": "<strong>Não foi você?</strong><br />Se não eliminou esta marca, proteja a sua conta de imediato e contacte o suporte.",
            "cta": "Ir para o painel",
            "preheader": "{{companyName}} foi removida da sua conta."
        },
        "apiKeyRevoked": {
            "subject": "Chave API revogada – ambiente de {{keyType}}",
            "heading": "Chave API revogada",
            "intro": "Uma chave API de <strong>{{keyType}}</strong> foi eliminada de <strong>{{companyName}}</strong>. Qualquer integração que ainda a utilize deixará de funcionar imediatamente.",
            "nextTitle": "O que fazer a seguir",
            "next1": "Atualize as integrações que usavam esta chave para uma chave ativa",
            "next2": "Se ainda precisar de acesso à API, crie uma nova chave na página de programadores",
            "didntDoThis": "<strong>Não foi você?</strong><br />Se não revogou esta chave API, proteja a sua conta de imediato e contacte o suporte.",
            "cta": "Ver chaves API",
            "preheader": "Uma chave de {{companyName}} deixou de funcionar."
        }
    },
}


def main() -> None:
    for lang, blocks in NEW.items():
        path = ROOT / lang / "emails.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        merchant = data["merchant"]
        rebuilt = {}
        for key, value in merchant.items():
            rebuilt[key] = value
            if key == "walletDeleteOtp":
                for new_key, new_val in blocks.items():
                    rebuilt[new_key] = new_val
        for new_key, new_val in blocks.items():
            if new_key not in rebuilt:
                rebuilt[new_key] = new_val
        # Bug #1 from the audit: "wallet removed" borrowed walletAdded.cta.
        if "cta" not in rebuilt["walletDeleted"]:
            rebuilt["walletDeleted"]["cta"] = merchant["walletAdded"]["cta"]
        rebuilt["labels"].setdefault("brand", BRAND_LABEL[lang])
        data["merchant"] = rebuilt
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"{lang}: ok ({len(blocks)} blocks, walletDeleted.cta={rebuilt['walletDeleted']['cta']!r})")


if __name__ == "__main__":
    main()
