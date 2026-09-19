# SafeDeal — UI/UX audit, improvement programme and usability tests

## What this covers
SafeDeal (safedeal.sh) has six user-facing surfaces plus the emails that carry people between them:

1. Landing
2. Sign-in (email + one-time code)
3. My deals (list)
4. Create a deal
5. Deal page (status, money, actions, cancellation/dispute panel, activity)
6. Wallet (balances, payout addresses, statement, withdrawals)
7. Emails (invite, funded, delivered, released, dispute, code, withdrawal)

Out of scope: the Dynopay admin console (Admin → Escrow) and the Dynopay merchant dashboard. No rebrand — the current look (dark ink hero, indigo accent, amber for "held/attention") stays; this is about clarity, trust and finish.

## How escrow normally works — the yardstick
Established escrow services (Escrow.com, marketplace escrows, freelancer platforms) share a pattern users already expect:

- **Agree → Pay → Deliver → Inspect → Release**, with an explicit *inspection period* and a visible *who-acts-next*.
- A precise **description of what is being delivered and by when** — the single biggest factor in avoiding disputes.
- **Proof of delivery** (tracking number, links, files, notes) attached when the seller marks delivered.
- **Amendments** before money moves (change price/terms, other side re-accepts) rather than cancel-and-recreate.
- **Soft escalation**: "request changes" before "open a dispute"; dispute steps with response deadlines.
- **Receipts / agreement record** both parties can keep.
- **Withdrawal safety**: new payout address cooling-off, clear status tracking with a chain-explorer link.
- **Trust signals**: who holds the money, in what asset, what happens if the other side goes silent.

The audit below scores each page against this.

---

## Page-by-page audit

### 1. Landing
**Works:** clear promise ("Pay when it's delivered / Get paid when it's done"), four-step explainer, plain-words cancellation & dispute policy, fee card with live percentages.

**Pain points**
- The "Example deal" card is hard-coded ($500 → $527.50). If fees or cost estimates change it silently lies.
- No answer to the first-time visitor's real questions: *Who holds my money? What if the seller disappears? What if I get nothing? How do I get paid out?* — no FAQ, no "For buyers / For sellers" split.
- Sign-in says "you agree to the SafeDeal terms" but there is no Terms, Privacy or Help page anywhere on the site. No footer at all.
- No trust strip (custody in USDT by Dynopay, response deadlines, human arbitration).
- One CTA only ("Start a deal"). An invited person who lands here has no obvious "I received an invite" path.

**Improvements**
- Replace the static example with an **interactive mini calculator** (amount + who pays fee → buyer pays / seller receives), driven by the real quote.
- Add **"For buyers" / "For sellers"** columns with 3 promises each, and a **6-question FAQ**.
- Add a **footer**: Terms, Privacy, Fees, Help/contact, "Powered by Dynopay", legal entity line.
- Add a secondary CTA: **"I was invited to a deal"** → sign-in with the invited email pre-filled.
- Publish **Terms of use**, **Privacy** and a short **Help/FAQ** page (content needed from you — see decisions).

### 2. Sign-in
**Works:** password-less, code auto-focus, resend, change email, redirect back to the intended page.

**Pain points**
- An invitee arriving from an email sees a generic sign-in card with no idea *which deal* or *who invited them* — the highest-drop-off moment in any escrow flow.
- Code field is one text box; no paste-friendly digit boxes, no resend cooldown (people click resend 3×), no "wrong email?" hint when the code never arrives.
- No explanation of what "signing in creates your SafeDeal wallet" means (people worry they are opening a financial account).

**Improvements**
- **Invite-aware sign-in**: when the link carries a deal, show a compact card — deal title, amount, who invited you, your role — above the email field, with the email locked to the invited address.
- **6-digit segmented input** with paste support; **30-second resend cooldown** with countdown; "Check spam / try another email" helper after 60 s.
- One-line reassurance: "No bank details, no password — your wallet is only used for this deal's money."

### 3. My deals
**Works:** status chips, "Needs my attention" filter, role filter, per-row "you pay / you get", empty state.

