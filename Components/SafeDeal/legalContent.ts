/**
 * First-draft copy for SafeDeal's Terms, Privacy and Help pages.
 * DRAFT — written for the owner's legal review; the pages show a draft notice
 * until `draft` is set to false here.
 */
export interface LegalSection { h: string; p: string[] }
export interface LegalDoc { slug: "terms" | "privacy" | "help"; title: string; intro: string; updated: string; draft: boolean; sections: LegalSection[] }

const LEGAL_NAME_TOKEN = "{{legal_name}}";

export const TERMS: LegalDoc = {
  slug: "terms",
  title: "Terms of use",
  updated: "June 2026",
  draft: true,
  intro: `SafeDeal is an escrow service${LEGAL_NAME_TOKEN} ("SafeDeal", "we"). By creating, accepting or funding a deal you agree to these terms.`,
  sections: [
    { h: "1. What SafeDeal does", p: ["SafeDeal lets a buyer and a seller agree a price and terms, have the buyer's payment held by SafeDeal, and release it to the seller when the deal is completed. SafeDeal is the escrow agent; it is not a party to the underlying sale and does not guarantee the goods or services themselves.", "Funds are held in the stablecoin USDT and shown to you in US dollars. Payouts are made in USDT or USDC to an address you provide."] },
    { h: "2. Accounts and sign-in", p: ["You sign in with an email address and a one-time code. You are responsible for keeping access to that inbox secure. Anyone who can read your email can act as you on SafeDeal.", "A SafeDeal wallet is created for your email address. It is not a bank account and does not earn interest."] },
    { h: "3. Fees", p: ["Each deal carries an escrow fee shown in the quote before anyone pays (a percentage of the deal amount with a minimum), plus network and exchange costs. The parties choose who pays the fee when the deal is created.", "Fees and costs are charged on release, refund and split, because the work of holding and moving the funds has been done. On a mutually-agreed cancellation after funding a cancellation fee applies, plus the real network and exchange costs; the buyer is refunded the remainder."] },
    { h: "4. The deal lifecycle", p: ["Invite → Accept → Fund → Deliver → Inspection period → Release. The inspection period is chosen when the deal is created. If the buyer takes no action before it ends, the funds release to the seller automatically.", "Either party may cancel for free before the deal is funded. After funding, cancellation requires the other party's agreement; the buyer is refunded minus fees and costs."] },
    { h: "5. Disputes", p: ["A party may raise a dispute while the deal is funded or delivered. The parties first negotiate a resolution (release, refund or a split). A proposal that receives no response within the time shown on the deal page escalates to the SafeDeal team.", "When the SafeDeal team decides a dispute, it does so on the basis of the deal terms, the messages and any evidence in the deal record. Its decision is final within SafeDeal, and it applies the outcome to the held funds."] },
    { h: "6. Prohibited use", p: ["You may not use SafeDeal for anything unlawful, for goods or services that are illegal where either party is located, or to move funds on behalf of someone you do not know. We may pause or refuse a deal, hold a cashout for review, or close a wallet where we suspect fraud, sanctions exposure or abuse."] },
    { h: "7. Cashouts", p: ["Cashouts (withdrawals) are sent to the payout address you saved. Blockchain transfers are irreversible: check the address and network before confirming. Cashouts above a threshold are reviewed before being sent, and we may ask for identity information for large volumes."] },
    { h: "8. Liability", p: ["SafeDeal holds and moves funds as described in these terms. We are not liable for the quality, delivery or legality of what is bought and sold, or for losses caused by a wrong payout address, a compromised inbox, or events outside our control. Our total liability for a deal is limited to the fees we charged on that deal."] },
    { h: "9. Changes and contact", p: ["We may update these terms; the date at the top tells you when. Continuing to use SafeDeal after a change means you accept it. Questions go through the help centre linked in the footer."] },
  ],
};

