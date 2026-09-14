/**
 * RBAC Phase 3 — member access enforcement verification (REVERSIBLE, self-cleaning).
 *
 * Creates ONE scratch member user + an ACTIVE limited membership on company 1
 * (view_dashboard ONLY), drives the REAL middleware chain
 * (companyOwnershipMiddleware -> requirePermission / requireCompanyOwner) plus the
 * getCompany controller, asserts owner-vs-member gating, then deletes everything.
 * Sentinel email dyno-rbac-p3+<ts>@example.com so it can never collide with real data.
 *
 * Run:
 *   cd /app/backend && env TS_NODE_TRANSPILE_ONLY=1 DOTENV_CONFIG_PATH=/app/backend/.env \
 *     node -r dotenv/config -r ts-node/register scripts/verify_rbac_phase3.ts
 */
import jwt from "jsonwebtoken";
import { teamMemberModel, userModel } from "../models";
import { companyOwnershipMiddleware } from "../middleware/authMiddleware";
import { requirePermission, requireCompanyOwner } from "../middleware/teamPermissionMiddleware";
import companyController from "../controller/companyController";
import { hashPassword } from "../helper/passwordHelper";

const SENTINEL = `dyno-rbac-p3+${Date.now()}@example.com`;
const COMPANY_ID = 1;
const OTHER_COMPANY_ID = 71; // owned by user 1, member is NOT granted this one

/* eslint-disable @typescript-eslint/no-explicit-any */
const mkReq = (companyId: number): any => ({
  params: { id: String(companyId) },
  body: {},
  query: {},
  headers: {},
});
const mkRes = (user: any, token?: string): any => {
  const r: any = { locals: { user, token }, statusCode: null, body: null };
  r.status = (c: number) => { r.statusCode = c; return r; };
  r.json = (b: any) => { r.body = b; return r; };
  return r;
};

type Gate = (req: any, res: any, next: any) => any;
async function runChain(user: any, companyId: number, gate?: Gate) {
  const req = mkReq(companyId);
  const res = mkRes(user);
  let ok1 = false;
  await companyOwnershipMiddleware(req, res, () => { ok1 = true; });
  if (!ok1) return { passed: false, status: res.statusCode as number, stage: "ownership" };
  if (!gate) return { passed: true, status: 200, stage: "ownership" };
  let ok2 = false;
  await gate(req, res, () => { ok2 = true; });
  return { passed: ok2, status: ok2 ? 200 : (res.statusCode as number), stage: "gate" };
}

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
    const u: any = await userModel.create({
      name: "RBAC P3 Scratch",
      email: SENTINEL,
      password: hashPassword("StrongPass123!"),
      email_verified: true,
      referral_code: `P3${Date.now().toString(36).toUpperCase()}`,
      login_type: "EMAIL",
    });
    scratchUserId = Number(u.dataValues.user_id);
    const m: any = await teamMemberModel.create({
      company_id: COMPANY_ID,
      invited_email: SENTINEL,
      role: "member",
      permissions: { view_dashboard: true }, // NO view_transactions / manage_company_settings
      status: "active",
      invited_by_user_id: 1,
      member_user_id: scratchUserId,
      accepted_at: new Date(),
    });
    membershipId = Number(m.dataValues.id);
    console.log(`setup: scratchUserId=${scratchUserId} membershipId=${membershipId} email=${SENTINEL}`);

    const member = { user_id: scratchUserId };
    const owner = { user_id: 1 };

    // MEMBER — allowed on granted perm, blocked on ungranted + owner-only
    const r1 = await runChain(member, COMPANY_ID, requirePermission("view_dashboard"));
    assert("member view_dashboard ALLOWED", r1.passed, `status=${r1.status}`);

    const r2 = await runChain(member, COMPANY_ID, requirePermission("view_transactions"));
    assert("member view_transactions BLOCKED (403)", !r2.passed && r2.status === 403, `status=${r2.status}`);

    const r3 = await runChain(member, COMPANY_ID, requirePermission("manage_company_settings"));
    assert("member manage_company_settings BLOCKED (403)", !r3.passed && r3.status === 403, `status=${r3.status}`);

    const r4 = await runChain(member, COMPANY_ID, requireCompanyOwner);
    assert("member requireCompanyOwner BLOCKED (403)", !r4.passed && r4.status === 403, `status=${r4.status}`);

    const r5 = await runChain(member, OTHER_COMPANY_ID, requirePermission("view_dashboard"));
    assert("member no-access to company 71 BLOCKED (403)", !r5.passed && r5.status === 403, `status=${r5.status} stage=${r5.stage}`);

    // OWNER — passes every gate (no regression)
    const o1 = await runChain(owner, COMPANY_ID, requirePermission("view_transactions"));
    assert("owner view_transactions ALLOWED", o1.passed, `status=${o1.status}`);
    const o2 = await runChain(owner, COMPANY_ID, requireCompanyOwner);
    assert("owner requireCompanyOwner ALLOWED", o2.passed, `status=${o2.status}`);
    const o3 = await runChain(owner, COMPANY_ID, requirePermission("manage_company_settings"));
    assert("owner manage_company_settings ALLOWED", o3.passed, `status=${o3.status}`);

    // getCompany — member sees the granted company flagged; owner unchanged
    const mres = mkRes(member, jwt.sign({ user_id: scratchUserId, email: SENTINEL }, "harness"));
    await companyController.getCompany(mkReq(COMPANY_ID), mres);
    const mlist: any[] = (mres.body && mres.body.data) || [];
    const c1 = mlist.find((c) => Number(c.company_id) === COMPANY_ID);
    assert("getCompany(member) includes company 1", !!c1, `count=${mlist.length}`);
    assert("company 1 flagged is_member=true role=member", !!c1 && c1.is_member === true && c1.member_role === "member",
      `is_member=${c1?.is_member} role=${c1?.member_role}`);
    assert("getCompany(member) does NOT include un-granted company 71", !mlist.some((c) => Number(c.company_id) === OTHER_COMPANY_ID),
      `ids=${mlist.map((c) => c.company_id).join(",")}`);

    const ores = mkRes(owner, jwt.sign({ user_id: 1, email: "owner@x" }, "harness"));
    await companyController.getCompany(mkReq(COMPANY_ID), ores);
    const olist: any[] = (ores.body && ores.body.data) || [];
    assert("getCompany(owner) all is_member=false", olist.length >= 1 && olist.every((c) => c.is_member === false),
      `count=${olist.length}`);
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
