# SafeDeal — standalone escrow product powered by Dynopay

## Goal
Move the escrow experience out of the Dynopay merchant dashboard into its own product, **SafeDeal** (safedeal.sh). Dynopay stays the engine underneath: it takes the payment, converts and holds the funds, keeps each user's wallet balance and statement, stores saved payout addresses, and pays out. Escrow users never need a Dynopay account — they are **customers of one Dynopay brand** ("SafeDeal"), so the brand owner manages every user's balance from the Dynopay dashboard like a financial statement.

## What the user sees on safedeal.sh

**Landing page** — what SafeDeal does, how it works (invite → fund → deliver → release), the fee card (5% escrow fee, min $10, min deal $30, who can pay it), the cancellation and dispute policy in plain words, and a single **"Start a deal"** call to action. "Powered by Dynopay" trust line.

**Sign-in** — email + one-time code (no passwords). The first sign-in creates the user (and their customer record + wallet under the SafeDeal brand). The counterparty who opens an invite link goes through the same step and becomes a customer too.

**Create a deal** — title, amount (USD, min $30), my role (buyer/seller), the other party's email, who pays the fee (buyer / seller / split), auto-release window (3/5/7/14 days), optional terms. Live itemised quote (escrow fee, network, conversion, withdrawal). On create: invite email + shareable link/QR.

**Deal page** — progress ladder (Invited → Accepted → Funded → Delivered → Released/Refunded/Split → Paid), amounts card, actions by role (accept/decline, fund, mark delivered, release), the dispute/cancellation panel (propose → accept / counter / message / escalate; auto-escalates to Dynopay after 72h of silence), activity timeline.

**Funding** — the buyer pays through Dynopay's hosted checkout in any accepted coin; or, if they already have an available balance in their SafeDeal wallet (e.g. from a previous refund), they can **pay from balance**.

**My deals** — list with status filters, as buyer and as seller.

**Wallet** — one wallet per user, shown in USD (funds are custodied as USDT):
- Balance split into **Available** and **Held in escrow**.
- **Statement**: every entry with date, deal reference, type and running balance — escrow funding received, hold placed, release received, refund received, escrow fee, network/exchange costs, withdrawal, manual adjustment. Filter by date, export CSV.
- **Saved payout addresses** — stablecoin only: USDT (TRC20, ERC20, Polygon) and USDC (ERC20, Polygon). Adding or changing an address needs a fresh one-time code and sends a "this wasn't me" email alert.
- **Withdraw** — pick a saved address, see the network fee and what arrives, confirm with a one-time code. Optional per-user toggle **"auto-withdraw when funds are released to me"**.

## What the Dynopay brand owner sees (Dynopay dashboard)
- A **SafeDeal brand** (new test brand now; the real one later). Every escrow user appears in that brand's **Customers** list.
- Each customer row shows **wallet balance (available / held)** and opens a **statement** view identical to what the user sees, plus lifetime deal count and volume.
- **Manual adjustment** (credit or debit with a mandatory note, ops only, logged) for corrections and goodwill refunds — appears on the customer's statement as "Adjustment".
- Brand-level totals: total customer balances held, total held in escrow, fees earned, withdrawals paid — reconcilable against the USDT custody balance.
- **Dispute arbitration stays in the Dynopay admin panel** (escalated cases queue, resolve as release / refund / split, thread visible).

## What is removed from Dynopay
The merchant-facing escrow UI: the Escrow nav item, the escrow list/detail pages, the create-deal dialog, and the public `/escrow/invite/...` page. The engine (deal lifecycle, disputes, fees, settlement) remains inside Dynopay and is exposed to SafeDeal. Existing test deals are not migrated.

## Money rules (carried over, unchanged)
- Escrow fee **5%**, floor **$10**; minimum deal **$30**; fee rate is set by Dynopay only.
- Fees and all network/exchange costs are charged on **every** outcome — release, refund, split, agreed cancellation.
- Custody always in **USDT**; payout network chosen by the user at withdrawal.
- **Cancellation**: free before funding (either party, instant). After funding it is a **cancellation request** that the other party must agree to; on agreement the buyer's wallet is credited with the held amount minus fees and costs.
- **Disputes**: raised with a proposal; counter / accept / message / escalate; accepted proposals settle automatically with no admin; 72h of no response auto-escalates to Dynopay.

## Assumptions (change any of these before approving)
1. **SafeDeal is a separate web app** on safedeal.sh built in this workspace and deployed on its own; it talks only to Dynopay's API through a dedicated partner key. Dynopay's own frontend is untouched apart from the removals above.
2. **The deal engine stays in Dynopay** (it is already built and tested) rather than being rebuilt inside SafeDeal.
3. **Sign-in is email + one-time code only** — no passwords, no social login at launch.
4. **Both parties are customers** of the SafeDeal brand; a user is one customer regardless of how many deals or roles they have.
5. **Released and refunded funds land in the wallet balance**; they leave only when the user withdraws (or has auto-withdraw on). This is what makes the statement complete, but it means sellers take one extra step unless they enable auto-withdraw.
6. **Withdrawal safety**: minimum withdrawal $10; single withdrawals above **$1,000** are held for ops approval in Dynopay before they are sent. Everything below goes out immediately.
7. **One currency**: deals and wallets are shown in USD only at launch.
8. In the preview environment money movement stays **simulated** (safe mode); production uses Dynopay's real hosted checkout and Binance settlement.
9. **KYC/limits** for large escrow volumes are out of scope for this build and can be added later.
10. Brand spelling everywhere is **"Dynopay"**; the product name is **"SafeDeal"**.
