// Canned quick-replies for the admin Support Inbox. Tailored to Dynopay
// (non-custodial crypto payment gateway) so agents can answer the most common
// questions — including the "where are my funds?" case (support session
// df0936d9) — in one tap. Clicking one loads it into the composer to edit/send.
export interface CannedReply {
  id: string;
  label: string;
  text: string;
}

export const CANNED_REPLIES: CannedReply[] = [
  {
    id: "greeting",
    label: "Greeting",
    text: "Hi, this is the Dynopay support team — I've taken over from our assistant and I'm looking into your question now.",
  },
  {
    id: "awaiting-payment",
    label: "No deposit detected",
    text: "I checked our records and we haven't detected an on-chain deposit for this payment yet, so nothing has been sent to your wallet. Dynopay is non-custodial — funds settle directly to your connected address once the customer's payment is confirmed on-chain. If you believe funds were sent, please share the blockchain transaction hash (TxID) and the exact address they were sent to, and we'll trace it right away.",
  },
  {
    id: "non-custodial-balance",
    label: "Non-custodial balance",
    text: "Dynopay is non-custodial, so direct payments settle straight to your connected wallet and don't build up a withdrawable balance inside the dashboard. A $0 available balance is normal for direct settlements — please check the wallet address saved for that coin/network.",
  },
  {
    id: "wrong-network",
    label: "Check coin/network",
    text: "Please make sure you're viewing the correct coin on the correct network in your wallet (for example USDT on Ethereum/ERC-20, not TRON/TRC-20). Sending or viewing on the wrong network is a common reason funds appear missing.",
  },
  {
    id: "kyc-review",
    label: "KYC in review",
    text: "Thanks for your patience — your verification is currently being reviewed by our team. We'll email you as soon as it's approved, and you can keep testing payments in the meantime.",
  },
  {
    id: "closing",
    label: "Anything else?",
    text: "Is there anything else I can help you with? If not, I'll go ahead and close this chat — you can reopen it anytime and we'll be right here.",
  },
];
