/**
 * Email Content Audit — before/after preview generator (Part 1, analysis only).
 * Renders the Top-15 emails with the REAL shared template so copy changes look
 * exactly as an inbox would: EN before/after + 3 DE i18n-chrome sanity renders.
 * Changes NOTHING in the app — no source string edited, no email sent.
 * Run: node_modules/.bin/ts-node --transpile-only scripts/email_audit_preview.ts
 */
import * as fs from "fs";
import * as path from "path";
import {
  baseEmailTemplate, p, otpBlock, infoBox, dataRow, statusBadge,
  statCard, twoColumnStats, feeRow, feeTotalRow, feeTable, mono,
  successBox, alertBox, warnText, errorBox,
} from "../utils/emailTemplate";
import { t } from "../utils/emailI18n";

const OUT = "/app/memory/email_previews";
fs.mkdirSync(OUT, { recursive: true });

type Variant = { subject: string; preheader?: string; html: string };
type Sample = { slug: string; label: string; note: string; before: Variant; after: Variant };

const HEY = (n = "Alex") => p(`Hey ${n},`);
const tbl = (rows: string) =>
  infoBox(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`, "#12B76A");

const samples: Sample[] = [];

// 1. Customer payment confirmation / receipt (buyer)
samples.push({
  slug: "01_customer_receipt", label: "Customer payment confirmation (receipt)",
  note: "Add preheader; tighten intro; keep fiat + crypto anchor; sentence-case.",
  before: {
    subject: "Payment successful - Receipt from Acme Store",
    html: baseEmailTemplate("Payment Successful", `${HEY()}
      ${p("Your payment to <strong>Acme Store</strong> has been successfully processed.")}
      ${tbl(`${dataRow("Status", statusBadge("Complete", "success"))}
        ${dataRow("Amount Paid", "<strong>261.37 USD</strong>")}
        ${dataRow("Crypto Amount", "0.0042 BTC")}
        ${dataRow("Transaction ID", mono("9f2c1e7a-55d1-4b2e"))}
        ${dataRow("Date", "05 June 2026 at 2:31 PM", true)}`)}
      ${p("<strong>PDF Receipt Attached</strong> - A detailed receipt is attached to this email for your records.")}
      ${p("If you have any questions about this payment, please contact <strong>Acme Store</strong> directly.")}`),
  },
  after: {
    subject: "Your payment to Acme Store is confirmed",
    preheader: "Receipt attached · 0.0042 BTC (≈ $261.37) paid to Acme Store",
    html: baseEmailTemplate("Payment confirmed", `${HEY()}
      ${p("Your payment to <strong>Acme Store</strong> went through — thank you. Your receipt is attached.")}
      ${tbl(`${dataRow("Status", statusBadge("Complete", "success"))}
        ${dataRow("You paid", "<strong>0.0042 BTC · ≈ $261.37 USD</strong>")}
        ${dataRow("Network", "Bitcoin")}
        ${dataRow("Transaction ID", mono("9f2c1e7a-55d1-4b2e"))}
        ${dataRow("Date", "05 June 2026 at 2:31 PM", true)}`)}
      ${p("A detailed PDF receipt is attached for your records.")}
      ${p("Questions about this payment? Just reply to <strong>Acme Store</strong>.", "font-size:13px;color:#6b7280;")}`, { preheader: "Receipt attached · 0.0042 BTC (≈ $261.37) paid to Acme Store" }),
  },
});

// 2. Payment received (merchant)
samples.push({
  slug: "02_payment_received", label: "Payment received — merchant",
  note: "Show fiat value + net-after-fee stat cards + network row.",
  before: {
    subject: "Payment received - 0.0042 BTC",
    html: baseEmailTemplate("Payment Received", `${HEY()}
      ${p("Great news! Your company <strong>Acme Store</strong> has received a payment.")}
      ${tbl(`${dataRow("Amount", "<strong>0.0042 BTC</strong>")}
        ${dataRow("Status", statusBadge("Received", "success"))}
        ${dataRow("Date", "05 June 2026 at 2:31 PM")}
        ${dataRow("Transaction ID", mono("9f2c1e7a-55d1-4b2e"), true)}`)}
      ${p("The funds have been forwarded to your payout wallet. You can view the full transaction details in your dashboard.")}`,
      { showButton: true, buttonText: "View Transaction", buttonLink: "https://dynopay.com/transactions" }),
  },
  after: {
    subject: "You've been paid 0.0042 BTC",
    preheader: "Acme Store · settled to your wallet — net $257.45 after fees",
    html: baseEmailTemplate("You've been paid", `${HEY()}
      ${p("<strong>Acme Store</strong> just received a payment — it's settled to your payout wallet.")}
      ${twoColumnStats(
        statCard("Received", "0.0042 BTC", "≈ $261.37 USD", "blue"),
        statCard("Net payout", "$257.45", "after 1.5% fee", "green"))}
      ${tbl(`${dataRow("Network", "Bitcoin")}
        ${dataRow("Customer", "customer@example.com")}
        ${dataRow("Transaction ID", mono("9f2c1e7a-55d1-4b2e"), true)}`)}
      ${feeTable(`${feeRow("Gross amount", "$261.37")}${feeRow("Dynopay fee (1.5%)", "-$3.92", true)}${feeTotalRow("Net payout", "$257.45")}`)}`,
      { showButton: true, buttonText: "View transaction", buttonLink: "https://dynopay.com/transactions", preheader: "Acme Store · settled to your wallet — net $257.45 after fees" }),
  },
});

// 3. Login OTP
samples.push({
  slug: "03_login_otp", label: "Login OTP",
  note: "Add preheader; add 'Dynopay will never ask for this code'.",
  before: {
    subject: "Your login code",
    html: baseEmailTemplate("Your Login Code", `${HEY()}
      ${p("Here's your one-time login code for Dynopay:")}
      ${otpBlock("482913")}
      ${p("This code expires in 5 minutes. If you didn't request this code, please secure your account immediately.")}`),
  },
  after: {
    subject: "Your login code (expires in 5 min)",
    preheader: "Never share this code — Dynopay staff will never ask for it.",
    html: baseEmailTemplate("Your login code", `${HEY()}
      ${p("Use this one-time code to sign in to Dynopay:")}
      ${otpBlock("482913")}
      ${p("It expires in <strong>5 minutes</strong>. <strong>Dynopay will never ask you for this code.</strong>")}
      ${p("Didn't try to sign in? Secure your account and change your password.", "font-size:13px;color:#6b7280;")}`,
      { preheader: "Never share this code — Dynopay staff will never ask for it." }),
  },
});

// 4. Payment pending
samples.push({
  slug: "04_payment_pending", label: "Payment pending (confirming)",
  note: "Show ONLY the paid coin's ETA (not a 5-coin table); add fiat.",
  before: {
    subject: "Your payment is pending confirmation",
    html: baseEmailTemplate("Payment Pending", `${HEY()}
      ${p("A new payment has been detected for your company <strong>Acme Store</strong>!")}
      ${tbl(`${dataRow("Amount", "<strong>0.0042 BTC</strong>")}
        ${dataRow("Status", statusBadge("Awaiting Confirmation", "pending"))}
        ${dataRow("Transaction ID", mono("9f2c1e7a-55d1-4b2e"), true)}`)}
      ${infoBox(`<p style="margin:0 0 8px 0;font-size:14px;font-weight:600;color:#92400e;">Estimated Confirmation Times</p>
        BTC: 10-60 min (1 confirmations)<br/>ETH/ERC20: 1-5 min<br/>TRX/TRC20: 1-3 min<br/>LTC: 2-30 min • DOGE: 1-10 min`, "#f59e0b")}
      ${p("We'll notify you once the payment is fully confirmed and credited to your wallet.")}`),
  },
  after: {
    subject: "Payment detected — confirming on-chain",
    preheader: "0.0042 BTC (≈ $261.37) from Acme Store — usually 10–60 min",
    html: baseEmailTemplate("Confirming your payment", `${HEY()}
      ${p("A payment to <strong>Acme Store</strong> has been detected and is confirming on the network.")}
      ${tbl(`${dataRow("Amount", "<strong>0.0042 BTC · ≈ $261.37 USD</strong>")}
        ${dataRow("Network", "Bitcoin")}
        ${dataRow("Status", statusBadge("Awaiting confirmation", "pending"))}
        ${dataRow("Transaction ID", mono("9f2c1e7a-55d1-4b2e"), true)}`)}
      ${infoBox(`<p style="margin:0;font-size:14px;color:#78350f;"><strong>Estimated time:</strong> Bitcoin usually confirms in <strong>10–60 minutes</strong>. We'll email you the moment it's credited to your wallet.</p>`, "#f59e0b")}`,
      { preheader: "0.0042 BTC (≈ $261.37) from Acme Store — usually 10–60 min" }),
  },
});

// 5. Welcome
samples.push({
  slug: "05_welcome", label: "Welcome",
  note: "Add preheader; tighten copy; verify promo wording vs landing/fees.",
  before: {
    subject: "Welcome to Dynopay - Let's get you paid",
    html: baseEmailTemplate("Welcome to Dynopay", `${HEY()}
      ${p("Welcome to Dynopay! We're excited to have you on board.")}
      ${p("Dynopay makes accepting crypto payments simple and secure — funds settle straight to a wallet you control. Whether you're a freelancer, business owner, or developer, we've got you covered.")}
      ${successBox(`<p style="margin:0;font-size:14px;"><strong>🎉 Your first payment is on us</strong> — we waive our entire platform fee on your first settled payment, any amount.</p>`)}
      ${p("Here's what you can do next:<br/>1. Complete your company profile<br/>2. Add your payout wallet<br/>3. Start accepting payments")}`,
      { showButton: true, buttonText: "Get Started", buttonLink: "https://dynopay.com/dashboard" }),
  },
  after: {
    subject: "Welcome to Dynopay — let's get you paid",
    preheader: "Your first settled payment is fee-free. 3 quick steps to get paid.",
    html: baseEmailTemplate("Welcome to Dynopay", `${HEY()}
      ${p("Your account is ready. Dynopay lets you accept crypto and settle straight to a wallet you control.")}
      ${successBox(`<p style="margin:0;font-size:14px;"><strong>Your first settled payment is fee-free</strong> — any amount. After that, fees start at 1.5% and drop as you grow.</p>`)}
      ${p("Three quick steps to your first payment:<br/>1. Complete your business profile<br/>2. Add your payout wallet<br/>3. Share a payment link")}`,
      { showButton: true, buttonText: "Get started", buttonLink: "https://dynopay.com/dashboard", preheader: "Your first settled payment is fee-free. 3 quick steps to get paid." }),
  },
});

// 6. Order receipt (buyer)
samples.push({
  slug: "06_order_receipt", label: "Order receipt — buyer",
  note: "Add preheader; unify greeting (uses inline 'Hi').",
  before: {
    subject: "Your order 1A2B3C4D is confirmed — Dynopay",
    html: baseEmailTemplate("Order confirmed", `${p("Hey there,")}
      ${p("Thanks for your purchase! Your payment has been received and your order is confirmed.")}
      ${infoBox(`Order reference: <strong style="font-family:monospace;">1A2B3C4D</strong>`)}
      ${p('<a href="#" style="color:#05936A;font-weight:600;">View order details →</a>')}`),
  },
  after: {
    subject: "Order 1A2B3C4D confirmed",
    preheader: "Thanks! Your order from Acme Store is confirmed · total $261.37",
    html: baseEmailTemplate("Order confirmed", `${HEY()}
      ${p("Thanks for your purchase — your payment is in and your order is confirmed.")}
      ${infoBox(`Order reference: <strong style="font-family:monospace;">1A2B3C4D</strong> · Total <strong>$261.37</strong>`)}
      ${p('<a href="#" style="color:#05936A;font-weight:600;">View order details →</a>')}`,
      { preheader: "Thanks! Your order from Acme Store is confirmed · total $261.37" }),
  },
});

// 7. KYC required (CORRECTNESS)
samples.push({
  slug: "07_kyc_required", label: "KYC required (threshold fix)",
  note: "Fix $5,000 → $10,000 (matches enforcement); fix non-USD phrasing; add grace context.",
  before: {
    subject: "Verification required - $5,000 volume reached",
    html: baseEmailTemplate("Verification Required", `${HEY()}
      ${p("Congratulations on reaching <strong>$12,480 USD</strong> in transaction volume!")}
      ${p("To continue accepting payments above $5,000, we need to verify your identity. This is a regulatory requirement and helps us keep Dynopay secure.")}
      ${infoBox(`<p style="margin:0 0 8px 0;font-weight:600;">What you need:</p>1. Government-issued ID<br/>2. Proof of address (utility bill, bank statement)<br/>3. About 5 minutes of your time`)}`,
      { showButton: true, buttonText: "Start Verification", buttonLink: "https://dynopay.com/dashboard" }),
  },
  after: {
    subject: "Verification required at $10,000 volume",
    preheader: "You've crossed $10,000 — a quick identity check keeps payments flowing.",
    html: baseEmailTemplate("Verification required", `${HEY()}
      ${p("Nice work — you've processed over <strong>$10,000</strong> on Dynopay.")}
      ${p("At this level, a quick identity check is required to keep accepting payments. You have <strong>90 days</strong> to complete it, and payments keep working in the meantime.")}
      ${infoBox(`<p style="margin:0 0 8px 0;font-weight:600;">What you'll need:</p>1. A government-issued ID<br/>2. A quick selfie for liveness<br/>3. About 5 minutes`)}`,
      { showButton: true, buttonText: "Start verification", buttonLink: "https://dynopay.com/dashboard", preheader: "You've crossed $10,000 — a quick identity check keeps payments flowing." }),
  },
});

// 8. Withdrawal OTP
samples.push({
  slug: "08_withdrawal_otp", label: "Withdrawal OTP",
  note: "Add preheader; add 'never share' line.",
  before: {
    subject: "Confirm your withdrawal",
    html: baseEmailTemplate("Confirm Withdrawal", `${HEY()}
      ${p("You're about to withdraw <strong>500.00 USDT</strong>. Please verify this action with the code below:")}
      ${otpBlock("739204")}
      ${warnText("This code expires in <strong>5 minutes</strong>. If you didn't request this withdrawal, please ignore this email and secure your account.")}`),
  },
  after: {
    subject: "Confirm your 500 USDT withdrawal",
    preheader: "Code expires in 5 min · Dynopay will never ask for it.",
    html: baseEmailTemplate("Confirm withdrawal", `${HEY()}
      ${p("Enter this code to confirm your withdrawal of <strong>500.00 USDT</strong>:")}
      ${otpBlock("739204")}
      ${tbl(`${dataRow("Amount", "<strong>500.00 USDT</strong>")}${dataRow("To address", mono("TXk…9fA2"), true)}`)}
      ${warnText("Expires in <strong>5 minutes</strong>. <strong>Dynopay will never ask you for this code.</strong> Didn't request it? Secure your account now.")}`,
      { preheader: "Code expires in 5 min · Dynopay will never ask for it." }),
  },
});

// 9. Wallet change alert (security)
samples.push({
  slug: "09_wallet_change", label: "Wallet change alert",
  note: "Add preheader; switch inline 'Hi' → 'Hey'.",
  before: {
    subject: "Your Bitcoin wallet was changed",
    html: baseEmailTemplate("Payout wallet changed", `${p("Hi Alex,")}
      ${p("The payout wallet for <strong>Acme Store</strong> was just updated. Here is the detail:")}
      ${infoBox(`<table role="presentation" width="100%">${dataRow("Bitcoin", `${mono("bc1q…k4x7")} <span style="color:#6b7280;font-size:12px;">(updated)</span>`, true)}</table>`, "#f59e0b")}
      ${p("If you made this change, you're all set — no action is needed.")}
      ${alertBox("Didn't do this? Tap the button below to instantly undo it and lock further wallet changes on your account.")}`,
      { showButton: true, buttonText: "This wasn't me — undo & lock", buttonLink: "#" }),
  },
  after: {
    subject: "Your Bitcoin payout wallet was changed",
    preheader: "If this wasn't you, undo it in one tap and lock wallet changes.",
    html: baseEmailTemplate("Payout wallet changed", `${HEY()}
      ${p("The Bitcoin payout wallet for <strong>Acme Store</strong> was just updated:")}
      ${infoBox(`<table role="presentation" width="100%">${dataRow("Bitcoin", `${mono("bc1q…k4x7")} <span style="color:#6b7280;font-size:12px;">(updated)</span>`, true)}</table>`, "#f59e0b")}
      ${p("Made this change? You're all set.")}
      ${alertBox("Didn't do this? Undo it instantly and lock further wallet changes on your account.")}`,
      { showButton: true, buttonText: "This wasn't me — undo & lock", buttonLink: "#", preheader: "If this wasn't you, undo it in one tap and lock wallet changes." }),
  },
});

// 10. Subscription payment failed (CORRECTNESS — banks/cards)
samples.push({
  slug: "10_sub_payment_failed", label: "Subscription payment failed (crypto fix)",
  note: "Remove card/bank language → crypto steps; CTA 'Complete payment'.",
  before: {
    subject: "Payment failed for Pro Plan",
    html: baseEmailTemplate("Payment Failed", `${HEY()}
      ${p("We were unable to process your subscription payment for <strong>Pro Plan</strong> from <strong>Acme Store</strong>.")}
      ${errorBox(`<table role="presentation" width="100%">${dataRow("Amount", "29.00 USDT")}${dataRow("Reason", "Payment not received")}${dataRow("Next Retry", "08 June 2026", true)}</table>`)}
      ${p("To keep your subscription active, please:<br/>1. Update your payment method<br/>2. Ensure sufficient funds are available<br/>3. Contact your bank if the issue persists")}
      ${warnText("Your subscription may be cancelled if payment is not received.")}`,
      { showButton: true, buttonText: "Update Payment", buttonLink: "#" }),
  },
  after: {
    subject: "Action needed — renew your Pro Plan",
    preheader: "Pay in crypto to keep your Pro Plan with Acme Store active.",
    html: baseEmailTemplate("Payment not completed", `${HEY()}
      ${p("We couldn't confirm your latest crypto payment for <strong>Pro Plan</strong> from <strong>Acme Store</strong>.")}
      ${errorBox(`<table role="presentation" width="100%">${dataRow("Amount due", "29.00 USDT")}${dataRow("Reason", "Payment not received")}${dataRow("We'll retry", "08 June 2026", true)}</table>`)}
      ${p("To keep your subscription active:<br/>1. Open the payment link below and pay in crypto<br/>2. Make sure your wallet covers the amount plus the network fee<br/>3. Reply to <strong>Acme Store</strong> if you need a hand")}
      ${warnText("If we don't receive payment, your subscription may be paused.")}`,
      { showButton: true, buttonText: "Complete payment", buttonLink: "#", preheader: "Pay in crypto to keep your Pro Plan with Acme Store active." }),
  },
});

// 11. Auto-conversion payout
samples.push({
  slug: "11_auto_conversion", label: "Auto-conversion payout",
  note: "Add preheader.",
  before: {
    subject: "Payout Complete — 257.45 USDC from 0.0042 BTC",
    html: baseEmailTemplate("Payout Complete", `${HEY()}
      ${p("Your crypto payment has been auto-converted and the payout has been sent to your wallet.")}
      ${twoColumnStats(statCard("Received", "0.0042 BTC", "≈ $261.37 USD"), statCard("Payout", "257.45 USDC", "Sent to your wallet", "green"))}
      ${p("Auto-conversion ensures you receive stablecoins, protecting your revenue from crypto price swings.")}`),
  },
  after: {
    subject: "Payout complete — 257.45 USDC",
    preheader: "Converted from 0.0042 BTC and sent to your wallet.",
    html: baseEmailTemplate("Payout complete", `${HEY()}
      ${p("Your payment was auto-converted to stablecoins and sent to your wallet.")}
      ${twoColumnStats(statCard("Received", "0.0042 BTC", "≈ $261.37 USD"), statCard("Payout", "257.45 USDC", "Sent to your wallet", "green"))}
      ${p("Auto-conversion protects your revenue from crypto price swings.")}`,
      { preheader: "Converted from 0.0042 BTC and sent to your wallet." }),
  },
});

// 12. Payment failed / underpaid (customer)
samples.push({
  slug: "12_payment_failed", label: "Payment failed / underpaid",
  note: "Add preheader; single clear next step.",
  before: {
    subject: "Underpayment detected - 200.00 of 261.37 USD received",
    html: baseEmailTemplate("Payment Unsuccessful", `${HEY()}
      ${p("Unfortunately, your payment to <strong>Acme Store</strong> was not completed.")}
      ${errorBox(`<p style="margin:0 0 6px 0;font-weight:600;color:#991b1b;">Issue</p><p style="margin:0;">We received 200.00 USD but the required amount was 261.37 USD</p>`)}
      ${p("Please contact <strong>Acme Store</strong> to resolve this underpayment or request a refund.")}`),
  },
  after: {
    subject: "Payment to Acme Store not completed",
    preheader: "We received $200 of $261.37 — here's how to finish or get a refund.",
    html: baseEmailTemplate("Payment not completed", `${HEY()}
      ${p("Your payment to <strong>Acme Store</strong> didn't fully go through.")}
      ${errorBox(`<p style="margin:0 0 6px 0;font-weight:600;color:#991b1b;">What happened</p><p style="margin:0;">We received <strong>$200.00</strong> of the <strong>$261.37</strong> due.</p>`)}
      ${p("Reply to <strong>Acme Store</strong> to send the remaining $61.37 or request a refund of what was received.")}`,
      { preheader: "We received $200 of $261.37 — here's how to finish or get a refund." }),
  },
});

// 13. Weekly payout digest
samples.push({
  slug: "13_payout_digest", label: "Weekly payout digest",
  note: "Add preheader; already strong.",
  before: {
    subject: "Weekly payout digest — $1,240.00",
    html: baseEmailTemplate("Your weekly payout digest", `${HEY()}
      ${p("Here's how the last 7 days looked for your business on Dynopay.")}
      ${twoColumnStats(statCard("Settled this week", "$1,240.00", "8 payments"), statCard("Platform fees", "$18.60", "Starter tier — 1.5%", "green"))}`,
      { showButton: true, buttonText: "Open dashboard", buttonLink: "#" }),
  },
  after: {
    subject: "Weekly payout digest — $1,240.00",
    preheader: "8 payments settled this week · up 12% vs last week",
    html: baseEmailTemplate("Your weekly payout digest", `${HEY()}
      ${p("Here's how the last 7 days looked for your business on Dynopay.")}
      ${twoColumnStats(statCard("Settled this week", "$1,240.00", "8 payments · +12%"), statCard("Platform fees", "$18.60", "Starter tier — 1.5%", "green"))}`,
      { showButton: true, buttonText: "Open dashboard", buttonLink: "#", preheader: "8 payments settled this week · up 12% vs last week" }),
  },
});

// 14. Password reset OTP
samples.push({
  slug: "14_password_reset", label: "Password reset OTP",
  note: "Add preheader; 'never share'; sentence-case.",
  before: {
    subject: "Password reset code",
    html: baseEmailTemplate("Reset Your Password", `${HEY()}
      ${p("You requested to reset your Dynopay password. Use this code to continue:")}
      ${otpBlock("204815")}
      ${p("This code expires in 10 minutes. If you didn't request a password reset, please ignore this email and your password will remain unchanged.")}`),
  },
  after: {
    subject: "Your password reset code",
    preheader: "Expires in 10 min · Dynopay will never ask you for this code.",
    html: baseEmailTemplate("Reset your password", `${HEY()}
      ${p("Use this code to reset your Dynopay password:")}
      ${otpBlock("204815")}
      ${p("It expires in <strong>10 minutes</strong>. <strong>Dynopay will never ask you for this code.</strong> Didn't request a reset? Ignore this email — nothing changes.")}`,
      { preheader: "Expires in 10 min · Dynopay will never ask you for this code." }),
  },
});

// 15. Payment link created
samples.push({
  slug: "15_payment_link_created", label: "Payment link created",
  note: "Add preheader; unify subject style.",
  before: {
    subject: "Payment link ready — 100.00 USD",
    html: baseEmailTemplate("Payment Link Created", `${HEY()}
      ${p("Your payment link has been created successfully.")}
      ${tbl(`${dataRow("Amount", "<strong>100.00 USD</strong>")}${dataRow("Expires", "Never")}${dataRow("Link", '<a href="#" style="color:#0a0a0a;">dynopay.com/pay/...aB12xY</a>', true)}`)}
      ${p("Share this link with your customer to receive payment.")}`,
      { showButton: true, buttonText: "Open Payment Link", buttonLink: "#" }),
  },
  after: {
    subject: "Your $100 payment link is ready",
    preheader: "Share it anywhere to get paid in crypto — no expiry set.",
    html: baseEmailTemplate("Payment link ready", `${HEY()}
      ${p("Your payment link is ready to share.")}
      ${tbl(`${dataRow("Amount", "<strong>$100.00 USD</strong>")}${dataRow("Expires", "No expiry")}${dataRow("Link", '<a href="#" style="color:#0a0a0a;">dynopay.com/pay/…aB12xY</a>', true)}`)}
      ${p("Share it anywhere — your customer can pay in any supported coin.")}`,
      { showButton: true, buttonText: "Open payment link", buttonLink: "#", preheader: "Share it anywhere to get paid in crypto — no expiry set." }),
  },
});

// ── German current-state (i18n chrome sanity check) ─────────────────────────
const de: Array<{ slug: string; label: string; subject: string; html: string }> = [];
{
  const L = "de";
  // Payment received (DE)
  de.push({
    slug: "de_02_payment_received", label: "DE — Zahlung erhalten (chrome check)",
    subject: t("paymentReceived.subject", L, { amount: "0.0042", currency: "BTC" }),
    html: baseEmailTemplate(t("paymentReceived.heading", L), `${p(t("common.greeting", L, { name: "Alex" }))}
      ${p(t("paymentReceived.intro", L, { companyName: "Acme Store" }))}
      ${tbl(`${dataRow(t("labels.amount", L), "<strong>0.0042 BTC</strong>")}${dataRow(t("labels.status", L), statusBadge(t("statusLabels.received", L), "success"))}${dataRow(t("labels.transactionId", L), mono("9f2c1e7a"), true)}`)}
      ${p(t("paymentReceived.outro", L))}`,
      { lang: L, showButton: true, buttonText: t("paymentReceived.cta", L), buttonLink: "#", preheader: "Beispiel-Vorschau (Preheader)" }),
  });
  // Login OTP (DE)
  de.push({
    slug: "de_03_login_otp", label: "DE — Login-Code (chrome check)",
    subject: t("merchant.loginOtp.subject", L),
    html: baseEmailTemplate(t("merchant.loginOtp.heading", L), `${p(t("common.greeting", L, { name: "Alex" }))}
      ${p(t("merchant.loginOtp.intro", L))}
      ${otpBlock("482913")}
      ${p(t("merchant.loginOtp.expiry", L))}`, { lang: L, preheader: "Beispiel-Vorschau (Preheader)" }),
  });
  // Customer receipt (DE)
  de.push({
    slug: "de_01_customer_receipt", label: "DE — Zahlungsbestätigung (chrome check)",
    subject: t("customerPaymentConfirmation.subject", L, { companyName: "Acme Store" }),
    html: baseEmailTemplate(t("customerPaymentConfirmation.heading", L), `${p(t("common.greeting", L, { name: "Alex" }))}
      ${p(t("customerPaymentConfirmation.intro", L, { companyName: "Acme Store" }))}
      ${tbl(`${dataRow(t("labels.status", L), statusBadge(t("statusLabels.complete", L), "success"))}${dataRow(t("labels.amountPaid", L), "<strong>261.37 USD</strong>")}${dataRow(t("labels.date", L), "05 June 2026 at 2:31 PM", true)}`)}
      ${p(`<span style="font-size:13px;color:#6b7280;">${t("common.securedBy", L)}</span>`)}`, { lang: L, preheader: "Beispiel-Vorschau (Preheader)" }),
  });
}

// ── Write files ─────────────────────────────────────────────────────────────
for (const s of samples) {
  fs.writeFileSync(path.join(OUT, `${s.slug}.before.html`), s.before.html);
  fs.writeFileSync(path.join(OUT, `${s.slug}.after.html`), s.after.html);
}
for (const d of de) fs.writeFileSync(path.join(OUT, `${d.slug}.html`), d.html);

// ── Gallery index ────────────────────────────────────────────────────────────
const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const cell = (title: string, subject: string, preheader: string | undefined, file: string) => `
  <div class="col">
    <div class="meta"><span class="tag">${title}</span>
      <div class="subj"><b>Subject:</b> ${esc(subject)}</div>
      <div class="pre"><b>Preheader:</b> ${preheader ? esc(preheader) : '<i style="color:#dc2626">— none (leaks first body line) —</i>'}</div>
    </div>
    <iframe src="${file}"></iframe>
  </div>`;

const rows = samples.map((s, i) => `
  <section>
    <h2>${i + 1}. ${esc(s.label)}</h2>
    <p class="note">${esc(s.note)}</p>
    <div class="pair">
      ${cell("BEFORE", s.before.subject, s.before.preheader, `${s.slug}.before.html`)}
      ${cell("AFTER", s.after.subject, s.after.preheader, `${s.slug}.after.html`)}
    </div>
  </section>`).join("");

const deRows = de.map((d) => `
  <div class="col">
    <div class="meta"><span class="tag de">${esc(d.label)}</span>
      <div class="subj"><b>Subject:</b> ${esc(d.subject)}</div>
    </div>
    <iframe src="${d.slug}.html"></iframe>
  </div>`).join("");

const index = `<!doctype html><html><head><meta charset="utf-8"><title>Dynopay Email Audit — Before/After</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;margin:0;background:#f5f5f4;color:#0a0a0a}
  header{background:#050505;color:#fff;padding:22px 28px}
  header h1{margin:0;font-size:20px}header p{margin:6px 0 0;color:#a1a1aa;font-size:13px}
  main{padding:24px 28px;max-width:1400px;margin:0 auto}
  section{background:#fff;border:1px solid #e7e5e4;border-radius:14px;padding:18px 20px;margin:0 0 26px}
  h2{font-size:16px;margin:0 0 4px}.note{color:#6b7280;font-size:13px;margin:0 0 14px}
  .pair,.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}
  .grid3{grid-template-columns:1fr 1fr 1fr}
  .col{display:flex;flex-direction:column}
  .meta{margin-bottom:8px}
  .tag{display:inline-block;font-size:11px;font-weight:800;letter-spacing:.5px;padding:2px 8px;border-radius:6px;background:#eef2ff;color:#4338CA}
  .tag.de{background:#052e16;color:#86efac}
  .subj,.pre{font-size:12px;color:#374151;margin-top:6px;line-height:1.4}
  iframe{width:100%;height:640px;border:1px solid #e5e7eb;border-radius:10px;background:#fff}
</style></head><body>
<header><h1>Dynopay Email Content Audit — Before / After (Part 1)</h1>
<p>Top 15 by impact × frequency · rendered with the real shared template. Analysis only — no source changed, no email sent.</p></header>
<main>${rows}
  <section>
    <h2>i18n chrome sanity check — German (current state)</h2>
    <p class="note">Confirms the shared chrome localizes (greeting "Hallo/Hey", "Beste Grüße,", "Das Dynopay-Team", footer). Preheader shown is a placeholder to prove the slot renders.</p>
    <div class="grid grid3">${deRows}</div>
  </section>
</main></body></html>`;
fs.writeFileSync(path.join(OUT, "index.html"), index);

console.log(`Rendered ${samples.length} before/after pairs + ${de.length} DE samples to ${OUT}/`);
console.log(`Open ${OUT}/index.html`);
