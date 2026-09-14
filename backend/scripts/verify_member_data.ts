/**
 * Member DATA-access verification (REVERSIBLE): a granted team member must see the
 * OWNER's dashboard + transactions for the granted company (not their own empty
 * data), and must be blocked from a company they are NOT a member of.
 * Drives the REAL dashboardController.getDashboard + wallet getAllTransactions.
 *
 *   cd /app/backend && env TS_NODE_TRANSPILE_ONLY=1 DOTENV_CONFIG_PATH=/app/backend/.env \
 *     node -r dotenv/config -r ts-node/register scripts/verify_member_data.ts
 */
import jwt from "jsonwebtoken";
import dashboardController from "../controller/dashboardController";
import { getAllTransactions } from "../controller/wallet/transactionsList";
import { teamMemberModel, userModel } from "../models";
import { hashPassword } from "../helper/passwordHelper";

const SENTINEL = `dyno-rbac-data+${Date.now()}@example.com`;
const GRANTED = 1;      // company owned by user 1
const NOT_GRANTED = 71; // also owned by user 1, member NOT invited

/* eslint-disable @typescript-eslint/no-explicit-any */
const mkReq = (query: any = {}, body: any = {}): any => ({ query, body, params: {}, headers: {} });
function mkRes(userId: number): any {
  const r: any = {
    locals: { token: jwt.sign({ user_id: userId, email: `u${userId}@x` }, "harness"), user: { user_id: userId } },
    statusCode: 200, body: null,
    status(c: number) { r.statusCode = c; return r; },
    json(b: any) { r.body = b; return r; },
  };
  return r;
}
const txCount = (body: any): number => {
  const d = body?.data ?? {};
  return Number(d?.stats?.totalTransactions ?? d?.totalTransactions ?? d?.stats?.transactions ?? 0);
};

let checks = 0, passed = 0;
const assert = (n: string, c: boolean, d: string) => { checks++; if (c) { passed++; console.log(`PASS ${n} — ${d}`); } else console.log(`FAIL ${n} — ${d}`); };

async function main() {
  let scratchUserId: number | null = null;
  let membershipId: number | null = null;
  try {
    const u: any = await userModel.create({
      name: "RBAC Data Scratch", email: SENTINEL, password: hashPassword("StrongPass123!"),
      email_verified: true, referral_code: `DA${Date.now().toString(36).toUpperCase()}`, login_type: "EMAIL",
    });
    scratchUserId = Number(u.dataValues.user_id);
    const m: any = await teamMemberModel.create({
      company_id: GRANTED, invited_email: SENTINEL, role: "member",
      permissions: { view_dashboard: true, view_transactions: true },
      status: "active", invited_by_user_id: 1, member_user_id: scratchUserId, accepted_at: new Date(),
    });
    membershipId = Number(m.dataValues.id);
    console.log(`setup: scratchUserId=${scratchUserId} membershipId=${membershipId}`);

    // OWNER baseline for the granted company
    const ownerRes = mkRes(1);
    await dashboardController.getDashboard(mkReq({ company_id: String(GRANTED) }), ownerRes);
    const ownerTx = txCount(ownerRes.body);
    console.log(`owner dashboard totalTransactions(company ${GRANTED}) = ${ownerTx} status=${ownerRes.statusCode}`);

    // MEMBER should see the SAME (owner's) data for the granted company
    const memRes = mkRes(scratchUserId);
    await dashboardController.getDashboard(mkReq({ company_id: String(GRANTED) }), memRes);
    const memTx = txCount(memRes.body);
    assert("member dashboard sees owner data (>0)", memRes.statusCode === 200 && memTx > 0, `memberTx=${memTx} status=${memRes.statusCode}`);
    assert("member dashboard == owner dashboard count", memTx === ownerTx, `owner=${ownerTx} member=${memTx}`);

    // MEMBER transactions list for the granted company
    const ownerTxRes = mkRes(1);
    await getAllTransactions(mkReq({}, { company_id: GRANTED, rowsPerPage: 5, page: 0 }), ownerTxRes);
    const ownerTxRows = Number(ownerTxRes.body?.data?.pagination?.total ?? ownerTxRes.body?.pagination?.total ?? (ownerTxRes.body?.data?.transactions?.length ?? ownerTxRes.body?.data?.length ?? 0));
    const memTxRes = mkRes(scratchUserId);
    await getAllTransactions(mkReq({}, { company_id: GRANTED, rowsPerPage: 5, page: 0 }), memTxRes);
    const memTxRows = Number(memTxRes.body?.data?.pagination?.total ?? memTxRes.body?.pagination?.total ?? (memTxRes.body?.data?.transactions?.length ?? memTxRes.body?.data?.length ?? 0));
    assert("member transactions list non-empty for granted company", memTxRes.statusCode === 200 && memTxRows > 0, `memberRows=${memTxRows} ownerRows=${ownerTxRows} status=${memTxRes.statusCode}`);

    // MEMBER must be BLOCKED (403) from a company they are NOT a member of
    const blockRes = mkRes(scratchUserId);
    await dashboardController.getDashboard(mkReq({ company_id: String(NOT_GRANTED) }), blockRes);
    assert("member blocked from non-granted company (403)", blockRes.statusCode === 403, `status=${blockRes.statusCode}`);

    const blockTxRes = mkRes(scratchUserId);
    await getAllTransactions(mkReq({}, { company_id: NOT_GRANTED, rowsPerPage: 5, page: 0 }), blockTxRes);
    assert("member transactions blocked for non-granted company (403)", blockTxRes.statusCode === 403, `status=${blockTxRes.statusCode}`);
  } finally {
    if (membershipId) await teamMemberModel.destroy({ where: { id: membershipId } });
    if (scratchUserId) await userModel.destroy({ where: { user_id: scratchUserId } });
    const left = (await teamMemberModel.count({ where: { invited_email: SENTINEL } })) + (await userModel.count({ where: { email: SENTINEL } }));
    console.log(`CLEANUP: sentinel_rows_left=${left}`);
    console.log(`=== RESULT: ${passed}/${checks} checks passed ===`);
    process.exit(passed === checks && left === 0 ? 0 : 1);
  }
}
main().catch((e) => { console.error("HARNESS ERROR", e); process.exit(1); });
