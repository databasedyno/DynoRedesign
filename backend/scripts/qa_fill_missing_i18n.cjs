/* One-off: add the 13 en-only keys (receipt.contributionNote + security.twoFaReset*
   + security.twoFaResetDone*) to de/es/fr/nl/pt. Surgical insert (no reformat).
   Idempotent: skips a locale that already has twoFaReset. Delete after. */
const fs = require("fs");
const path = require("path");

const T = {
  de: {
    contributionNote: "Für diesen Beitrag wurden keine Waren oder Dienstleistungen erbracht.",
    reset: {
      subject: "Zwei-Schritt-Verifizierung zurücksetzen",
      preheader: "Bestätige, um deine Authenticator-App zu entfernen und zu E-Mail-Codes zu wechseln.",
      heading: "Zwei-Schritt-Verifizierung zurücksetzen?",
      intro: "Jemand (hoffentlich du) hat nach Eingabe des richtigen Passworts angefordert, die Authenticator-App deines Kontos zurückzusetzen. Klicke unten zur Bestätigung. Der Link läuft in 30 Minuten ab und funktioniert nur einmal.",
      consequences: "Mit der Bestätigung wirst du auf allen Geräten abgemeldet, alle vertrauenswürdigen Browser werden entfernt, dein zweiter Schritt wechselt zu E-Mail-Codes und Änderungen der Auszahlungsadresse werden zur Sicherheit 24 Stunden lang gesperrt.",
      cta: "Zwei-Schritt-Verifizierung zurücksetzen",
      ignore: "Wenn du das nicht angefordert hast, kannst du diese E-Mail ignorieren — es ändert sich nichts. Ändere dein Passwort, falls dir diese Aktivität nicht bekannt vorkommt.",
    },
    done: {
      subject: "Deine Zwei-Schritt-Verifizierung wurde zurückgesetzt",
      preheader: "Authenticator entfernt, Sitzungen abgemeldet, Änderungen der Auszahlungsadresse für 24 Stunden gesperrt.",
      heading: "Zwei-Schritt-Verifizierung zurückgesetzt",
      intro: "Deine Authenticator-App wurde entfernt und E-Mail-Codes sind jetzt dein zweiter Schritt bei der Anmeldung. Alle Sitzungen und vertrauenswürdigen Geräte wurden abgemeldet.",
      freeze: "Änderungen der Auszahlungsadresse sind bis {{until}} gesperrt. Unser Team wurde benachrichtigt und kann die Sperre früher aufheben, wenn du den Support kontaktierst.",
    },
  },
  es: {
    contributionNote: "No se proporcionaron bienes ni servicios a cambio de esta contribución.",
    reset: {
      subject: "Restablece tu verificación en dos pasos",
      preheader: "Confirma para eliminar tu aplicación de autenticación y cambiar a códigos por correo.",
      heading: "¿Restablecer la verificación en dos pasos?",
      intro: "Alguien (esperamos que tú) solicitó restablecer la aplicación de autenticación de tu cuenta tras introducir la contraseña correcta. Haz clic abajo para confirmar. El enlace caduca en 30 minutos y funciona una sola vez.",
      consequences: "Al confirmar, se cerrará tu sesión en todos los dispositivos, se olvidarán todos los navegadores de confianza, tu segundo paso cambiará a códigos por correo y los cambios de dirección de pago se bloquearán durante 24 horas como medida de seguridad.",
      cta: "Restablecer la verificación en dos pasos",
      ignore: "Si no solicitaste esto, puedes ignorar este correo: no cambia nada. Considera cambiar tu contraseña si no reconoces esta actividad.",
    },
    done: {
      subject: "Tu verificación en dos pasos se restableció",
      preheader: "Autenticador eliminado, sesiones cerradas, cambios de dirección de pago bloqueados durante 24 horas.",
      heading: "Verificación en dos pasos restablecida",
      intro: "Se eliminó tu aplicación de autenticación y ahora los códigos por correo son tu segundo paso al iniciar sesión. Se cerraron todas las sesiones y dispositivos de confianza.",
      freeze: "Los cambios de dirección de pago están bloqueados hasta {{until}}. Nuestro equipo ha sido notificado y puede levantar el bloqueo antes si contactas con soporte.",
    },
  },
  fr: {
    contributionNote: "Aucun bien ou service n'a été fourni en échange de cette contribution.",
    reset: {
      subject: "Réinitialisez votre vérification en deux étapes",
      preheader: "Confirmez pour supprimer votre application d'authentification et passer aux codes par e-mail.",
      heading: "Réinitialiser la vérification en deux étapes ?",
      intro: "Quelqu'un (nous espérons que c'est vous) a demandé à réinitialiser l'application d'authentification de votre compte après avoir saisi le bon mot de passe. Cliquez ci-dessous pour confirmer. Le lien expire dans 30 minutes et ne fonctionne qu'une seule fois.",
      consequences: "En confirmant, vous serez déconnecté de tous les appareils, tous les navigateurs de confiance seront oubliés, votre deuxième étape passera aux codes par e-mail et les modifications de l'adresse de versement seront verrouillées pendant 24 heures par mesure de sécurité.",
      cta: "Réinitialiser la vérification en deux étapes",
      ignore: "Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail — rien ne change. Envisagez de changer votre mot de passe si vous ne reconnaissez pas cette activité.",
    },
    done: {
      subject: "Votre vérification en deux étapes a été réinitialisée",
      preheader: "Authentificateur supprimé, sessions déconnectées, modifications de l'adresse de versement verrouillées pendant 24 heures.",
      heading: "Vérification en deux étapes réinitialisée",
      intro: "Votre application d'authentification a été supprimée et les codes par e-mail constituent désormais votre deuxième étape à la connexion. Toutes les sessions et tous les appareils de confiance ont été déconnectés.",
      freeze: "Les modifications de l'adresse de versement sont verrouillées jusqu'au {{until}}. Notre équipe a été informée et peut lever le verrou plus tôt si vous contactez le support.",
    },
  },
  nl: {
    contributionNote: "Er zijn geen goederen of diensten geleverd in ruil voor deze bijdrage.",
    reset: {
      subject: "Reset je verificatie in twee stappen",
      preheader: "Bevestig om je authenticator-app te verwijderen en over te schakelen op e-mailcodes.",
      heading: "Verificatie in twee stappen resetten?",
      intro: "Iemand (hopelijk jij) heeft gevraagd om de authenticator-app van je account te resetten na het invoeren van het juiste wachtwoord. Klik hieronder om te bevestigen. De link verloopt over 30 minuten en werkt één keer.",
      consequences: "Als je bevestigt, word je op elk apparaat afgemeld, worden alle vertrouwde browsers vergeten, wordt je tweede stap gewijzigd in e-mailcodes en worden wijzigingen van het uitbetalingsadres 24 uur lang vergrendeld als veiligheidsmaatregel.",
      cta: "Verificatie in twee stappen resetten",
      ignore: "Als je dit niet hebt aangevraagd, kun je deze e-mail negeren — er verandert niets. Overweeg je wachtwoord te wijzigen als je deze activiteit niet herkent.",
    },
    done: {
      subject: "Je verificatie in twee stappen is gereset",
      preheader: "Authenticator verwijderd, sessies afgemeld, wijzigingen van het uitbetalingsadres 24 uur vergrendeld.",
      heading: "Verificatie in twee stappen gereset",
      intro: "Je authenticator-app is verwijderd en e-mailcodes zijn nu je tweede stap bij het inloggen. Alle sessies en vertrouwde apparaten zijn afgemeld.",
      freeze: "Wijzigingen van het uitbetalingsadres zijn vergrendeld tot {{until}}. Ons team is op de hoogte gebracht en kan de vergrendeling eerder opheffen als je contact opneemt met support.",
    },
  },
  pt: {
    contributionNote: "Nenhum bem ou serviço foi fornecido em troca desta contribuição.",
    reset: {
      subject: "Redefina a sua verificação em duas etapas",
      preheader: "Confirme para remover a sua app de autenticação e mudar para códigos por e-mail.",
      heading: "Redefinir a verificação em duas etapas?",
      intro: "Alguém (esperamos que você) pediu para redefinir a app de autenticação da sua conta após inserir a palavra-passe correta. Clique abaixo para confirmar. O link expira em 30 minutos e funciona apenas uma vez.",
      consequences: "Ao confirmar, a sua sessão será encerrada em todos os dispositivos, todos os navegadores fiáveis serão esquecidos, a sua segunda etapa mudará para códigos por e-mail e as alterações do endereço de pagamento ficarão bloqueadas durante 24 horas como medida de segurança.",
      cta: "Redefinir a verificação em duas etapas",
      ignore: "Se não foi você que solicitou isto, pode ignorar este e-mail — nada muda. Considere alterar a sua palavra-passe se não reconhecer esta atividade.",
    },
    done: {
      subject: "A sua verificação em duas etapas foi redefinida",
      preheader: "Autenticador removido, sessões encerradas, alterações do endereço de pagamento bloqueadas durante 24 horas.",
      heading: "Verificação em duas etapas redefinida",
      intro: "A sua app de autenticação foi removida e os códigos por e-mail são agora a sua segunda etapa ao iniciar sessão. Todas as sessões e dispositivos fiáveis foram desligados.",
      freeze: "As alterações do endereço de pagamento estão bloqueadas até {{until}}. A nossa equipa foi notificada e pode remover o bloqueio mais cedo se contactar o suporte.",
    },
  },
};

