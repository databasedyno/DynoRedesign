/* One-off: inject a top-level "walletSecurity" namespace (payout-address change alert
   + account-secured notice) into all 6 locales. Inserted as the first top-level key so
   the rest of the file is byte-identical. Idempotent. Delete after use. */
const fs = require("fs");
const path = require("path");

const T = {
  en: {
    brandFallback: "your brand",
    actionAdded: "added",
    actionUpdated: "updated",
    changeAlert: {
      subjectSingle: "Your {{network}} payout address was changed",
      subjectMulti: "Your payout addresses were changed",
      heading: "Payout address changed",
      preheader: "If this wasn't you, undo it in one tap and lock payout address changes.",
      introSingle: "The payout address for <strong>{{brand}}</strong> was just updated. Here is the detail:",
      introMulti: "The payout addresses for <strong>{{brand}}</strong> were just updated. Here are the details:",
      noAction: "If you made this change, you're all set — no action is needed.",
      alert: "Didn't do this? Tap the button below to instantly undo it and lock further payout address changes on your account.",
      cta: "This wasn't me — undo & lock",
    },
    secured: {
      subject: "We've secured your account",
      heading: "Account secured",
      preheader: "We've undone the payout address change and locked further edits on your account.",
      introSingle: "As requested, we've undone the recent payout address change for <strong>{{brand}}</strong> and <strong>locked further payout address changes</strong> on your account.",
      introMulti: "As requested, we've undone the recent payout address changes for <strong>{{brand}}</strong> and <strong>locked further payout address changes</strong> on your account.",
      networksRestoredLabel: "Networks restored",
      warn: "For your safety, new payout addresses can't be added or edited until you contact support and confirm it's really you.",
      passwordRec: "We also recommend changing your account password if you suspect it was compromised.",
      cta: "Contact support",
    },
  },
  de: {
    brandFallback: "deine Marke",
    actionAdded: "hinzugefügt",
    actionUpdated: "aktualisiert",
    changeAlert: {
      subjectSingle: "Deine {{network}}-Auszahlungsadresse wurde geändert",
      subjectMulti: "Deine Auszahlungsadressen wurden geändert",
      heading: "Auszahlungsadresse geändert",
      preheader: "Falls du das nicht warst, mache es mit einem Tippen rückgängig und sperre Adressänderungen.",
      introSingle: "Die Auszahlungsadresse für <strong>{{brand}}</strong> wurde gerade aktualisiert. Hier das Detail:",
      introMulti: "Die Auszahlungsadressen für <strong>{{brand}}</strong> wurden gerade aktualisiert. Hier die Details:",
      noAction: "Wenn du diese Änderung vorgenommen hast, ist alles in Ordnung — du musst nichts tun.",
      alert: "Warst du das nicht? Tippe unten auf den Button, um es sofort rückgängig zu machen und weitere Änderungen der Auszahlungsadresse in deinem Konto zu sperren.",
      cta: "Das war ich nicht — rückgängig machen & sperren",
    },
    secured: {
      subject: "Wir haben dein Konto gesichert",
      heading: "Konto gesichert",
      preheader: "Wir haben die Änderung der Auszahlungsadresse rückgängig gemacht und weitere Änderungen gesperrt.",
      introSingle: "Wie gewünscht haben wir die letzte Änderung der Auszahlungsadresse für <strong>{{brand}}</strong> rückgängig gemacht und <strong>weitere Änderungen der Auszahlungsadresse gesperrt</strong>.",
      introMulti: "Wie gewünscht haben wir die letzten Änderungen der Auszahlungsadressen für <strong>{{brand}}</strong> rückgängig gemacht und <strong>weitere Änderungen der Auszahlungsadresse gesperrt</strong>.",
      networksRestoredLabel: "Wiederhergestellte Netzwerke",
      warn: "Zu deiner Sicherheit können neue Auszahlungsadressen erst hinzugefügt oder bearbeitet werden, wenn du den Support kontaktierst und bestätigst, dass du es wirklich bist.",
      passwordRec: "Wir empfehlen außerdem, dein Kontopasswort zu ändern, falls du einen Missbrauch vermutest.",
      cta: "Support kontaktieren",
    },
  },
  es: {
    brandFallback: "tu marca",
    actionAdded: "añadida",
    actionUpdated: "actualizada",
    changeAlert: {
      subjectSingle: "Tu dirección de cobro de {{network}} fue modificada",
      subjectMulti: "Tus direcciones de cobro fueron modificadas",
      heading: "Dirección de cobro modificada",
      preheader: "Si no fuiste tú, deshazlo con un toque y bloquea los cambios de dirección de cobro.",
      introSingle: "La dirección de cobro de <strong>{{brand}}</strong> acaba de actualizarse. Aquí está el detalle:",
      introMulti: "Las direcciones de cobro de <strong>{{brand}}</strong> acaban de actualizarse. Aquí están los detalles:",
      noAction: "Si hiciste este cambio, todo está en orden — no tienes que hacer nada.",
      alert: "¿No fuiste tú? Toca el botón de abajo para deshacerlo al instante y bloquear más cambios de dirección de cobro en tu cuenta.",
      cta: "No fui yo — deshacer y bloquear",
    },
    secured: {
      subject: "Hemos protegido tu cuenta",
      heading: "Cuenta protegida",
      preheader: "Hemos deshecho el cambio de dirección de cobro y bloqueado más ediciones en tu cuenta.",
      introSingle: "Como pediste, hemos deshecho el cambio reciente de dirección de cobro de <strong>{{brand}}</strong> y <strong>bloqueado más cambios de dirección de cobro</strong> en tu cuenta.",
      introMulti: "Como pediste, hemos deshecho los cambios recientes de direcciones de cobro de <strong>{{brand}}</strong> y <strong>bloqueado más cambios de dirección de cobro</strong> en tu cuenta.",
      networksRestoredLabel: "Redes restauradas",
      warn: "Por tu seguridad, no se pueden añadir ni editar nuevas direcciones de cobro hasta que contactes con soporte y confirmes que eres tú.",
      passwordRec: "También te recomendamos cambiar la contraseña de tu cuenta si sospechas que fue comprometida.",
      cta: "Contactar con soporte",
    },
  },
  fr: {
    brandFallback: "votre marque",
    actionAdded: "ajoutée",
    actionUpdated: "modifiée",
    changeAlert: {
      subjectSingle: "Votre adresse de versement {{network}} a été modifiée",
      subjectMulti: "Vos adresses de versement ont été modifiées",
      heading: "Adresse de versement modifiée",
      preheader: "Si ce n'était pas vous, annulez-le en un geste et verrouillez les modifications d'adresse de versement.",
      introSingle: "L'adresse de versement de <strong>{{brand}}</strong> vient d'être mise à jour. Voici le détail :",
      introMulti: "Les adresses de versement de <strong>{{brand}}</strong> viennent d'être mises à jour. Voici les détails :",
      noAction: "Si vous avez effectué ce changement, tout est en ordre — aucune action n'est requise.",
      alert: "Ce n'était pas vous ? Appuyez sur le bouton ci-dessous pour l'annuler instantanément et verrouiller toute autre modification d'adresse de versement sur votre compte.",
      cta: "Ce n'était pas moi — annuler et verrouiller",
    },
    secured: {
      subject: "Nous avons sécurisé votre compte",
      heading: "Compte sécurisé",
      preheader: "Nous avons annulé la modification d'adresse de versement et verrouillé toute autre modification sur votre compte.",
      introSingle: "Comme demandé, nous avons annulé la récente modification d'adresse de versement pour <strong>{{brand}}</strong> et <strong>verrouillé toute autre modification d'adresse de versement</strong> sur votre compte.",
      introMulti: "Comme demandé, nous avons annulé les récentes modifications d'adresses de versement pour <strong>{{brand}}</strong> et <strong>verrouillé toute autre modification d'adresse de versement</strong> sur votre compte.",
      networksRestoredLabel: "Réseaux restaurés",
      warn: "Pour votre sécurité, aucune nouvelle adresse de versement ne peut être ajoutée ou modifiée tant que vous n'avez pas contacté le support et confirmé que c'est bien vous.",
      passwordRec: "Nous vous recommandons également de changer le mot de passe de votre compte si vous soupçonnez qu'il a été compromis.",
      cta: "Contacter le support",
    },
  },
  nl: {
    brandFallback: "je merk",
    actionAdded: "toegevoegd",
    actionUpdated: "bijgewerkt",
    changeAlert: {
      subjectSingle: "Je {{network}}-uitbetaaladres is gewijzigd",
      subjectMulti: "Je uitbetaaladressen zijn gewijzigd",
      heading: "Uitbetaaladres gewijzigd",
      preheader: "Als jij dit niet was, maak het dan met één tik ongedaan en vergrendel adreswijzigingen.",
      introSingle: "Het uitbetaaladres voor <strong>{{brand}}</strong> is zojuist bijgewerkt. Hier is het detail:",
      introMulti: "De uitbetaaladressen voor <strong>{{brand}}</strong> zijn zojuist bijgewerkt. Hier zijn de details:",
      noAction: "Als jij deze wijziging hebt gedaan, is alles in orde — je hoeft niets te doen.",
      alert: "Was jij dit niet? Tik op de knop hieronder om het direct ongedaan te maken en verdere wijzigingen van het uitbetaaladres op je account te vergrendelen.",
      cta: "Ik was dit niet — ongedaan maken & vergrendelen",
    },
    secured: {
      subject: "We hebben je account beveiligd",
      heading: "Account beveiligd",
      preheader: "We hebben de wijziging van het uitbetaaladres ongedaan gemaakt en verdere bewerkingen vergrendeld.",
      introSingle: "Zoals gevraagd hebben we de recente wijziging van het uitbetaaladres voor <strong>{{brand}}</strong> ongedaan gemaakt en <strong>verdere wijzigingen van het uitbetaaladres vergrendeld</strong> op je account.",
      introMulti: "Zoals gevraagd hebben we de recente wijzigingen van de uitbetaaladressen voor <strong>{{brand}}</strong> ongedaan gemaakt en <strong>verdere wijzigingen van het uitbetaaladres vergrendeld</strong> op je account.",
      networksRestoredLabel: "Herstelde netwerken",
      warn: "Voor je veiligheid kunnen er geen nieuwe uitbetaaladressen worden toegevoegd of bewerkt totdat je contact opneemt met support en bevestigt dat jij het echt bent.",
      passwordRec: "We raden ook aan je accountwachtwoord te wijzigen als je vermoedt dat het is gecompromitteerd.",
      cta: "Contact opnemen met support",
    },
  },
  pt: {
    brandFallback: "a sua marca",
    actionAdded: "adicionado",
    actionUpdated: "atualizado",
    changeAlert: {
      subjectSingle: "O seu endereço de pagamento {{network}} foi alterado",
      subjectMulti: "Os seus endereços de pagamento foram alterados",
      heading: "Endereço de pagamento alterado",
      preheader: "Se não foi você, desfaça-o com um toque e bloqueie as alterações de endereço de pagamento.",
      introSingle: "O endereço de pagamento de <strong>{{brand}}</strong> acabou de ser atualizado. Aqui está o detalhe:",
      introMulti: "Os endereços de pagamento de <strong>{{brand}}</strong> acabaram de ser atualizados. Aqui estão os detalhes:",
      noAction: "Se foi você que fez esta alteração, está tudo bem — não é preciso fazer nada.",
      alert: "Não foi você? Toque no botão abaixo para desfazer de imediato e bloquear mais alterações de endereço de pagamento na sua conta.",
      cta: "Não fui eu — desfazer e bloquear",
    },
    secured: {
      subject: "Protegemos a sua conta",
      heading: "Conta protegida",
      preheader: "Desfizemos a alteração do endereço de pagamento e bloqueámos mais edições na sua conta.",
      introSingle: "Conforme solicitado, desfizemos a recente alteração do endereço de pagamento de <strong>{{brand}}</strong> e <strong>bloqueámos mais alterações de endereço de pagamento</strong> na sua conta.",
      introMulti: "Conforme solicitado, desfizemos as recentes alterações dos endereços de pagamento de <strong>{{brand}}</strong> e <strong>bloqueámos mais alterações de endereço de pagamento</strong> na sua conta.",
      networksRestoredLabel: "Redes restauradas",
      warn: "Para sua segurança, não é possível adicionar nem editar novos endereços de pagamento até contactar o suporte e confirmar que é mesmo você.",
      passwordRec: "Recomendamos também que altere a palavra-passe da sua conta se suspeitar que foi comprometida.",
      cta: "Contactar o suporte",
    },
  },
};

for (const [L, obj] of Object.entries(T)) {
  const file = path.join(__dirname, "..", "locales", L, "emails.json");
  let txt = fs.readFileSync(file, "utf8");
  if (/^\{\n\s*"walletSecurity"/.test(txt)) { console.log(`⏭  ${L} already has walletSecurity — skipping`); continue; }
  if (!/^\{\n/.test(txt)) throw new Error(`${L}: unexpected file start`);
  const ser = JSON.stringify(obj, null, 1);
  const block = ser.split("\n").map((l) => " " + l).join("\n").replace(/^ \{/, ' "walletSecurity": {') + ",\n";
  txt = txt.replace(/^\{\n/, "{\n" + block);
  JSON.parse(txt); // validate
  fs.writeFileSync(file, txt);
  console.log(`✅ ${L} updated`);
}
console.log("DONE");
