# Brevo account migration — DNS checklist (NEW account)

- OLD account: expressdrop247@gmail.com (Moxx Technologies LLC) — sendLimit credits = 0 (exhausted, cycle Sep 7 → Oct 7)
- NEW account: moxxcompany@gmail.com (Dynopay) — sendLimit credits = 5000 (cycle Sep 30 → Oct 30)
- Account brevo-code (TXT @, same for every domain): `brevo-code:4831905d430c357fb51d82f6ddb0d1d3`
- DMARC (TXT _dmarc, same value): `v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com`
- Tool: `backend/scripts/brevo_migrate.ts` (report | credits | apply [domains|senders] | dns [domain] | authenticate <domain|all>)
- Cloudflare note: DKIM CNAMEs must be **DNS-only (grey cloud, proxied=false)**.

All 10 domains created in the NEW account (2026). Records still "pending" must be added at Cloudflare.
Each domain needs 3 records (DKIM1, DKIM2, brevo-code). DMARC already VERIFIED on 8 domains; only
priv.host + cloakhost.ru also need the DMARC TXT.

| Domain | DKIM1 CNAME (host `brevo1._domainkey`) | DKIM2 CNAME (host `brevo2._domainkey`) | brevo-code TXT @ | DMARC needed? |
|---|---|---|---|---|
| dynopay.com  | b1.dynopay-com.dkim.brevo.com   | b2.dynopay-com.dkim.brevo.com   | yes | already verified |
| safedeal.sh  | b1.safedeal-sh.dkim.brevo.com   | b2.safedeal-sh.dkim.brevo.com   | yes | already verified |
| dynocash.com | b1.dynocash-com.dkim.brevo.com  | b2.dynocash-com.dkim.brevo.com  | yes | already verified |
| lockbay.io   | b1.lockbay-io.dkim.brevo.com    | b2.lockbay-io.dkim.brevo.com    | yes | already verified |
| movely.pt    | b1.movely-pt.dkim.brevo.com     | b2.movely-pt.dkim.brevo.com     | yes | already verified |
| bozzmail.com | b1.bozzmail-com.dkim.brevo.com  | b2.bozzmail-com.dkim.brevo.com  | yes | already verified |
| nameword.com | b1.nameword-com.dkim.brevo.com  | b2.nameword-com.dkim.brevo.com  | yes | already verified |
| hostbay.io   | b1.hostbay-io.dkim.brevo.com    | b2.hostbay-io.dkim.brevo.com    | yes | already verified |
| priv.host    | b1.priv-host.dkim.brevo.com     | b2.priv-host.dkim.brevo.com     | yes | **YES (add DMARC)** |
| cloakhost.ru | b1.cloakhost-ru.dkim.brevo.com  | b2.cloakhost-ru.dkim.brevo.com  | yes | **YES (add DMARC)** |

Senders to create AFTER domains authenticate (auto-verify then): hi@dynopay.com, hi@safedeal.sh,
hi@lockbay.io, hello@movely.pt, privacy@hostbay.io, hosting@hostbay.io, hi@nameword.com.

Cutover after authenticate: set BREVO_API_KEY to the new key in backend/.env, re-seal vault
(`bash scripts/env-vault.sh seal '<pass>'`), and update production (droplet /opt/dynopay/.env) + redeploy.