const J = (s) => JSON.stringify(s);

for (const [L, d] of Object.entries(T)) {
  const file = path.join(__dirname, "..", "locales", L, "emails.json");
  let txt = fs.readFileSync(file, "utf8");
  if (txt.includes('"twoFaReset"')) { console.log(`⏭  ${L} already has twoFaReset — skipping`); continue; }

  const receiptIns = `  "contributionNote": ${J(d.contributionNote)},\n`;
  const r = d.reset, dn = d.done;
  const securityIns =
    `  "twoFaReset": {\n` +
    `   "subject": ${J(r.subject)},\n` +
    `   "preheader": ${J(r.preheader)},\n` +
    `   "heading": ${J(r.heading)},\n` +
    `   "intro": ${J(r.intro)},\n` +
    `   "consequences": ${J(r.consequences)},\n` +
    `   "cta": ${J(r.cta)},\n` +
    `   "ignore": ${J(r.ignore)}\n` +
    `  },\n` +
    `  "twoFaResetDone": {\n` +
    `   "subject": ${J(dn.subject)},\n` +
    `   "preheader": ${J(dn.preheader)},\n` +
    `   "heading": ${J(dn.heading)},\n` +
    `   "intro": ${J(dn.intro)},\n` +
    `   "freeze": ${J(dn.freeze)}\n` +
    `  },\n`;

  const recAnchor = ` "receipt": {\n`;
  const secAnchor = ` "security": {\n`;
  if (txt.split(recAnchor).length - 1 !== 1) throw new Error(`${L}: receipt anchor not unique`);
  if (txt.split(secAnchor).length - 1 !== 1) throw new Error(`${L}: security anchor not unique`);
  txt = txt.replace(recAnchor, recAnchor + receiptIns);
  txt = txt.replace(secAnchor, secAnchor + securityIns);
  JSON.parse(txt); // validate
  fs.writeFileSync(file, txt);
  console.log(`✅ ${L} updated`);
}
console.log("DONE");
