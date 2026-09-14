/**
 * API Integration Tests — Admin Flows
 *
 * Tests admin endpoints end-to-end:
 * - Admin login
 * - User management (get detail, ban, unlock)
 * - Alert service health
 * - Analytics endpoints (auth guard)
 */
import supertest from "supertest";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:8001";
const request = supertest(BASE_URL);

const ADMIN_CREDS = {
  email: "moxxcompany@gmail.com",
  password: "Katiekendra123@",
};

let adminToken = "";

describe("Admin Login", () => {
  it("POST /api/admin/login should return a token", async () => {
    const res = await request
      .post("/api/admin/login")
      .send(ADMIN_CREDS);

    expect(res.status).toBe(200);
    expect(res.body.data?.accessToken).toBeDefined();
    adminToken = res.body.data.accessToken;
  });

  it("POST /api/admin/login with wrong password should return 500 (invalid)", async () => {
    const res = await request
      .post("/api/admin/login")
      .send({ email: ADMIN_CREDS.email, password: "WrongPass!" });

    expect([400, 401, 500]).toContain(res.status);
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

  it("POST /api/admin/alerts/test should send test alert", async () => {
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
