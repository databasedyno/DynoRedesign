/* One-off: shorten paymentSource.* labels + add labels.paymentSource ("Received via")
   across all 6 locales, via surgical text edits (no JSON reformat). Delete after. */
const fs = require("fs");
const path = require("path");

const data = {
  en: { po:["Product order","Store"], dn:["Donation campaign","Donation"], tp:["Tip / Contribution","Tip"], pm:"Payment method", rv:"Received via" },
  de: { po:["Produktbestellung","Shop"], dn:["Spendenkampagne","Spende"], tp:["Trinkgeld / Beitrag","Trinkgeld"], pm:"Zahlungsart", rv:"Erhalten über" },
  es: { po:["Pedido de producto","Tienda"], dn:["Campaña de donación","Donación"], tp:["Propina / Contribución","Propina"], pm:"Método de pago", rv:"Recibido vía" },
  fr: { po:["Commande de produit","Boutique"], dn:["Campagne de dons","Don"], tp:["Pourboire / Contribution","Pourboire"], pm:"Mode de paiement", rv:"Reçu via" },
  nl: { po:["Productbestelling","Winkel"], dn:["Donatiecampagne","Donatie"], tp:["Fooi / Bijdrage","Fooi"], pm:"Betaalmethode", rv:"Ontvangen via" },
  pt: { po:["Pedido de produto","Loja"], dn:["Campanha de doação","Doação"], tp:["Gorjeta / Contribuição","Gorjeta"], pm:"Forma de pagamento", rv:"Recebido via" },
};

const replaceOnce = (txt, oldStr, newStr, label) => {
  const n = txt.split(oldStr).length - 1;
  if (n !== 1) throw new Error(`Expected exactly 1 occurrence of [${label}] "${oldStr}", found ${n}`);
  return txt.replace(oldStr, newStr);
};

for (const [L, d] of Object.entries(data)) {
  const file = path.join(__dirname, "..", "locales", L, "emails.json");
  let txt = fs.readFileSync(file, "utf8");
  txt = replaceOnce(txt, `"productOrder": "${d.po[0]}"`, `"productOrder": "${d.po[1]}"`, `${L}.productOrder`);
  txt = replaceOnce(txt, `"donation": "${d.dn[0]}"`, `"donation": "${d.dn[1]}"`, `${L}.donation`);
  txt = replaceOnce(txt, `"tip": "${d.tp[0]}"`, `"tip": "${d.tp[1]}"`, `${L}.tip`);
  txt = replaceOnce(txt, `"paymentMethod": "${d.pm}",`, `"paymentMethod": "${d.pm}",\n  "paymentSource": "${d.rv}",`, `${L}.labels.paymentSource`);
  // validate JSON still parses
  JSON.parse(txt);
  fs.writeFileSync(file, txt);
  console.log(`✅ ${L} updated`);
}
console.log("DONE");
