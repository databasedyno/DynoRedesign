import { renderMoneyPath } from "../services/email/paymentSettled";

// Reproduce the BTC $23.74 case from the user's screenshot (was shown as "5%").
const html = renderMoneyPath("en", {
  grossCrypto: "0.00033081",
  asset: "BTC",
  fiatAtDetection: { amount: "23.74", currency: "USD" },
  feePercent: 5, // simulate the old blended % being passed
  feeCrypto: "0.00001655",
  feePayer: "company",
  networkFeeCrypto: "0",
  netCrypto: "0.00032716",
  destinationAddress: "1JH5Tn111111111111111111111111Do7",
  forwardTxHash: "f8322f0000000000000000000000000000cd0f",
  explorerUrl: "https://mempool.space/tx/abc",
  reference: "TEST-REF",
});

const feeLineOk = html.includes("Dynopay fee") && !/Dynopay fee \(/.test(html) && !/Dynopay fee[^<]*%/.test(html);
console.log("Contains 'Dynopay fee':", html.includes("Dynopay fee"));
console.log("Has a percent in the fee label:", /Dynopay fee[^<]*%/.test(html) || /Dynopay fee \(/.test(html));
console.log("RESULT:", feeLineOk ? "PASS — no % on the Dynopay fee line" : "FAIL — % still present");
// print the fee row snippet
const idx = html.indexOf("Dynopay fee");
console.log("Snippet:", html.slice(Math.max(0, idx - 20), idx + 60).replace(/\s+/g, " "));