**Pain points**
- Default sort is by last update; deals waiting on *me* are not surfaced first.
- Rows don't show **time pressure** (inspection period ending, invite pending for days, dispute response deadline).
- On mobile the row (icon + title + chips + amount + chevron) crowds and truncates.
- No search; no pagination once a user has 30+ deals.
- Empty state is the same for every filter ("No deals here yet" under "Needs my attention" reads like a bug).

**Improvements**
- Group the list into **"Waiting on you" / "Waiting on them" / "Closed"** with the first group pinned and counted in the nav badge.
- Add a **deadline pill** per row (e.g. "Auto-releases in 2d 4h", "Respond by Fri 14:00", "Invited 5 days ago — resend").
- **Mobile row layout**: title + status on line 1, counterparty + deadline on line 2, amount right-aligned; hide the chevron.
- Search by title/email/#id; "load more" after 25.
- Filter-specific empty states with the right next action.

### 4. Create a deal
**Works:** role choice, fee-payer choice with plain explanations, live itemised quote, auto-release presets, minimum-amount validation, self-invite guard.

**Pain points**
- **No delivery deadline** — every escrow asks "by when?". Without it, "seller is late" has no definition and the auto-release timer is the only clock.
- **Terms are optional and unprompted.** Vague deals are the #1 dispute cause; the field gives no structure.
- **No review step** — one click sends the invite. Users can't see what the other party will receive.
- The live quote is a sticky sidebar on desktop but sits *below the form* on mobile, so mobile users choose a fee payer without seeing the numbers.
- "Auto-release after delivery" is not explained as the **inspection period** — the industry term users search for.
- Deal type isn't captured (service / digital goods / physical item / domain or account handover); it drives sensible defaults (inspection days, proof-of-delivery prompts).

**Improvements**
- Add **Deal type** (4 tiles) → sets default inspection days and delivery-proof hints.
- Add **Delivery due date** (optional but nudged), shown on the deal page and in emails; late deals get a "past due" badge and the buyer a "remind seller" button.
- Turn Terms into a **guided description**: "What will be delivered · How the buyer will check it · Anything excluded" with placeholders and 2–3 templates per deal type.
- Add a **Review & send** step (summary card identical to what the invitee sees) with "Edit" links.
- Rename "Auto-release after delivery" → **"Inspection period"** with the auto-release sentence as helper text.
- **Mobile quote bar**: collapsed sticky bar at the bottom ("Buyer pays $318.30 · Seller gets $300.00 ▸") that expands to the itemised quote.

### 5. Deal page (the core)
**Works:** progress stepper, custody card (held amount, asset), action card with one primary button per state, cancellation and dispute negotiation in a shared panel, activity timeline, terms display, funded/created toasts.

**Pain points**
- **Who-acts-next is implicit.** The status chip says "funded"; the user must infer "seller should deliver". No countdowns for inspection period or dispute response deadline.
- **Marking delivered carries little proof.** Sellers can't attach tracking numbers, links or files; buyers can't see evidence when deciding to release or dispute.
- **No amendments before funding.** Wrong amount or terms → cancel and recreate, re-invite, re-accept.
- **No middle path between "Release" and "Open dispute"**: buyers who are 90 % happy have no "Request changes" that pauses the timer without escalating tone.
- **Pending invite**: no "Resend invite" or copy-link; creators email the link manually.
- **Funding by crypto**: after checkout the page shows funded only when the chain confirms; there is no "Payment detected — waiting for confirmations" state, so buyers refresh and worry.
- **Dispute panel** shows proposals as text; comparing "their offer vs mine" (release / refund / split %) requires reading. The 72-hour auto-escalation is mentioned nowhere on the page.
- **No downloadable record**: no deal agreement / receipt PDF at completion.
- **Counterparty is just an email** — no verified badge, no "N completed deals".
- Long pages on mobile: primary action can be off-screen.

