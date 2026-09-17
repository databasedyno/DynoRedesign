/* One-off: add about.legit.contactValue ("Chat with us") right after
   about.legit.contact in each landing.json. Targeted line insert preserves
   formatting. Idempotent. Delete after use. */
const fs = require("fs");
const path = require("path");

const V = {
  en: "Chat with us",
  de: "Chatte mit uns",
  es: "Chatea con nosotros",
  fr: "Discuter avec nous",
  nl: "Chat met ons",
  pt: "Fale connosco no chat",
};

for (const [L, val] of Object.entries(V)) {
  const file = path.join(__dirname, "..", "..", "langs", "locales", L, "landing.json");
  let txt = fs.readFileSync(file, "utf8");
  if (/"contactValue"\s*:/.test(txt)) { console.log(`⏭  ${L} already has contactValue`); continue; }

  const legitAt = txt.indexOf('"legit"');
  if (legitAt === -1) throw new Error(`${L}: about.legit block not found`);
  // First "contact": "..." line at/after the legit block
  const re = /^(\s*)"contact":\s*"[^"]*",?\s*$/m;
  const slice = txt.slice(legitAt);
  const m = re.exec(slice);
  if (!m) throw new Error(`${L}: about.legit.contact line not found`);
  const indent = m[1];
  const lineStart = legitAt + m.index;
  const lineEnd = lineStart + m[0].length;
  const insertion = `\n${indent}"contactValue": ${JSON.stringify(val)},`;
  txt = txt.slice(0, lineEnd) + insertion + txt.slice(lineEnd);
  JSON.parse(txt); // validate
  fs.writeFileSync(file, txt);
  console.log(`✅ ${L} updated`);
}
console.log("DONE");
