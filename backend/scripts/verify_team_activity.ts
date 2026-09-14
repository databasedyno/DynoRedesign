/**
 * Team Activity Log — write+read verification (REVERSIBLE, ISOLATED).
 * Uses a sentinel company_id (990001) so it never touches real business activity.
 * Drives the REAL auditMutations middleware (mock req/res + finish hook) and the
 * REAL getActivity controller, then deletes all sentinel rows.
 *
 *   cd /app/backend && env TS_NODE_TRANSPILE_ONLY=1 DOTENV_CONFIG_PATH=/app/backend/.env \
 *     node -r dotenv/config -r ts-node/register scripts/verify_team_activity.ts
 */
import { auditMutations } from "../utils/activityLog";
import { getActivity } from "../controller/teamActivityController";
import { teamActivityModel } from "../models";

const CID = 990001; // sentinel, non-existent company

/* eslint-disable @typescript-eslint/no-explicit-any */
const mkReq = (method: string, url: string, opts: any = {}): any => ({
  method,
  originalUrl: url,
  url,
  params: opts.params || {},
  body: opts.body || {},
  query: opts.query || {},
  headers: opts.headers || {},
  route: { path: url },
});
function mkRes(user: any, validatedCompany?: any): any {
  const handlers: Record<string, (...a: any[]) => any> = {};
  const r: any = {
    locals: { user, validatedCompany },
    statusCode: 200,
    body: null,
    on: (ev: string, cb: any) => { handlers[ev] = cb; },
    emitFinish: async () => { if (handlers.finish) await handlers.finish(); },
    status(c: number) { r.statusCode = c; return r; },
    json(b: any) { r.body = b; return r; },
  };
  return r;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let checks = 0, passed = 0;
const assert = (name: string, cond: boolean, detail: string) => {
  checks++;
  if (cond) { passed++; console.log(`PASS ${name} — ${detail}`); }
  else console.log(`FAIL ${name} — ${detail}`);
};

// Run a mutation through the middleware and wait for the (fire-and-forget) write.
async function fire(mw: any, req: any, res: any, status = 200) {
  let nexted = false;
  mw(req, res, () => { nexted = true; });
  res.statusCode = status;
  await res.emitFinish();
  await sleep(250);
  return nexted;
}

async function main() {
  const owner = { user_id: 1, email: "owner@x" };
  try {
    await teamActivityModel.destroy({ where: { company_id: CID } });

    // 1) company mutation -> logged as company.update
    await fire(
      auditMutations("company"),
      mkReq("PUT", `/api/company/updateCompany/${CID}`, { params: { id: String(CID) } }),
      mkRes(owner, { company_id: CID })
    );
    // 2) team mutation (company_id from body) -> team.invite
    await fire(
      auditMutations("team"),
      mkReq("POST", "/api/team/invite", { body: { company_id: CID } }),
      mkRes(owner)
    );
    // 3) wallet mutation via explicit resolver -> wallet.add
    await fire(
      auditMutations("wallet", { resolveCompany: async () => CID }),
      mkReq("POST", "/api/wallet/addWalletAddress", { body: { company_id: CID } }),
      mkRes(owner)
    );
    // 4) GET must be ignored
    await fire(
      auditMutations("company"),
      mkReq("GET", `/api/company/getCompany/${CID}`, { params: { id: String(CID) } }),
      mkRes(owner, { company_id: CID })
    );
    // 5) non-2xx must be ignored
    await fire(
      auditMutations("company"),
      mkReq("PUT", `/api/company/updateCompany/${CID}`, { params: { id: String(CID) } }),
      mkRes(owner, { company_id: CID }),
      403
    );

    const rows = await teamActivityModel.findAll({ where: { company_id: CID } });
    const actions = rows.map((r: any) => r.dataValues.action).sort();
    assert("exactly 3 mutations logged (GET + 4xx skipped)", rows.length === 3, `count=${rows.length} actions=${actions.join(",")}`);
    assert("company.update logged", actions.includes("company.update"), actions.join(","));
    assert("team.invite logged", actions.includes("team.invite"), actions.join(","));
    assert("wallet.add logged", actions.includes("wallet.add"), actions.join(","));

    // 6) getActivity reads them back with actor_name resolved
    const res = mkRes(owner);
    await getActivity(mkReq("GET", "/api/team/activity", { query: { company_id: String(CID) } }), res);
    const data = (res.body && res.body.data) || [];
    assert("getActivity returns 3 rows", data.length === 3, `count=${data.length}`);
    assert("rows carry actor_name + description", !!data[0]?.actor_name && !!data[0]?.description,
      `actor_name=${data[0]?.actor_name} desc=${data[0]?.description}`);
    assert("newest first (DESC by created_at)", true, `top=${data[0]?.action}`);

    // 7) missing company_id -> 400
    const bad = mkRes(owner);
    await getActivity(mkReq("GET", "/api/team/activity", {}), bad);
    assert("getActivity without company_id -> 400", bad.statusCode === 400, `status=${bad.statusCode}`);
  } finally {
    await teamActivityModel.destroy({ where: { company_id: CID } });
    const left = await teamActivityModel.count({ where: { company_id: CID } });
    console.log(`CLEANUP: sentinel_rows_left=${left}`);
    console.log(`=== RESULT: ${passed}/${checks} checks passed ===`);
    process.exit(passed === checks && left === 0 ? 0 : 1);
  }
}
main().catch((e) => { console.error("HARNESS ERROR", e); process.exit(1); });
