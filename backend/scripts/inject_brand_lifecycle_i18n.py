#!/usr/bin/env python3
"""Inject brand soft-delete lifecycle + new-device sign-in email strings into all 6 emails.json (idempotent)."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "locales"

NEW = {
    "en": {
        "brandSoftDeleted": {
            "subject": "Your brand \"{{companyName}}\" was deleted — you have 7 days to restore it",
            "heading": "Your brand was deleted",
            "intro": "Your brand <strong>{{companyName}}</strong> was just deleted on Dynopay. Don't worry — nothing is gone yet. We're keeping everything (payment links, wallets, settings and history) safe for the next <strong>7 days</strong> in case this was a mistake.",
            "status": "Scheduled for deletion",
            "restoreBefore": "Restore before",
            "changedMind": "<strong>Changed your mind?</strong> Just reply to this email or contact our support team before <strong>{{date}}</strong> and we'll bring the brand back exactly as it was — with one click.",
            "afterDate": "After {{date}} the brand and all of its data are permanently deleted and can no longer be recovered.",
            "didntDoThis": "If you didn't delete this brand, please contact us straight away so we can secure your account.",
            "cta": "Contact support",
            "preheader": "{{companyName}} was deleted — you have until {{date}} to restore it."
        },
        "brandPermanentlyDeleted": {
            "subject": "Your brand \"{{companyName}}\" has been permanently deleted",
            "heading": "Brand permanently deleted",
            "intro": "The 7-day recovery window for your brand <strong>{{companyName}}</strong> has now passed, so it and all of its data have been <strong>permanently deleted</strong> from Dynopay. This can't be undone.",
            "status": "Permanently deleted",
            "createNew": "If you'd like to accept payments again, you can create a fresh brand anytime from your dashboard.",
            "didntExpect": "If you didn't expect this, please reply to this email and we'll help.",
            "cta": "Go to dashboard",
            "preheader": "{{companyName}} has been permanently deleted from Dynopay."
        },
        "brandRestored": {
            "subject": "Good news — your brand \"{{companyName}}\" is back",
            "heading": "Your brand is back",
            "intro": "We've restored your brand <strong>{{companyName}}</strong> on Dynopay. Everything — your payment links, wallets, settings and history — is exactly as you left it.",
            "status": "Restored",
            "pickUp": "You can pick up right where you left off from your dashboard.",
            "cta": "Go to dashboard",
            "preheader": "{{companyName}} has been restored — everything is exactly as you left it."
        },
        "brandDeleteReminder": {
            "subject": "Only {{daysLabel}} left to restore \"{{companyName}}\"",
            "heading": "Your brand is about to be deleted",
            "intro": "Just a heads-up: your deleted brand <strong>{{companyName}}</strong> is scheduled to be <strong>permanently deleted on {{date}}</strong> — that's about <strong>{{daysLabel}}</strong> away. After that, its payment links, wallets, settings and history can't be recovered.",
            "timeLeft": "Time left",
            "timeLeftBadge": "{{daysLabel}} left",
            "deletesOn": "Deletes on",
            "wantItBack": "If you'd like it back, just reply to this email or contact support before <strong>{{date}}</strong> and we'll restore it with one click. If you meant to delete it, no action is needed.",
            "dayOne": "1 day",
            "dayOther": "{{count}} days",
            "cta": "Contact support",
            "preheader": "{{daysLabel}} left to restore {{companyName}} before it's permanently deleted."
        },
        "newDeviceAlert": {
            "subject": "New device signed in to your Dynopay account",
            "heading": "New device signed in",
            "intro": "Your Dynopay account was just accessed from a device we haven't seen before. If this was you, no action is needed.",
            "when": "When",
            "unknownDevice": "Unknown device",
            "unknownLocation": "Unknown location",
            "warn": "Don't recognize this? Tap the button below to sign out of every device right away, then change your password.",
            "cta": "This wasn't me — sign out everywhere",
            "preheader": "A new device just signed in to your Dynopay account."
        }
    },
    "de": {
        "brandSoftDeleted": {
            "subject": "Ihre Marke „{{companyName}}“ wurde gelöscht – Sie haben 7 Tage, um sie wiederherzustellen",
            "heading": "Ihre Marke wurde gelöscht",
            "intro": "Ihre Marke <strong>{{companyName}}</strong> wurde gerade auf Dynopay gelöscht. Keine Sorge – noch ist nichts verloren. Wir bewahren alles (Zahlungslinks, Wallets, Einstellungen und Verlauf) für die nächsten <strong>7 Tage</strong> sicher auf, falls dies ein Versehen war.",
            "status": "Zur Löschung vorgemerkt",
            "restoreBefore": "Wiederherstellen bis",
            "changedMind": "<strong>Meinung geändert?</strong> Antworten Sie einfach auf diese E-Mail oder kontaktieren Sie unser Support-Team vor dem <strong>{{date}}</strong> – wir stellen die Marke mit einem Klick genau so wieder her, wie sie war.",
            "afterDate": "Nach dem {{date}} werden die Marke und alle ihre Daten dauerhaft gelöscht und können nicht mehr wiederhergestellt werden.",
            "didntDoThis": "Falls Sie diese Marke nicht gelöscht haben, kontaktieren Sie uns bitte sofort, damit wir Ihr Konto absichern können.",
            "cta": "Support kontaktieren",
            "preheader": "{{companyName}} wurde gelöscht – Sie haben bis zum {{date}} Zeit, sie wiederherzustellen."
        },
        "brandPermanentlyDeleted": {
            "subject": "Ihre Marke „{{companyName}}“ wurde dauerhaft gelöscht",
            "heading": "Marke dauerhaft gelöscht",
            "intro": "Die 7-tägige Wiederherstellungsfrist für Ihre Marke <strong>{{companyName}}</strong> ist abgelaufen. Die Marke und alle ihre Daten wurden daher <strong>dauerhaft von Dynopay gelöscht</strong>. Dies kann nicht rückgängig gemacht werden.",
            "status": "Dauerhaft gelöscht",
            "createNew": "Wenn Sie wieder Zahlungen annehmen möchten, können Sie jederzeit über Ihr Dashboard eine neue Marke erstellen.",
            "didntExpect": "Falls Sie dies nicht erwartet haben, antworten Sie bitte auf diese E-Mail – wir helfen Ihnen weiter.",
            "cta": "Zum Dashboard",
            "preheader": "{{companyName}} wurde dauerhaft von Dynopay gelöscht."
        },
        "brandRestored": {
            "subject": "Gute Nachrichten – Ihre Marke „{{companyName}}“ ist zurück",
            "heading": "Ihre Marke ist zurück",
            "intro": "Wir haben Ihre Marke <strong>{{companyName}}</strong> auf Dynopay wiederhergestellt. Alles – Zahlungslinks, Wallets, Einstellungen und Verlauf – ist genau so, wie Sie es hinterlassen haben.",
            "status": "Wiederhergestellt",
            "pickUp": "Über Ihr Dashboard können Sie genau dort weitermachen, wo Sie aufgehört haben.",
            "cta": "Zum Dashboard",
            "preheader": "{{companyName}} wurde wiederhergestellt – alles ist genau so, wie Sie es hinterlassen haben."
        },
        "brandDeleteReminder": {
            "subject": "Nur noch {{daysLabel}}, um „{{companyName}}“ wiederherzustellen",
            "heading": "Ihre Marke wird bald gelöscht",
            "intro": "Kurzer Hinweis: Ihre gelöschte Marke <strong>{{companyName}}</strong> wird am <strong>{{date}} dauerhaft gelöscht</strong> – das ist in etwa <strong>{{daysLabel}}</strong>. Danach können ihre Zahlungslinks, Wallets, Einstellungen und ihr Verlauf nicht mehr wiederhergestellt werden.",
            "timeLeft": "Verbleibende Zeit",
            "timeLeftBadge": "Noch {{daysLabel}}",
            "deletesOn": "Wird gelöscht am",
            "wantItBack": "Wenn Sie die Marke zurückhaben möchten, antworten Sie einfach auf diese E-Mail oder kontaktieren Sie den Support vor dem <strong>{{date}}</strong> – wir stellen sie mit einem Klick wieder her. Wenn die Löschung beabsichtigt war, müssen Sie nichts weiter tun.",
            "dayOne": "1 Tag",
            "dayOther": "{{count}} Tage",
            "cta": "Support kontaktieren",
            "preheader": "Noch {{daysLabel}}, um {{companyName}} wiederherzustellen, bevor die Marke dauerhaft gelöscht wird."
        },
        "newDeviceAlert": {
            "subject": "Neues Gerät bei Ihrem Dynopay-Konto angemeldet",
            "heading": "Neues Gerät angemeldet",
            "intro": "Auf Ihr Dynopay-Konto wurde gerade von einem Gerät zugegriffen, das wir bisher nicht kannten. Wenn das Sie waren, müssen Sie nichts weiter tun.",
            "when": "Wann",
            "unknownDevice": "Unbekanntes Gerät",
            "unknownLocation": "Unbekannter Standort",
            "warn": "Kommt Ihnen das nicht bekannt vor? Tippen Sie auf die Schaltfläche unten, um sich sofort von allen Geräten abzumelden, und ändern Sie anschließend Ihr Passwort.",
            "cta": "Das war ich nicht – überall abmelden",
            "preheader": "Ein neues Gerät hat sich gerade bei Ihrem Dynopay-Konto angemeldet."
        }
    },
    "es": {
        "brandSoftDeleted": {
            "subject": "Su marca «{{companyName}}» se ha eliminado: tiene 7 días para restaurarla",
            "heading": "Su marca se ha eliminado",
            "intro": "Su marca <strong>{{companyName}}</strong> acaba de eliminarse en Dynopay. No se preocupe: todavía no se ha perdido nada. Conservaremos todo (enlaces de pago, wallets, configuración e historial) a buen recaudo durante los próximos <strong>7 días</strong> por si ha sido un error.",
            "status": "Programada para eliminación",
            "restoreBefore": "Restaurar antes del",
            "changedMind": "<strong>¿Ha cambiado de opinión?</strong> Responda a este correo o contacte con nuestro equipo de soporte antes del <strong>{{date}}</strong> y recuperaremos la marca exactamente como estaba, con un solo clic.",
            "afterDate": "Después del {{date}}, la marca y todos sus datos se eliminarán de forma permanente y ya no podrán recuperarse.",
            "didntDoThis": "Si no ha eliminado esta marca, contacte con nosotros de inmediato para que podamos proteger su cuenta.",
            "cta": "Contactar con soporte",
            "preheader": "{{companyName}} se ha eliminado: tiene hasta el {{date}} para restaurarla."
        },
        "brandPermanentlyDeleted": {
            "subject": "Su marca «{{companyName}}» se ha eliminado permanentemente",
            "heading": "Marca eliminada permanentemente",
            "intro": "El plazo de recuperación de 7 días de su marca <strong>{{companyName}}</strong> ha terminado, por lo que la marca y todos sus datos se han <strong>eliminado permanentemente</strong> de Dynopay. Esta acción no se puede deshacer.",
            "status": "Eliminada permanentemente",
            "createNew": "Si desea volver a aceptar pagos, puede crear una nueva marca en cualquier momento desde su panel.",
            "didntExpect": "Si no esperaba esto, responda a este correo y le ayudaremos.",
            "cta": "Ir al panel",
            "preheader": "{{companyName}} se ha eliminado permanentemente de Dynopay."
        },
        "brandRestored": {
            "subject": "Buenas noticias: su marca «{{companyName}}» está de vuelta",
            "heading": "Su marca está de vuelta",
            "intro": "Hemos restaurado su marca <strong>{{companyName}}</strong> en Dynopay. Todo (enlaces de pago, wallets, configuración e historial) está exactamente como lo dejó.",
            "status": "Restaurada",
            "pickUp": "Puede continuar justo donde lo dejó desde su panel.",
            "cta": "Ir al panel",
            "preheader": "{{companyName}} se ha restaurado: todo está exactamente como lo dejó."
        },
        "brandDeleteReminder": {
            "subject": "Último aviso: {{daysLabel}} para restaurar «{{companyName}}»",
            "heading": "Su marca está a punto de eliminarse",
            "intro": "Un aviso rápido: su marca eliminada <strong>{{companyName}}</strong> está programada para <strong>eliminarse permanentemente el {{date}}</strong>, es decir, en aproximadamente <strong>{{daysLabel}}</strong>. Después de esa fecha, sus enlaces de pago, wallets, configuración e historial no podrán recuperarse.",
            "timeLeft": "Tiempo restante",
            "timeLeftBadge": "Restante: {{daysLabel}}",
            "deletesOn": "Se elimina el",
            "wantItBack": "Si desea recuperarla, responda a este correo o contacte con soporte antes del <strong>{{date}}</strong> y la restauraremos con un solo clic. Si tenía intención de eliminarla, no necesita hacer nada.",
            "dayOne": "1 día",
            "dayOther": "{{count}} días",
            "cta": "Contactar con soporte",
            "preheader": "{{daysLabel}} para restaurar {{companyName}} antes de que se elimine permanentemente."
        },
        "newDeviceAlert": {
            "subject": "Un nuevo dispositivo ha iniciado sesión en su cuenta de Dynopay",
            "heading": "Nuevo dispositivo conectado",
            "intro": "Se acaba de acceder a su cuenta de Dynopay desde un dispositivo que no habíamos visto antes. Si ha sido usted, no necesita hacer nada.",
            "when": "Cuándo",
            "unknownDevice": "Dispositivo desconocido",
            "unknownLocation": "Ubicación desconocida",
            "warn": "¿No lo reconoce? Pulse el botón de abajo para cerrar sesión en todos los dispositivos de inmediato y, a continuación, cambie su contraseña.",
            "cta": "No fui yo: cerrar sesión en todos los dispositivos",
            "preheader": "Un nuevo dispositivo acaba de iniciar sesión en su cuenta de Dynopay."
        }
    },
    "fr": {
        "brandSoftDeleted": {
            "subject": "Votre marque « {{companyName}} » a été supprimée — vous avez 7 jours pour la restaurer",
            "heading": "Votre marque a été supprimée",
            "intro": "Votre marque <strong>{{companyName}}</strong> vient d'être supprimée sur Dynopay. Pas d'inquiétude : rien n'est encore perdu. Nous conservons tout (liens de paiement, wallets, paramètres et historique) en sécurité pendant les <strong>7 prochains jours</strong>, au cas où il s'agirait d'une erreur.",
            "status": "Suppression programmée",
            "restoreBefore": "Restaurer avant le",
            "changedMind": "<strong>Vous avez changé d'avis ?</strong> Répondez simplement à cet e-mail ou contactez notre équipe d'assistance avant le <strong>{{date}}</strong> et nous rétablirons la marque exactement comme elle était, en un clic.",
            "afterDate": "Après le {{date}}, la marque et toutes ses données seront définitivement supprimées et ne pourront plus être récupérées.",
            "didntDoThis": "Si vous n'avez pas supprimé cette marque, contactez-nous immédiatement afin que nous puissions sécuriser votre compte.",
            "cta": "Contacter l'assistance",
            "preheader": "{{companyName}} a été supprimée — vous avez jusqu'au {{date}} pour la restaurer."
        },
        "brandPermanentlyDeleted": {
            "subject": "Votre marque « {{companyName}} » a été définitivement supprimée",
            "heading": "Marque définitivement supprimée",
            "intro": "Le délai de récupération de 7 jours de votre marque <strong>{{companyName}}</strong> est écoulé : la marque et toutes ses données ont donc été <strong>définitivement supprimées</strong> de Dynopay. Cette action est irréversible.",
            "status": "Définitivement supprimée",
            "createNew": "Si vous souhaitez accepter de nouveau des paiements, vous pouvez créer une nouvelle marque à tout moment depuis votre tableau de bord.",
            "didntExpect": "Si vous ne vous attendiez pas à cela, répondez à cet e-mail et nous vous aiderons.",
            "cta": "Accéder au tableau de bord",
            "preheader": "{{companyName}} a été définitivement supprimée de Dynopay."
        },
        "brandRestored": {
            "subject": "Bonne nouvelle — votre marque « {{companyName}} » est de retour",
            "heading": "Votre marque est de retour",
            "intro": "Nous avons restauré votre marque <strong>{{companyName}}</strong> sur Dynopay. Tout — vos liens de paiement, wallets, paramètres et historique — est exactement comme vous l'aviez laissé.",
            "status": "Restaurée",
            "pickUp": "Vous pouvez reprendre là où vous vous étiez arrêté depuis votre tableau de bord.",
            "cta": "Accéder au tableau de bord",
            "preheader": "{{companyName}} a été restaurée — tout est exactement comme vous l'aviez laissé."
        },
        "brandDeleteReminder": {
            "subject": "Plus que {{daysLabel}} pour restaurer « {{companyName}} »",
            "heading": "Votre marque est sur le point d'être supprimée",
            "intro": "Petit rappel : votre marque supprimée <strong>{{companyName}}</strong> sera <strong>définitivement supprimée le {{date}}</strong>, soit dans environ <strong>{{daysLabel}}</strong>. Passé ce délai, ses liens de paiement, wallets, paramètres et historique ne pourront plus être récupérés.",
            "timeLeft": "Temps restant",
            "timeLeftBadge": "Plus que {{daysLabel}}",
            "deletesOn": "Suppression le",
            "wantItBack": "Si vous souhaitez la récupérer, répondez simplement à cet e-mail ou contactez l'assistance avant le <strong>{{date}}</strong> et nous la restaurerons en un clic. Si la suppression était volontaire, aucune action n'est nécessaire.",
            "dayOne": "1 jour",
            "dayOther": "{{count}} jours",
            "cta": "Contacter l'assistance",
            "preheader": "Plus que {{daysLabel}} pour restaurer {{companyName}} avant sa suppression définitive."
        },
        "newDeviceAlert": {
            "subject": "Un nouvel appareil s'est connecté à votre compte Dynopay",
            "heading": "Nouvel appareil connecté",
            "intro": "Votre compte Dynopay vient d'être utilisé depuis un appareil que nous n'avions jamais vu. Si c'était vous, aucune action n'est nécessaire.",
            "when": "Quand",
            "unknownDevice": "Appareil inconnu",
            "unknownLocation": "Emplacement inconnu",
            "warn": "Vous ne reconnaissez pas cette connexion ? Appuyez sur le bouton ci-dessous pour vous déconnecter immédiatement de tous les appareils, puis changez votre mot de passe.",
            "cta": "Ce n'était pas moi — me déconnecter partout",
            "preheader": "Un nouvel appareil vient de se connecter à votre compte Dynopay."
        }
    },
    "pt": {
        "brandSoftDeleted": {
            "subject": "A sua marca \"{{companyName}}\" foi eliminada — tem 7 dias para a restaurar",
            "heading": "A sua marca foi eliminada",
            "intro": "A sua marca <strong>{{companyName}}</strong> acabou de ser eliminada no Dynopay. Não se preocupe — ainda nada se perdeu. Vamos guardar tudo (links de pagamento, wallets, definições e histórico) em segurança durante os próximos <strong>7 dias</strong>, caso tenha sido um engano.",
            "status": "Eliminação agendada",
            "restoreBefore": "Restaurar antes de",
            "changedMind": "<strong>Mudou de ideias?</strong> Basta responder a este e-mail ou contactar a nossa equipa de suporte antes de <strong>{{date}}</strong> e repomos a marca exatamente como estava — com um clique.",
            "afterDate": "Depois de {{date}}, a marca e todos os seus dados são eliminados permanentemente e deixam de poder ser recuperados.",
            "didntDoThis": "Se não eliminou esta marca, contacte-nos de imediato para que possamos proteger a sua conta.",
            "cta": "Contactar o suporte",
            "preheader": "{{companyName}} foi eliminada — tem até {{date}} para a restaurar."
        },
        "brandPermanentlyDeleted": {
            "subject": "A sua marca \"{{companyName}}\" foi eliminada permanentemente",
            "heading": "Marca eliminada permanentemente",
            "intro": "O período de recuperação de 7 dias da sua marca <strong>{{companyName}}</strong> terminou, pelo que a marca e todos os seus dados foram <strong>eliminados permanentemente</strong> do Dynopay. Esta ação não pode ser anulada.",
            "status": "Eliminada permanentemente",
            "createNew": "Se quiser voltar a aceitar pagamentos, pode criar uma nova marca a qualquer momento a partir do seu painel.",
            "didntExpect": "Se não esperava isto, responda a este e-mail e nós ajudamos.",
            "cta": "Ir para o painel",
            "preheader": "{{companyName}} foi eliminada permanentemente do Dynopay."
        },
        "brandRestored": {
            "subject": "Boas notícias — a sua marca \"{{companyName}}\" está de volta",
            "heading": "A sua marca está de volta",
            "intro": "Restaurámos a sua marca <strong>{{companyName}}</strong> no Dynopay. Tudo — links de pagamento, wallets, definições e histórico — está exatamente como deixou.",
            "status": "Restaurada",
            "pickUp": "Pode retomar exatamente onde ficou a partir do seu painel.",
            "cta": "Ir para o painel",
            "preheader": "{{companyName}} foi restaurada — está tudo exatamente como deixou."
        },
        "brandDeleteReminder": {
            "subject": "Último aviso: {{daysLabel}} para restaurar \"{{companyName}}\"",
            "heading": "A sua marca está prestes a ser eliminada",
            "intro": "Só para avisar: a sua marca eliminada <strong>{{companyName}}</strong> está agendada para ser <strong>eliminada permanentemente em {{date}}</strong> — ou seja, daqui a cerca de <strong>{{daysLabel}}</strong>. Depois disso, os seus links de pagamento, wallets, definições e histórico não poderão ser recuperados.",
            "timeLeft": "Tempo restante",
            "timeLeftBadge": "Restante: {{daysLabel}}",
            "deletesOn": "Eliminada em",
            "wantItBack": "Se a quiser de volta, basta responder a este e-mail ou contactar o suporte antes de <strong>{{date}}</strong> e restauramo-la com um clique. Se a eliminação foi intencional, não precisa de fazer nada.",
            "dayOne": "1 dia",
            "dayOther": "{{count}} dias",
            "cta": "Contactar o suporte",
            "preheader": "{{daysLabel}} para restaurar {{companyName}} antes de ser eliminada permanentemente."
        },
        "newDeviceAlert": {
            "subject": "Um novo dispositivo iniciou sessão na sua conta Dynopay",
            "heading": "Novo dispositivo com sessão iniciada",
            "intro": "A sua conta Dynopay acabou de ser acedida a partir de um dispositivo que não conhecíamos. Se foi você, não precisa de fazer nada.",
            "when": "Quando",
            "unknownDevice": "Dispositivo desconhecido",
            "unknownLocation": "Localização desconhecida",
            "warn": "Não reconhece este acesso? Toque no botão abaixo para terminar sessão em todos os dispositivos de imediato e, em seguida, altere a sua palavra-passe.",
            "cta": "Não fui eu — terminar sessão em todo o lado",
            "preheader": "Um novo dispositivo acabou de iniciar sessão na sua conta Dynopay."
        }
    },
    "nl": {
        "brandSoftDeleted": {
            "subject": "Uw merk \"{{companyName}}\" is verwijderd — u heeft 7 dagen om het te herstellen",
            "heading": "Uw merk is verwijderd",
            "intro": "Uw merk <strong>{{companyName}}</strong> is zojuist verwijderd op Dynopay. Geen zorgen — er is nog niets verloren. We bewaren alles (betaallinks, wallets, instellingen en geschiedenis) de komende <strong>7 dagen</strong> veilig, voor het geval dit een vergissing was.",
            "status": "Ingepland voor verwijdering",
            "restoreBefore": "Herstellen vóór",
            "changedMind": "<strong>Van gedachten veranderd?</strong> Beantwoord deze e-mail of neem vóór <strong>{{date}}</strong> contact op met ons supportteam en we zetten het merk met één klik precies terug zoals het was.",
            "afterDate": "Na {{date}} worden het merk en alle bijbehorende gegevens definitief verwijderd en kunnen ze niet meer worden hersteld.",
            "didntDoThis": "Heeft u dit merk niet verwijderd? Neem dan direct contact met ons op, zodat we uw account kunnen beveiligen.",
            "cta": "Contact opnemen met support",
            "preheader": "{{companyName}} is verwijderd — u heeft tot {{date}} om het te herstellen."
        },
        "brandPermanentlyDeleted": {
            "subject": "Uw merk \"{{companyName}}\" is definitief verwijderd",
            "heading": "Merk definitief verwijderd",
            "intro": "De hersteltermijn van 7 dagen voor uw merk <strong>{{companyName}}</strong> is verstreken. Het merk en alle bijbehorende gegevens zijn daarom <strong>definitief verwijderd</strong> van Dynopay. Dit kan niet ongedaan worden gemaakt.",
            "status": "Definitief verwijderd",
            "createNew": "Wilt u opnieuw betalingen accepteren? Dan kunt u op elk moment een nieuw merk aanmaken vanuit uw dashboard.",
            "didntExpect": "Had u dit niet verwacht? Beantwoord dan deze e-mail en we helpen u verder.",
            "cta": "Naar het dashboard",
            "preheader": "{{companyName}} is definitief verwijderd van Dynopay."
        },
        "brandRestored": {
            "subject": "Goed nieuws — uw merk \"{{companyName}}\" is terug",
            "heading": "Uw merk is terug",
            "intro": "We hebben uw merk <strong>{{companyName}}</strong> op Dynopay hersteld. Alles — uw betaallinks, wallets, instellingen en geschiedenis — is precies zoals u het achterliet.",
            "status": "Hersteld",
            "pickUp": "U kunt vanuit uw dashboard verdergaan waar u gebleven was.",
            "cta": "Naar het dashboard",
            "preheader": "{{companyName}} is hersteld — alles is precies zoals u het achterliet."
        },
        "brandDeleteReminder": {
            "subject": "Nog {{daysLabel}} om \"{{companyName}}\" te herstellen",
            "heading": "Uw merk wordt binnenkort verwijderd",
            "intro": "Even een herinnering: uw verwijderde merk <strong>{{companyName}}</strong> wordt op <strong>{{date}} definitief verwijderd</strong> — dat is over ongeveer <strong>{{daysLabel}}</strong>. Daarna kunnen de betaallinks, wallets, instellingen en geschiedenis niet meer worden hersteld.",
            "timeLeft": "Resterende tijd",
            "timeLeftBadge": "Nog {{daysLabel}}",
            "deletesOn": "Wordt verwijderd op",
            "wantItBack": "Wilt u het merk terug? Beantwoord dan deze e-mail of neem vóór <strong>{{date}}</strong> contact op met support en we herstellen het met één klik. Was de verwijdering de bedoeling, dan hoeft u niets te doen.",
            "dayOne": "1 dag",
            "dayOther": "{{count}} dagen",
            "cta": "Contact opnemen met support",
            "preheader": "Nog {{daysLabel}} om {{companyName}} te herstellen voordat het definitief wordt verwijderd."
        },
        "newDeviceAlert": {
            "subject": "Nieuw apparaat aangemeld bij uw Dynopay-account",
            "heading": "Nieuw apparaat aangemeld",
            "intro": "Er is zojuist toegang verkregen tot uw Dynopay-account vanaf een apparaat dat we nog niet kenden. Was u dit? Dan hoeft u niets te doen.",
            "when": "Wanneer",
            "unknownDevice": "Onbekend apparaat",
            "unknownLocation": "Onbekende locatie",
            "warn": "Herkent u dit niet? Tik op de knop hieronder om direct op alle apparaten uit te loggen en wijzig daarna uw wachtwoord.",
            "cta": "Dit was ik niet — overal uitloggen",
            "preheader": "Er is zojuist een nieuw apparaat aangemeld bij uw Dynopay-account."
        }
    },
}


def main() -> None:
    en_keys = {b: set(v.keys()) for b, v in NEW["en"].items()}
    for lang, blocks in NEW.items():
        for block, keys in en_keys.items():
            assert set(blocks[block].keys()) == keys, f"{lang}.{block} key mismatch"
        path = ROOT / lang / "emails.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        merchant = data["merchant"]
        rebuilt = {}
        for key, value in merchant.items():
            if key in blocks:
                continue
            rebuilt[key] = value
            if key == "apiKeyRevoked":
                for new_key, new_val in blocks.items():
                    rebuilt[new_key] = new_val
        for new_key, new_val in blocks.items():
            rebuilt.setdefault(new_key, new_val)
        data["merchant"] = rebuilt
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"{lang}: ok ({sum(len(b) for b in blocks.values())} keys in {len(blocks)} blocks)")


if __name__ == "__main__":
    main()
