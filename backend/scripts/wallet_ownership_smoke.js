// Backend smoke for "Verify with wallet" (Reown AppKit ownership flow) + hint endpoints.
// Usage: cd /app/backend && node -r dotenv/config scripts/wallet_ownership_smoke.js <baseUrl> <sd_token> [merchant_email] [merchant_password]
const axios = require("axios");
const { Wallet, verifyMessage } = require("ethers");
const { TronWeb } = require("tronweb");
const { execSync } = require("child_process");

const [BASE, SD_TOKEN, M_EMAIL, M_PASS] = process.argv.slice(2);
if (!BASE || !SD_TOKEN) { console.error("usage: <baseUrl> <sd_token> [merchant_email] [merchant_password]"); process.exit(2); }

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { cond ? pass++ : fail++; console.log(`${cond ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };

async function main() {
  // CSRF cookie + header (SafeDeal auth is a custom header, not Bearer)
  const csrf = await axios.get(`${BASE}/api/csrf-token`);
  const cookie = (csrf.headers["set-cookie"] || []).map((c) => c.split(";")[0]).join("; ");
  const sd = axios.create({ baseURL: `${BASE}/api/safedeal`, headers: { "x-safedeal-token": SD_TOKEN, "x-csrf-token": csrf.data.csrf_token, cookie, origin: BASE }, validateStatus: () => true });

  const me = await sd.get("/me");
  ok("safedeal session valid", me.status === 200, `cid=${me.data?.data?.user?.customer_id}`);

  const stepUp = async () => (await sd.post("/auth/step-up", { action: "address_add" })).data?.data?.preview_code;

  /* ── EVM (USDT-POLYGON) positive + negative ── */
  const evm = Wallet.createRandom();
  let code = await stepUp();
  let add = await sd.post("/wallet/addresses", { payout_key: "USDT-POLYGON", address: evm.address, label: "smoke-evm", code });
  ok("add EVM payout address", add.status === 200 || add.status === 201, `${add.status} ${add.data?.message || ""}`);
  const evmId = add.data?.data?.address_id;
  if (evmId) {
    const n = await sd.post(`/wallet/addresses/${evmId}/verify-nonce`, {});
    ok("EVM nonce issued", n.status === 200 && n.data.data.family === "evm" && /Nonce: [a-f0-9]{32}/.test(n.data.data.message), n.data?.message);
    // wrong signer first → 400, nonce burned
    const stranger = Wallet.createRandom();
    const badSig = await stranger.signMessage(n.data.data.message);
    const bad = await sd.post(`/wallet/addresses/${evmId}/verify`, { nonce: n.data.data.nonce, signature: badSig, wallet_name: "Stranger" });
    ok("EVM wrong signer rejected", bad.status === 400, `${bad.status} ${bad.data?.message}`);
    const replay = await sd.post(`/wallet/addresses/${evmId}/verify`, { nonce: n.data.data.nonce, signature: badSig });
    ok("EVM nonce is single-use", replay.status === 400 && /expired/i.test(replay.data?.message || ""), replay.data?.message);
    const n2 = await sd.post(`/wallet/addresses/${evmId}/verify-nonce`, {});
    const sig = await evm.signMessage(n2.data.data.message);
    ok("local ethers recovers signer", verifyMessage(n2.data.data.message, sig).toLowerCase() === evm.address.toLowerCase());
    const good = await sd.post(`/wallet/addresses/${evmId}/verify`, { nonce: n2.data.data.nonce, signature: sig, wallet_name: "MetaMask" });
    ok("EVM verify succeeds", good.status === 200 && !!good.data.data.ownership_verified_at && good.data.data.ownership_verified_via === "MetaMask", `${good.status} ${good.data?.message}`);
    const list = await sd.get("/wallet");
    const row = (list.data?.data?.addresses || []).find((a) => a.address_id === evmId);
    ok("wallet list exposes ownership_verified_at", !!row?.ownership_verified_at, JSON.stringify(row && { ownership_verified_at: row.ownership_verified_at, via: row.ownership_verified_via }));
  }

  /* ── Tron (USDT-TRON) positive with signMessageV2 ── */
  const tw = new TronWeb({ fullHost: "https://api.trongrid.io" });
  const acct = await tw.createAccount();
  code = await stepUp();
  add = await sd.post("/wallet/addresses", { payout_key: "USDT-TRON", address: acct.address.base58, label: "smoke-tron", code });
  ok("add Tron payout address", add.status === 200 || add.status === 201, `${add.status} ${add.data?.message || ""}`);
  const tronId = add.data?.data?.address_id;
  if (tronId) {
    const n = await sd.post(`/wallet/addresses/${tronId}/verify-nonce`, {});
    ok("Tron nonce issued", n.status === 200 && n.data.data.family === "tron", n.data?.message);
    const sig = await tw.trx.signMessageV2(n.data.data.message, acct.privateKey);
    const good = await sd.post(`/wallet/addresses/${tronId}/verify`, { nonce: n.data.data.nonce, signature: sig, wallet_name: "TronLink" });
    ok("Tron verify succeeds (signMessageV2)", good.status === 200 && !!good.data.data.ownership_verified_at, `${good.status} ${good.data?.message}`);
  }

  /* ── unsupported network → 400 (no nonce) ── */
  // (Only stablecoin rails exist in SafeDeal; all are wallet-capable, so test via a bogus id → 404)
  const nf = await sd.post(`/wallet/addresses/999999999/verify-nonce`, {});
  ok("unknown address → 404", nf.status === 404, `${nf.status}`);

  /* ── SafeDeal funding tx hint validation ── */
  const badHint = await sd.post(`/deals/${"ab".repeat(24)}/funding/wallet-tx`, { tx_hash: "not a hash!", coin: "USDT-TRC20", address: "T..." });
  ok("funding wallet-tx rejects bad hash", badHint.status === 400, `${badHint.status}`);

  /* ── cleanup: remove the smoke addresses ── */
  for (const id of [evmId, tronId].filter(Boolean)) {
    const c = await stepUp();
    const rm = await sd.post(`/wallet/addresses/${id}/remove`, { code: c });
    ok(`cleanup address ${id}`, rm.status === 200, `${rm.status} ${rm.data?.message || ""}`);
  }

  /* ── Merchant side (owner-only guard + nonce) ── */
  if (M_EMAIL && M_PASS) {
    const m = axios.create({ baseURL: `${BASE}/api`, validateStatus: () => true, headers: { origin: BASE } });
    const login = await m.post("/user/login", { email: M_EMAIL, password: M_PASS });
    let token = login.data?.data?.accessToken;
    if (!token && login.data?.data?.challenge_token) {
      const totp = execSync("node /app/backend/scripts/print_totp.cjs 1", { cwd: "/app/backend" }).toString().trim().split("\n").pop();
      const v = await m.post("/user/2fa/validate", { challenge_token: login.data.data.challenge_token, token: totp });
      token = v.data?.data?.accessToken;
    }
    ok("merchant login", !!token, login.data?.message);
    if (token) {
      const h = { Authorization: `Bearer ${token}` };
      const wl = await m.get("/wallet/getWallet", { headers: h, params: { company_id: 1 } });
      const wallets = (Array.isArray(wl.data?.data) ? wl.data.data : []).flatMap((c) => c.wallets || []);
      const target = (Array.isArray(wallets) ? wallets : []).find((w) => ["ETH", "USDT-ERC20", "POLYGON", "SOL", "TRX", "USDT-TRC20"].includes(String(w.wallet_type).toUpperCase()));
      ok("merchant has a wallet-capable payout address", !!target, target && `${target.wallet_type} #${target.wallet_id} verified=${target.ownership_verified_at}`);
      if (target) {
        const n = await m.post("/wallet/ownership/nonce", { wallet_id: target.wallet_id }, { headers: h });
        ok("merchant nonce issued", n.status === 200 && /Dynopay wants you to verify/.test(n.data?.data?.message || ""), `${n.status} ${n.data?.message}`);
        const stranger = Wallet.createRandom();
        const sig = await stranger.signMessage(n.data.data.message);
        const bad = await m.post("/wallet/ownership/verify", { wallet_id: target.wallet_id, nonce: n.data.data.nonce, signature: sig, wallet_name: "Stranger" }, { headers: h });
        ok("merchant wrong-signer rejected (address stays unverified)", bad.status === 400 || bad.status === 200 && false, `${bad.status} ${bad.data?.message}`);
      }
      const noAuth = await m.post("/wallet/ownership/nonce", { wallet_id: 1 });
      ok("merchant nonce requires auth", noAuth.status === 401 || noAuth.status === 403, `${noAuth.status}`);
    }
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error("SMOKE CRASH", e?.response?.data || e); process.exit(1); });
