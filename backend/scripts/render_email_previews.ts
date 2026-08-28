/**
 * Render representative email templates to /tmp for visual QA.
 * Run: node_modules/.bin/ts-node --transpile-only scripts/render_email_previews.ts
 */
import * as fs from "fs";
import {
  baseEmailTemplate, p, otpBlock, infoBox, dataRow, statusBadge,
  statCard, twoColumnStats, feeRow, feeTotalRow, feeTable, mono, successBox, alertBox,
} from "../utils/emailTemplate";

// 1. Login OTP email
const otpHtml = baseEmailTemplate(
  "Your login code",
  `${p("Hey Alex,")}
   ${p("Use the code below to sign in to your DynoPay account. It expires in <strong>10 minutes</strong>.")}
   ${otpBlock("482913")}
   ${p("If you didn't request this code, you can safely ignore this email.")}`,
  { showButton: false, preheader: "Your DynoPay login code" }
);

// 2. Payment received email
const paymentHtml = baseEmailTemplate(
  "Payment received",
  `${p("Hey Alex,")}
   ${p(`Great news — you just received a payment. ${statusBadge("Confirmed", "success")}`)}
   ${twoColumnStats(
     statCard("Received", "0.0042 BTC", "≈ $261.37 USD", "blue"),
     statCard("Payout", "$257.45 USD", "after fees", "green")
   )}
   ${infoBox(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${dataRow("Transaction ID", mono("9f2c1e7a-55d1-4b2e"))}
      ${dataRow("Network", "Bitcoin")}
      ${dataRow("Customer", "customer@example.com", true)}
    </table>`)}
   ${feeTable(`${feeRow("Gross amount", "$261.37")}${feeRow("Platform fee (1.5%)", "-$3.92", true)}${feeTotalRow("Net payout", "$257.45")}`)}`,
  { showButton: true, buttonText: "View transaction", buttonLink: "https://dynopay.com/transactions", preheader: "You received 0.0042 BTC" }
);

// 3. Welcome email
const welcomeHtml = baseEmailTemplate(
  "Welcome to DynoPay",
  `${p("Hey Alex,")}
   ${p("Your account is ready. Accept crypto payments and get paid straight to your wallet — or auto-converted to stablecoins.")}
   ${successBox(`<p style="margin:0;font-size:14px;color:#374151;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;"><strong>Your very first payment is platform-fee-free — any size, no cap.</strong> After that, fees start at 1.5% and drop to 0.5% as your volume grows.</p>`)}
   ${alertBox(`<p style="margin:0;font-size:14px;color:#78350f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">Next step: add your payout wallet to start accepting payments.</p>`)}`,
  { showButton: true, buttonText: "Go to dashboard", buttonLink: "https://dynopay.com/dashboard", preheader: "Your DynoPay account is ready" }
);

fs.writeFileSync("/tmp/email_preview/otp.html", otpHtml);
fs.writeFileSync("/tmp/email_preview/payment.html", paymentHtml);
fs.writeFileSync("/tmp/email_preview/welcome.html", welcomeHtml);
console.log("rendered 3 previews to /tmp/email_preview/");
