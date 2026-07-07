const fs = require("fs");
const path = require("path");

const titles = {
  en: "{{currency}} API Key",
  es: "Clave API {{currency}}",
  fr: "Clé API {{currency}}",
  de: "{{currency}} API-Schlüssel",
  pt: "Chave de API {{currency}}",
  nl: "{{currency}} API-sleutel",
};

for (const [lang, value] of Object.entries(titles)) {
  const file = path.join(__dirname, "..", "langs", "locales", lang, "apiScreen.json");
  const json = JSON.parse(fs.readFileSync(file, "utf8"));
  json.apiKeyTitle = value;
  fs.writeFileSync(file, JSON.stringify(json, null, 2) + "\n");
  console.log(`updated ${lang}/apiScreen.json -> apiKeyTitle`);
}
