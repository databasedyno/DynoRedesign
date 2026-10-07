# DigitalOcean Cost Report — Dynopay
_Prepared 2026-10-07. Data pulled live from the DigitalOcean API (read-only token, in-shell only) + the codebase._

## TL;DR (this corrects the earlier assumption)
- The earlier theory was "high **outbound bandwidth to Railway** proxies is driving the DO bill." **DO telemetry does not support this.** The Dynopay droplet's monitoring agent is active and reports **~0–1 B/s in every direction** (inbound/outbound, public/private) over the sampled window — i.e. the droplet is **low-traffic**, nowhere near its transfer allowance. **Bandwidth overage = $0.**
- The DO bill is driven by **flat-rate droplets**, and **3 of the 4 droplets are NOT Dynopay.**
- Your "daily cost went up" because **two new droplets were created on Sep 27–28** (`rdp-e92d1b57`, `nomadly-prod-ams3`). September only billed them for a few days; **October is the first full month** → the bill steps up to **~$116 in droplets** (+ ~$5 Spaces).
- **Dynopay's real DO footprint is only ~$33/mo** (`dynopay-prod-ams3` $28 + DO Spaces/CDN ~$5). The other ~$88/mo belongs to unrelated projects.

## What's on the account
| Resource | Project | Size | $/mo | Transfer | Created |
|---|---|---|---|---|---|
| `whm2-fra1-20260617-1601` | cPanel/WHM (not Dynopay) | s-2vcpu-4gb (fra1) | **$32** | 4 TB | 2026-06-17 |
| `dynopay-prod-ams3` | **Dynopay** ✅ | s-2vcpu-4gb-amd (ams3) | **$28** | 4 TB | 2026-09-10 |
| `rdp-e92d1b57` | Remote-desktop box (not Dynopay) | s-2vcpu-4gb-amd | **$28** | 4 TB | **2026-09-27** |
| `nomadly-prod-ams3` | Nomadly (not Dynopay) | s-2vcpu-4gb-amd | **$28** | 4 TB | **2026-09-28** |
| DO Spaces + CDN | **Dynopay** (`dynopay-uploads-…ams3`) | object storage | **~$5** base | 1 TB CDN incl. | — |
| Reserved IP `129.212.213.147` | attached to Dynopay droplet | — | **$0** (attached) | — | — |
| Managed DBs | — | **none** | $0 | — | — |

**Droplet subtotal (full month): $116/mo.** Volumes/snapshots/load-balancers: none.

## Billing trend
- Jul invoice **$72.33** → Aug **$76.20** → Sep **$85.94** → **Oct month-to-date $37.35** (7 days ≈ $5.3/day).
- Account balance: $5.00 credit; MTD usage $37.35.
- The step from ~$76 to ~$116+/mo is explained entirely by the **two droplets added Sep 27–28**, not by Dynopay traffic.

## Where Dynopay actually runs (verified)
- `dynopay.com` and `checkout.dynopay.com` resolve to **134.209.94.115** = the `dynopay-prod-ams3` droplet. So prod **is** on DO (ams3).
- DB + Redis are **off DO, on Railway** over public proxies (`roundhouse.proxy.rlwy.net:23599`, `nozomi.proxy.rlwy.net:15794`). There are **zero DO Managed Databases**.
- DB connection layer is already healthy: Sequelize pool `max 20 / min 5`, `keepAlive` on, SSL, retry logic (`utils/dbInstance.ts`). The persistent warm pool is what produces the tiny ~1 B/s idle keepalive traffic — **not** a chattiness/handshake problem.

## Why the "Railway egress" matters (and why it's NOT a DO cost)
- DO bills **outbound** traffic only, and all four droplets **pool 16 TB/mo** of included transfer. At current volume you're using a rounding error of that → **$0 bandwidth**.
- The DO→Railway hop is real, but its cost shows up on the **Railway** bill (Railway charges egress when query **results** leave their network to your droplet) and as **latency** (every query crosses the public internet between ams3 and Railway's region). It is a performance/Railway-cost issue, not a DO-cost issue.

## Recommendations (ordered by $ impact)
1. **Audit droplet ownership — biggest lever (~$88/mo).** Confirm whether `whm2-fra1`, `rdp-e92d1b57`, and `nomadly-prod-ams3` are still needed. If any are leftovers, destroying them is the fastest saving. (These look like separate projects, so this is your call — I won't touch them.)
2. **Expect October ≈ $116 droplets + ~$5 Spaces ≈ $120–125.** This is the new normal with 4 droplets, not an anomaly.
3. **Stop chasing bandwidth.** There's no egress overage to optimize on DO. The earlier "reduce outbound to Railway to cut the DO bill" goal is moot.
4. **Right-size Dynopay's droplet (save up to ~$14/mo).** `dynopay-prod-ams3` is `s-2vcpu-4gb` ($28). If CPU/RAM headroom is large (check `htop`/DO graphs first — crypto libs can be RAM-hungry), downsize to `s-1vcpu-2gb` ($14). Low risk at current traffic.
5. **Cut latency + the Railway bill (optional, architecture):** co-locate data with the app. Either (a) move Postgres+Redis to **DO Managed DB/Valkey in ams3, same VPC** → app↔DB becomes **private networking (free + fast)**, ~+$30/mo on DO but removes Railway DB spend and the internet hop; or (b) move the **app to Railway** too and drop the $28 DO droplet. **Note:** cross-provider **DO↔Railway VPC peering is not possible** — peering only works inside one provider, so "co-locate" is the real fix.
6. **Turn on guardrails:** set a DO **billing alert/budget**, and review **Spaces** usage (storage GB + CDN transfer) in the portal — it's the only usage-based line Dynopay has.

## Caveats
- Bandwidth numbers are from DO's own monitoring agent (installed & active). If you believe a specific spike occurred, confirm on-droplet with `vnstat -d` / `nethogs`; but DO bills on its own metering, which currently shows the pool essentially unused.
- Spaces/CDN usage isn't itemised in the main API — check the DO billing portal for the exact Spaces line.
- I did not stop/resize/destroy anything. All actions above need your confirmation (and several droplets aren't Dynopay).
