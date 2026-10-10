/**
 * Read-only guards for two endpoints fixed in 2026-06:
 *  - GET  /api/pay/getBalance              → wrong kind of login = 401 (was 500)
 *  - POST /api/wallet/getWalletTransactions/:id → bad id 400, unknown 404 (was 500 on every call)
 * Authed checks need TEST_MERCHANT_TOKEN; customer tokens are signed with ACCESS_TOKEN_SECRET.
 * Run ONLY this file (path BEFORE the flag — `--selectProjects x <path>` swallows the path
 * and runs the whole live-DB suite):
 *   TEST_MERCHANT_TOKEN=... npx jest __tests__/api/walletBalanceGuards.test.ts --selectProjects integration
 */
import jwt from "jsonwebtoken";
import path from "path";
import dotenv from "dotenv";
import { request, BROWSER_UA } from "./helpers/adminSession";

dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

const merchantToken = process.env.TEST_MERCHANT_TOKEN || "";
const secret = process.env.ACCESS_TOKEN_SECRET || "";
const itMerchant = merchantToken ? it : it.skip;
const itSecret = secret ? it : it.skip;

describe("GET /api/pay/getBalance", () => {
  itMerchant("merchant login → 401 'sign in as a customer' (not a 500)", async () => {
    const res = await request.get("/api/pay/getBalance").set("User-Agent", BROWSER_UA).set("Authorization", `Bearer ${merchantToken}`);
    expect(res.status).toBe(401);
  });

  itSecret("unknown customer → 403, never 500", async () => {
    const token = jwt.sign({ customer_id: 999999999 }, secret, { expiresIn: "5m" });
    const res = await request.get("/api/pay/getBalance").set("User-Agent", BROWSER_UA).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

describe("POST /api/wallet/getWalletTransactions/:id", () => {
  itMerchant("non-numeric id → 400", async () => {
    const res = await request.post("/api/wallet/getWalletTransactions/abc").set("User-Agent", BROWSER_UA).set("Authorization", `Bearer ${merchantToken}`).send({ page: 1, rowsPerPage: 5 });
    expect(res.status).toBe(400);
  });

  itMerchant("unknown wallet → 404", async () => {
    const res = await request.post("/api/wallet/getWalletTransactions/999999999").set("User-Agent", BROWSER_UA).set("Authorization", `Bearer ${merchantToken}`).send({ page: 1, rowsPerPage: 5 });
    expect(res.status).toBe(404);
  });
});