**Improvements**
- **Next-step banner** at the top: "Waiting for **seller** to deliver · due Fri 12 Jun" / "Your inspection period ends in **2d 4h** — release or raise an issue" / "**Buyer** has until Sat 10:00 to respond to your offer". Countdown live.
- **Delivery proof** when marking delivered: note + tracking number/carrier + up to 5 links/files; shown to the buyer in the action card and timeline.
- **Amend before funding**: "Edit deal" (amount, terms, due date, inspection period) → other party re-accepts; changes logged in the activity.
- **"Request changes"** (buyer, after delivery): pauses the inspection timer, sends the seller a note, seller re-marks delivered; no dispute opened.
- **Invite tools**: Resend invite (rate-limited), Copy link, and an "invite expires in X days" line.
- **Payment detected state** for crypto funding: "We've seen your payment · waiting for network confirmation (~10 min)".
- **Dispute panel v2**: side-by-side proposal cards (their offer / your counter) with the money each side ends up with, a response-deadline countdown, and the message thread as chat bubbles with timestamps.
- **Deal record**: at any time "Download deal summary (PDF)" — parties, terms, timeline, money movement, deal #.
- **Counterparty card**: email, "verified" tick, member since, completed deals count.
- **Sticky action bar on mobile** with the primary button.
- Status glossary tooltip on every status chip (what it means, who acts next).

### 6. Wallet
**Works:** available vs held, withdraw with quote and approval note, saved payout addresses with step-up code, auto-withdraw, statement with running balance and CSV, withdrawal list.

**Pain points**
- Balance card doesn't show **"In withdrawal / under review"**, so after a withdrawal the money seems to vanish.
- Withdrawal rows show a truncated hash with **no explorer link** and no expected-arrival time.
- **New payout address can be used immediately** — industry norm is a cooling-off period (or at least a warning) since account takeover + new address is the classic theft path.
- Statement has no filter by type; deal references aren't clickable; amounts aren't tabular so columns wobble.
- Two lines of tiny grey text explain minimums and approval thresholds — the key numbers are easy to miss.

**Improvements**
- Balance card: **Available · Held in escrow · Withdrawing** (three figures), tabular numerals.
- Withdrawal rows: status stepper (Requested → Reviewed → Sent → Confirmed), explorer link, "usually arrives within N minutes".
- **New-address cooling-off**: withdrawals to an address added < 24 h ago are held for review (or blocked) with a clear message at add time. (Decision below.)
- Statement: type filter chips, clickable deal #, running-balance column aligned, month separators.
- Move limits into a small inline **"Limits & fees"** info popover instead of footnotes.

### 7. Emails
**Works (as of this session):** SafeDeal-branded chrome, one clear CTA per email, cancellation and dispute variants, withdrawal sent / review / returned.

**Improvements**
- Add **reminder emails**: invite unanswered 48 h, funding pending 48 h, delivery due tomorrow / overdue, inspection period ends in 24 h, dispute response due in 24 h.
- Add **deal completed receipt** with the PDF summary attached/linked.
- Subject-line consistency: always "Deal #123 · <title> — <event>".

---

## Cross-cutting "crisp display" standards
Applied to every page in the same pass so the product feels finished:

- **Money**: always `$1,200.00`, tabular numerals, right-aligned in tables, green for credits / red for debits / grey for internal moves. Fee lines always itemised the same way (deal amount · escrow fee · network & exchange · buyer pays · seller receives).
- **Dates**: relative for < 7 days ("in 2d 4h", "3 h ago") with the absolute date on hover; absolute otherwise; one format everywhere.
- **Status language**: one verb set — Invite · Accept · Fund · Deliver · Release · Refund · Split · Cancel · Dispute — used identically in buttons, chips, timeline and emails. Human labels for every status (no `awaiting_payment`).
- **Hierarchy**: one H1 per page, 3 text sizes in cards, 2–3× current whitespace between sections; dark ink cards only for money/hero, white cards for everything else.
- **States**: skeletons for every load, specific empty states, inline errors next to the field, success toasts with the next step ("Funded · seller notified").
- **Motion**: subtle entrance on cards, animated progress stepper on status change, countdown ticks; nothing longer than 250 ms.
- **Accessibility**: contrast ≥ 4.5:1 on ink cards (current 55 %-white captions fail), visible focus rings, all icons labelled, keyboard-complete dialogs, Lighthouse accessibility ≥ 90 on every page.
- **Mobile**: every page verified at 360 px; sticky primary action; no horizontal scroll except the statement table.

