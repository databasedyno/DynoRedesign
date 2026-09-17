/* One-off: reword helpAndSupport.articleStubMore to drop the support email and
   point to the in-app chat, in all 6 locales. Raw string replace preserves
   formatting. Idempotent. Delete after use. */
const fs = require("fs");
const path = require("path");

const M = {
  en: {
    old: "Need a hand with this topic? Our support team is available in the dashboard and at support@dynopay.com.",
    neu: "Need a hand with this topic? Our support team is one tap away — just open the chat from any page and we'll help you out.",
  },
  de: {
    old: "Brauchen Sie Hilfe zu diesem Thema? Unser Support-Team ist im Dashboard und unter support@dynopay.com verfügbar.",
    neu: "Brauchen Sie Hilfe zu diesem Thema? Unser Support-Team ist nur einen Tipp entfernt — öffnen Sie einfach den Chat auf einer beliebigen Seite und wir helfen Ihnen weiter.",
  },
  es: {
    old: "¿Necesitas ayuda con este tema? Nuestro equipo de soporte está disponible en el panel y en support@dynopay.com.",
    neu: "¿Necesitas ayuda con este tema? Nuestro equipo de soporte está a un toque — solo abre el chat desde cualquier página y te ayudaremos.",
  },
  fr: {
    old: "Besoin d'aide sur ce sujet ? Notre équipe de support est disponible dans le tableau de bord et à support@dynopay.com.",
    neu: "Besoin d'aide sur ce sujet ? Notre équipe de support est à portée de clic — ouvrez simplement le chat depuis n'importe quelle page et nous vous aiderons.",
  },
  nl: {
    old: "Heb je hulp nodig bij dit onderwerp? Ons supportteam is beschikbaar in het dashboard en op support@dynopay.com.",
    neu: "Heb je hulp nodig bij dit onderwerp? Ons supportteam is met één tik bereikbaar — open gewoon de chat op een willekeurige pagina en we helpen je verder.",
  },
  pt: {
    old: "Precisa de ajuda com este tópico? A nossa equipa de suporte está disponível no painel e em support@dynopay.com.",
    neu: "Precisa de ajuda com este tópico? A nossa equipa de suporte está a um toque — basta abrir o chat em qualquer página e ajudamos.",
  },
};

for (const [L, { old, neu }] of Object.entries(M)) {
  const file = path.join(__dirname, "..", "..", "langs", "locales", L, "helpAndSupport.json");
  let txt = fs.readFileSync(file, "utf8");
  if (txt.includes(neu)) { console.log(`⏭  ${L} already reworded`); continue; }
  if (!txt.includes(old)) throw new Error(`${L}: old articleStubMore value not found`);
  txt = txt.replace(old, neu);
  JSON.parse(txt); // validate
  fs.writeFileSync(file, txt);
  console.log(`✅ ${L} updated`);
}
console.log("DONE");
