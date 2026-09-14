/**
 * RBAC owner-only lockdown (payout-wallet + delete/revoke API key) — REVERSIBLE.
 * Proves requireCompanyOwnerBy + the api-key/wallet company resolvers ALLOW the
 * company owner and BLOCK a non-owner (even a member with manage_api_keys), and
 * are a no-op when the company can't be resolved. Self-cleaning scratch member.
 *
 *   cd /app/backend && env TS_NODE_TRANSPILE_ONLY=1 DOTENV_CONFIG_PATH=/app/backend/.env \
 *     node -r dotenv/config -r ts-node/register scripts/verify_rbac_owneronly.ts
 */
import { requireCompanyOwnerBy } from "../middleware/teamPermissionMiddleware";
import { apiModel, userWalletModel, teamMemberModel, userModel, companyModel } from "../models";
import { hashPassword } from "../helper/passwordHelper";

/* eslint-disable @typescript-eslint/no-explicit-any */
const SENTINEL = `dyno-rbac-owner+${Date.now()}@example.com`;

const mkReq = (params: any = {}, body: any = {}): any => ({ params, body, query: {}, headers: {} });
const mkRes = (user: any): any => {
  const r: any = { locals: { user }, statusCode: null };
  r.status = (c: number) => { r.statusCode = c; return r; };
  r.json = () => r;
  return r;
};
type Resolver = (req: any, res: any) => Promise<number | null>;
async function runGuard(user: any, resolver: Resolver, req: any) {
  const res = mkRes(user);
  let nexted = false;
  await requireCompanyOwnerBy(resolver)(req, res, () => { nexted = true; });
  return { passed: nexted, status: res.statusCode as number | null };
}

// Mirror the resolvers defined in routes/apiRouter.ts and routes/walletRouter.ts.
const apiResolver: Resolver = async (req) => {
  const apiId = req.params?.id;
  if (!apiId) return null;
  const row: any = await apiModel.findOne({ where: { api_id: apiId } });
  return row ? Number(row.dataValues.company_id) : null;
};
const walletResolver: Resolver = async (req) => {
  const bodyCompany = parseInt(String(req.body?.company_id ?? ""), 10);
  if (!Number.isNaN(bodyCompany)) return bodyCompany;
  const wid = parseInt(String(req.params?.id ?? req.body?.wallet_id ?? ""), 10);
  if (Number.isNaN(wid)) return null;
  const w: any = await userWalletModel.findOne({ where: { wallet_id: wid } });
  return w ? Number(w.dataValues.company_id) : null;
};

let checks = 0, passed = 0;
const assert = (name: string, cond: boolean, detail: string) => {
  checks++;
  if (cond) { passed++; console.log(`PASS ${name} — ${detail}`); }
  else console.log(`FAIL ${name} — ${detail}`);
};

async function main() {
  let scratchUserId: number | null = null;
  let membershipId: number | null = null;
  try {
    // Pick a real API key + wallet belonging to a company owned by user 1.
    const key: any = await apiModel.findOne({ where: { company_id: [1, 71] as any } });
    const wal: any = await userWalletModel.findOne({ where: { company_id: [1, 71] as any } });
    if (!key || !wal) { console.log("SKIP: could not find a key+wallet for company 1/71"); }
    const keyCompany = key ? Number(key.dataValues.company_id) : 1;
    const walCompany = wal ? Number(wal.dataValues.company_id) : 1;
    const owner = await companyModel.findOne({ where: { company_id: keyCompany } });
    const ownerId = Number((owner as any).dataValues.user_id);
    console.log(`setup: api_id=${key?.dataValues.api_id} keyCompany=${keyCompany} wallet_id=${wal?.dataValues.wallet_id} walCompany=${walCompany} ownerId=${ownerId}`);

    // Scratch member on the KEY's company, deliberately over-privileged (manage_api_keys).
    const u: any = await userModel.create({
      name: "RBAC Owner Scratch", email: SENTINEL,
      password: hashPassword("StrongPass123!"), email_verified: true,
      referral_code: `OW${Date.now().toString(36).toUpperCase()}`, login_type: "EMAIL",
    });
    scratchUserId = Number(u.dataValues.user_id);
    const m: any = await teamMemberModel.create({
      company_id: keyCompany, invited_email: SENTINEL, role: "admin",
      permissions: { manage_api_keys: true, manage_company_settings: true, view_dashboard: true },
      status: "active", invited_by_user_id: ownerId, member_user_id: scratchUserId, accepted_at: new Date(),
    });
    membershipId = Number(m.dataValues.id);

    const ownerU = { user_id: ownerId };
    const member = { user_id: scratchUserId };

    if (key) {
      const req = mkReq({ id: key.dataValues.api_id });
      const o = await runGuard(ownerU, apiResolver, req);
      assert("OWNER can delete/revoke API key", o.passed, `status=${o.status}`);
      const mm = await runGuard(member, apiResolver, mkReq({ id: key.dataValues.api_id }));
      assert("MEMBER (manage_api_keys) BLOCKED from delete/revoke key (403)", !mm.passed && mm.status === 403, `status=${mm.status}`);
    }
    if (wal) {
      const req = mkReq({ id: wal.dataValues.wallet_id });
      const o = await runGuard(ownerU, walletResolver, req);
      assert("OWNER can change payout wallet (by wallet_id)", o.passed, `status=${o.status}`);
      const mm = await runGuard(member, walletResolver, mkReq({ id: wal.dataValues.wallet_id }));
      assert("MEMBER BLOCKED from payout-wallet change (403)", !mm.passed && mm.status === 403, `status=${mm.status}`);
      // body.company_id path (addWalletAddress)
      const ob = await runGuard(ownerU, walletResolver, mkReq({}, { company_id: walCompany }));
      assert("OWNER passes addWallet (body.company_id)", ob.passed, `status=${ob.status}`);
      const mb = await runGuard(member, walletResolver, mkReq({}, { company_id: walCompany }));
      assert("MEMBER BLOCKED addWallet (body.company_id) (403)", !mb.passed && mb.status === 403, `status=${mb.status}`);
    }

    // Unresolvable -> no-op (must NOT block, so owner flows with odd payloads never break).
    const noop = await runGuard(member, walletResolver, mkReq({}, {}));
    assert("Unresolved company -> guard is a NO-OP (defers to controller)", noop.passed, `status=${noop.status}`);
  } finally {
    if (membershipId) await teamMemberModel.destroy({ where: { id: membershipId } });
    if (scratchUserId) await userModel.destroy({ where: { user_id: scratchUserId } });
    const memLeft = await teamMemberModel.count({ where: { invited_email: SENTINEL } });
    const userLeft = await userModel.count({ where: { email: SENTINEL } });
    console.log(`CLEANUP: scratch_membership_left=${memLeft} scratch_user_left=${userLeft}`);
    console.log(`=== RESULT: ${passed}/${checks} checks passed ===`);
    process.exit(passed === checks && memLeft === 0 && userLeft === 0 ? 0 : 1);
  }
}
main().catch((e) => { console.error("HARNESS ERROR", e); process.exit(1); });