---

## Delivery batches (what you get, in order)

**Batch 1 — Clarity & trust (highest impact, lowest risk)**
Next-step banner with countdowns · deadline pills in the list · invite-aware sign-in · segmented code input with cooldown · interactive landing calculator · For buyers/For sellers + FAQ · footer with Terms/Privacy/Help pages · status glossary · money/date/status standardisation · mobile sticky action bar and quote bar · a11y fixes.

**Batch 2 — Escrow completeness**
Deal type + delivery due date + guided terms + Review & send · Delivery proof (note, tracking, links, files) · Request changes · Amend before funding (re-accept) · Resend invite / copy link · Payment-detected state · Dispute panel v2 (side-by-side offers, deadline, chat thread).

**Batch 3 — Records & wallet safety**
Deal summary PDF + completion receipt email · Reminder emails · Wallet: withdrawing figure, withdrawal stepper + explorer link, statement filters · New-address cooling-off · Counterparty card (verified, completed deals).

Each batch ships as a whole and is reviewed with you before the next starts.

---

## Usability testing plan

**Who:** 6–8 participants across three profiles — (a) freelancer/seller who gets paid online, (b) buyer of digital goods/services, (c) someone who has never used escrow and receives an invite cold. Recruited from your existing Dynopay merchants/customers plus 2 outsiders.

**Method:** 45-minute moderated remote sessions on the preview site (money simulated), think-aloud, two devices (desktop for creators, phone for invitees). Runs after Batch 1, again after Batch 2.

**Tasks (each timed, success/fail, errors counted)**
1. Landing 5-second test: "What does this service do, and who holds the money?"
2. Create a $300 deal as seller, inviting a buyer, fee paid by buyer.
3. Invitee: open the invite email on a phone, sign in, accept and fund.
4. Seller: mark delivered with proof; buyer: inspect, then release.
5. Buyer: something is wrong — find the right action (request changes vs dispute), propose a 60/40 split; seller counters; settle.
6. Seller: add a payout address and withdraw; explain where the money is now.
7. Comprehension check: "If you do nothing after delivery, what happens and when?" "If the other side stops replying, what happens?"

**Measures:** task success rate (target ≥ 90 % for tasks 2–4, ≥ 75 % for 5), time on task, error/hesitation count, System Usability Scale (target ≥ 80), comprehension answers correct (target ≥ 85 %), plus qualitative quotes per page.

**Also run without participants:** heuristic review against the ten Nielsen heuristics per page, Lighthouse (performance, accessibility, best practices) on all six pages at desktop and 360 px, and an automated end-to-end pass through every flow in both roles.

**Output:** a one-page findings report per round, each issue tagged to a page and severity, folded into the next batch.

---

## Decisions for you
1. **Delivery proof files** — allow file uploads (images/PDF, up to 5 × 10 MB) or links only? Uploads add a storage dependency; links-only is simpler. *Assumed: files + links.*
2. **New payout address cooling-off** — (a) 24-hour hold before withdrawals to a new address, (b) allow immediately but flag for review, (c) no change. *Assumed: (a) 24 h, with the rule stated when the address is added.*
3. **Amendments before funding** — allow editing amount/terms/dates with re-acceptance (assumed yes), or keep cancel-and-recreate.
4. **Terms, Privacy, Help content** — do you supply the legal text, or should first-draft pages be written for your review? *Assumed: first drafts written for your review, clearly marked as drafts.*
5. **Counterparty trust card** — show completed-deals count and "member since" to the other party? Some users prefer privacy. *Assumed: yes, counts only, no names.*
6. **Usability test participants** — you recruit from your user base (preferred) or run with internal testers first?
7. **Batch order** — proceed 1 → 2 → 3 as above, or pull specific items forward?

## Assumptions
- English only; USD display; no new payment rails or fee changes.
- Existing visual identity kept; improvements are structure, copy, states and finish.
- Admin console changes only where a new user-facing feature needs one (e.g. delivery proof visible to arbitrators).
- Money stays simulated on the preview site for testing; production go-live steps are unchanged.