export const PRIVACY: LegalDoc = {
  slug: "privacy",
  title: "Privacy",
  updated: "June 2026",
  draft: true,
  intro: `This notice explains what SafeDeal${LEGAL_NAME_TOKEN} collects when you use SafeDeal and why.`,
  sections: [
    { h: "What we collect", p: ["Your email address (to sign you in and notify you about deals), the details of the deals you take part in (title, amount, terms, messages, timestamps), your payout addresses, and technical data such as IP address and browser type used for security.", "We do not collect card numbers or bank details. Payments are made in cryptocurrency through SafeDeal's checkout."] },
    { h: "Why we use it", p: ["To run the escrow: sending invites and status emails, holding and releasing funds, resolving disputes and preventing fraud. Deal records are kept because both parties may need them later and because we are required to keep financial records."] },
    { h: "Who sees it", p: ["The other party to a deal sees your email address and everything you put in the deal. The SafeDeal team sees deal records when a dispute is escalated or a cashout is reviewed. We share data with service providers that deliver email and blockchain transactions, and with authorities where the law requires."] },
    { h: "How long we keep it", p: ["Deal and wallet records are kept for as long as we are required to keep financial records after the deal closes. Sign-in codes expire after ten minutes and are deleted."] },
    { h: "Your choices", p: ["You can remove saved payout addresses at any time. To ask for a copy of your data or its deletion (where the law allows), contact us through the help centre."] },
  ],
};

export const HELP: LegalDoc = {
  slug: "help",
  title: "Help centre",
  updated: "June 2026",
  draft: false,
  intro: "Short answers to the questions we get most. Every deal page also shows who acts next and by when.",
  sections: [
    { h: "Getting started", p: ["You don't need an account. Enter your email, type the 6-digit code we send you, and you're in. If you were invited to a deal, open the link in the invite email and sign in with the same address the invite was sent to.", "Didn't get the code? Check spam, wait 30 seconds and press Resend. Codes expire after 10 minutes."] },
    { h: "Creating a deal", p: ["Say what is being delivered, set the price, pick whether you're the buyer or the seller, and invite the other party by email. Choose who covers the fee and how long the buyer's inspection period is. The live quote shows exactly what the buyer pays and the seller receives."] },
    { h: "Funding", p: ["Once both sides have accepted, the buyer pays through SafeDeal's checkout in any supported coin, or from an existing SafeDeal balance. The deal shows Funded as soon as the payment is confirmed on the network and both parties are emailed."] },
    { h: "Delivering and releasing", p: ["The seller marks the deal delivered and can add a note. The buyer's inspection period then runs; the buyer releases the funds, or they release automatically when the period ends. The seller's SafeDeal wallet is credited instantly."] },
    { h: "Problems and disputes", p: ["Before funding: cancel for free. After funding: request a cancellation (the other side must agree) or open a dispute with a proposal — refund, release, or a split. The other side accepts, counters or adds a message. If a proposal gets no answer within the time shown, or either side escalates, the SafeDeal team reviews the deal record and decides."] },
    { h: "Wallet and cashouts", p: ["Available is what you can cash out now; Held in escrow is money locked in open deals. Add a payout address (USDT or USDC on Tron, Ethereum or Polygon) — this needs a fresh email code — then cash out. Most cashouts are sent within minutes; cashouts above the review threshold are checked by our team first and you're emailed either way."] },
    { h: "Contact", p: ["Reply to any SafeDeal email or use the SafeDeal help centre. For anything about a specific deal, include the deal number shown on the deal page."] },
  ],
};

export const LEGAL_DOCS: Record<LegalDoc["slug"], LegalDoc> = { terms: TERMS, privacy: PRIVACY, help: HELP };
/** Operator clause — empty when the operator is just "SafeDeal", else " operated by <legal entity>". */
export const fillLegal = (s: string, legalName: string) => {
  const op = legalName && legalName !== "SafeDeal" ? ` operated by ${legalName.replace(/\.$/, "")}` : "";
  return s.split(LEGAL_NAME_TOKEN).join(op);
};
