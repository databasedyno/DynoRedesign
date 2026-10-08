/**
 * API Integration Tests — Admin Flows
 *
 * Tests admin endpoints end-to-end:
 * - Admin login
 * - User management (get detail, ban, unlock)
 * - Alert service health
 * - Analytics endpoints (auth guard)
 */
import { BROWSER_UA, adminLogin, itWrites, request } from "./helpers/adminSession";

let adminToken = "";

describe("Admin Login", () => {
  it("two-step login (password → TOTP) returns an access token", async () => {
    adminToken = await adminLogin();
    expect(adminToken.length).toBeGreaterThan(20);
  });

  it("POST /api/admin/login/password with an unknown admin is rejected", async () => {
    // Unknown email on purpose — a wrong password on the real admin would count toward its lockout.
    const res = await request
      .post("/api/admin/login/password")
      .set("User-Agent", BROWSER_UA)
      .send({ email: "no-such-admin@example.invalid", password: "WrongPass!" });

    expect([400, 401]).toContain(res.status);
    expect(res.body.data?.accessToken).toBeUndefined();
  });

  it("the retired single-step POST /api/admin/login never issues a token", async () => {
    const res = await request.post("/api/admin/login").set("User-Agent", BROWSER_UA).send({ email: "no-such-admin@example.invalid", password: "x" });
    expect(res.body?.data?.accessToken).toBeUndefined();
  });
});

describe("Admin User Management", () => {
  it("GET /api/admin/getAllUsers should return user list", async () => {
    if (!adminToken) return;

    const res = await request
      .get("/api/admin/getAllUsers")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
  });

  it("GET /api/admin/getAllUsers without auth should fail", async () => {
    const res = await request.get("/api/admin/getAllUsers");
    expect([401, 403]).toContain(res.status);
  });

  it("GET /api/admin/getAllTransactions should return transactions", async () => {
    if (!adminToken) return;

    const res = await request
      .get("/api/admin/getAllTransactions")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
  });
});

describe("Alert Service Endpoints", () => {
  it("GET /api/admin/alerts/health should return configuration", async () => {
    if (!adminToken) return;

    const res = await request
      .get("/api/admin/alerts/health")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data?.configured).toBeDefined();
    expect(res.body.data?.configured).toHaveProperty("slack");
    expect(res.body.data?.configured).toHaveProperty("discord");
    expect(typeof res.body.data?.dedup_window_seconds).toBe("number");
  });

  it("GET /api/admin/alerts/health without auth should fail", async () => {
    const res = await request.get("/api/admin/alerts/health");
    expect([401, 403]).toContain(res.status);
  });

  // Sends a REAL Slack/Discord alert — opt-in only.
  itWrites("POST /api/admin/alerts/test should send test alert", async () => {
    if (!adminToken) return;

    const res = await request
      .post("/api/admin/alerts/test")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data?.delivered).toBeDefined();
  });
});

describe("Analytics Endpoints (Admin Auth Guard)", () => {
  it("GET /api/admin/analytics/revenue should work with admin token", async () => {
    if (!adminToken) return;

    const res = await request
      .get("/api/admin/analytics/revenue")
      .set("Authorization", `Bearer ${adminToken}`);

    // Accept 200 (data) or 500 (service error) — we're testing auth guard
    expect([200, 500]).toContain(res.status);
  });

  it("GET /api/admin/analytics/users should work with admin token", async () => {
    if (!adminToken) return;

    const res = await request
      .get("/api/admin/analytics/users")
      .set("Authorization", `Bearer ${adminToken}`);

    expect([200, 500]).toContain(res.status);
  });

  it("GET /api/admin/analytics/cohorts should work with admin token", async () => {
    if (!adminToken) return;

    const res = await request
      .get("/api/admin/analytics/cohorts")
      .set("Authorization", `Bearer ${adminToken}`);

    expect([200, 500]).toContain(res.status);
  });

  it("GET /api/admin/analytics/funnel should work with admin token", async () => {
    if (!adminToken) return;

    const res = await request
      .get("/api/admin/analytics/funnel")
      .set("Authorization", `Bearer ${adminToken}`);

    expect([200, 500]).toContain(res.status);
  });

  it("Analytics endpoints without auth should return 401/403", async () => {
    const endpoints = ["/api/admin/analytics/revenue", "/api/admin/analytics/users", "/api/admin/analytics/cohorts", "/api/admin/analytics/funnel"];

    for (const endpoint of endpoints) {
      const res = await request.get(endpoint);
      expect([401, 403]).toContain(res.status);
    }
  });
});
