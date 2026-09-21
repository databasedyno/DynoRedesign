# SafeDeal — Telegram sign‑in + invitations + landing‑page deal creation

This plan covers three connected changes to SafeDeal:
1. Make Telegram sign‑in work sensibly alongside invitations.
2. Let a person who started with Telegram add an email later and use it to log in.
3. Let people start a deal directly on the SafeDeal landing page.

---

## How it works today (so the changes make sense)

- People sign in to SafeDeal two ways: **email one‑time code**, or **Telegram**.
- A deal has one creator and one **counterparty invited by email address**. When the
  invited person signs in **with that same email**, they are automatically connected to
  the deal and can accept, fund, deliver, etc.
- **Telegram sign‑in is currently a dead end for invitations.** A Telegram account has no
  real email (the system stores a placeholder like `tg12345@telegram.safedeal`). Because
  invitations are matched on the invited email, a Telegram‑only person who was invited by
  email cannot open or act on that deal — they are turned away with a "sign in with the
  invited email" message.
- There is **no screen today to add or change the email** on an account. So a Telegram
  user has no way to receive email invitations or to log in by email.
- Starting a deal happens on a **separate page** (`/safedeal/deals/new`). The landing page
  has a fee calculator and a "Start a deal" button that sends people to that separate page.

---

## Proposed model: how Telegram and invitations fit together

**Email stays the way people are addressed in an invitation. Telegram is just a convenient
way to log in.** Concretely, there will be two clear ways to invite someone:

### A. Invite by email (existing, made to work with Telegram)
- The creator enters the counterparty's email, exactly as today.
- The invited person can now sign in **either by that email or by Telegram** — as long as
  their account carries that email. A Telegram user simply **adds that email to their
  account once** (see change 2); from then on the invite connects automatically and all
  future invitations to that email reach them too.

### B. Invite by shareable link ("send it over Telegram/WhatsApp/anywhere") — new
- The creator can create a deal **without typing an email**, getting a **shareable invite
  link** instead. They send that link to the other person through any channel (Telegram
  chat, WhatsApp, etc.).
- The first person who opens the link and signs in (Telegram **or** email) **claims the
  counterparty seat** on that deal. The creator sees who claimed it (their name / masked
  email) before any money is funded.
- This is what makes "Telegram invitations" actually work for people who only use Telegram
  and have no email to be addressed by.

> Note: a shareable link is a **bearer link** — whoever holds it can claim the seat. This is
> the same trust model the current email link already uses. Mitigation: the creator can see
> the claimant before funding, and can regenerate/cancel the link if the wrong person claims
> it. (See decision 2.)

---

## Change 1 — Telegram sign‑in works alongside invitations
Outcome: a Telegram user is no longer a dead end. Once they have an email on their account
(change 2) email invitations connect to them automatically, and they can also participate in
shareable‑link deals (model B) without any email at all.

## Change 2 — Add an email to a Telegram account and log in with it
- A signed‑in user (typically one who joined via Telegram) can **add an email** to their
  account from a profile/settings screen.
- Adding it requires a **one‑time code sent to that email** to prove ownership.
- After it's verified: the account's real email is set, any **pending email invitations to
  that address are connected**, and the person can afterwards **log in by email** as well as
  by Telegram — both routes reach the same account, wallet and deals.
- **Collision handling** (decision 1): if that email is already used by another SafeDeal
  account, the default is to **stop and ask them to log in with that email instead**, rather
  than merging two accounts (merging balances/deals is risky on live money).

## Change 3 — Start a deal on the landing page
- The SafeDeal landing page gets an **inline "start a deal" form** (title, amount, and either
  the counterparty email **or** "invite by link"), so people can begin a deal without first
  navigating to a separate page.
- If the person isn't signed in yet, their entries are **kept** while they sign in (Telegram
  or email), and the deal is created right after — nothing is retyped.
- The separate `/safedeal/deals/new` page is kept as the fuller form (for extra options like
  terms, due date, fee payer, currency); the landing form is the fast start (decision 4).

---

## Decisions to confirm

1. **Email collision when adding an email to a Telegram account** — default: **block** and
   tell them to sign in with that email (no automatic account merge). Alternative: attempt to
   merge the two accounts (more convenient, but riskier because it moves wallet balance and
   deal history).

2. **Shareable "invite by link" deals** — default: **include them** (this is what enables true
   Telegram invitations). They are bearer links; the creator sees who claimed the seat before
   funding and can cancel/regenerate. If you'd rather not have bearer links at all, we can keep
   invitations email‑only and rely solely on "add email" (change 2) to make Telegram work.

3. **Which landing page** — default: the **SafeDeal landing page** (`/safedeal`). Confirm this
   is the page you mean by "first landing page" (as opposed to the top‑level Dynopay homepage).

4. **Keep the separate full new‑deal page** — default: **yes**, as the advanced form, with the
   landing form as the quick start. Alternative: fold everything into the landing form only.

## Out of scope (unless you ask)
- Sending invitations as **Telegram bot messages** to the other person (the bot can only
  message people who have already started it, and the creator rarely knows the other person's
  Telegram ID). "Telegram invitations" here means the shareable link sent over Telegram, not a
  bot DM.
- Changing how funding, payouts, fees, disputes or the wallet work.
