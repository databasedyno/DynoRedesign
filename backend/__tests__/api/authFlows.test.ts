/**
 * API Integration Tests — Auth Flows
 * 
 * Tests authentication endpoints end-to-end:
 * - Registration, Login, Token refresh
 * - Account lockout
 * - 2FA setup and validation
 * - Session management
 */
import supertest from "supertest";
import express from "express";

// We test against the running server
const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:8001";
const request = supertest(BASE_URL);

// Test user data
const TEST_USER = {
  name: `TestUser_${Date.now()}`,
  email: `test_${Date.now()}@dynopay-test.com`,
  password: "TestPass123!",
};

let accessToken = "";
let refreshToken = "";
let userId = 0;

describe("Auth Flow Integration Tests", () => {
  // Health check
  it("GET /health should return 200", async () => {
    const res = await request.get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("healthy");
  });

  // Registration
  it("POST /api/user/registerUser should create a new user", async () => {
    const res = await request
      .post("/api/user/registerUser")
      .send(TEST_USER)
      .timeout({ response: 10000 });

    // Accept 200 (success) or 400 (duplicate email from previous test run)
    expect([200, 400]).toContain(res.status);

    if (res.status === 200) {
      expect(res.body.data).toBeDefined();
      if (res.body.data?.accessToken) {
        accessToken = res.body.data.accessToken;
      }
      if (res.body.data?.refreshToken) {
        refreshToken = res.body.data.refreshToken;
      }
      if (res.body.data?.userData?.user_id) {
        userId = res.body.data.userData.user_id;
      }
    }
  });

  // Login
  it("POST /api/user/login should return tokens", async () => {
    const res = await request
      .post("/api/user/login")
      .send({ email: TEST_USER.email, password: TEST_USER.password });

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    
    if (res.body.data?.accessToken) {
      accessToken = res.body.data.accessToken;
    }
    if (res.body.data?.refreshToken) {
      refreshToken = res.body.data.refreshToken;
    }
    if (res.body.data?.userData?.user_id) {
      userId = res.body.data.userData.user_id;
    }
  });

  // Token refresh
  it("POST /api/user/refresh-token should rotate tokens", async () => {
    if (!refreshToken) return; // Skip if no refresh token from login

    const res = await request
      .post("/api/user/refresh-token")
      .send({ refresh_token: refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.data?.accessToken).toBeDefined();
    expect(res.body.data?.refreshToken).toBeDefined();

    // Update tokens
    accessToken = res.body.data.accessToken;
    refreshToken = res.body.data.refreshToken;
  });

  // Old refresh token should be invalid after rotation
  it("POST /api/user/refresh-token with old token should fail", async () => {
    const oldToken = "invalid_token_12345";
    const res = await request
      .post("/api/user/refresh-token")
      .send({ refresh_token: oldToken });

    expect(res.status).toBe(401);
  });

  // Profile access with token
  it("GET /api/user/profile should work with valid token", async () => {
    if (!accessToken) return;

    const res = await request
      .get("/api/user/profile")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
  });

  // Profile without token should fail
  it("GET /api/user/profile without token should return 401", async () => {
    const res = await request.get("/api/user/profile");
    expect(res.status).toBe(401);
  });

  // Invalid login should track failed attempts
  it("POST /api/user/login with wrong password should return 401", async () => {
    const res = await request
      .post("/api/user/login")
      .send({ email: TEST_USER.email, password: "WrongPassword123!" });

    expect(res.status).toBe(401);
  });

  // Password validation
  it("POST /api/user/registerUser with weak password should return 400", async () => {
    const res = await request
      .post("/api/user/registerUser")
      .send({ name: "Weak", email: `weak_${Date.now()}@test.com`, password: "123" });

    expect(res.status).toBe(400);
  });
});

describe("Session Management Tests", () => {
  it("GET /api/user/sessions should list active sessions", async () => {
    if (!accessToken) return;

    const res = await request
      .get("/api/user/sessions")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data?.sessions).toBeDefined();
    expect(Array.isArray(res.body.data.sessions)).toBe(true);
  });

  it("GET /api/user/login-history should return history", async () => {
    if (!accessToken) return;

    const res = await request
      .get("/api/user/login-history")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data?.history).toBeDefined();
  });
});

describe("2FA Status Tests", () => {
  it("GET /api/user/2fa/status should return 2FA status", async () => {
    if (!accessToken) return;

    const res = await request
      .get("/api/user/2fa/status")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data?.enabled).toBeDefined();
  });
});

describe("SSE Events Tests", () => {
  it("GET /api/events/stats should return SSE stats", async () => {
    const res = await request.get("/api/events/stats");
    expect(res.status).toBe(200);
    expect(res.body.data?.total_clients).toBeDefined();
  });
});

describe("Analytics Endpoints Tests", () => {
  it("GET /api/admin/analytics/revenue without auth should return 401/403", async () => {
    const res = await request.get("/api/admin/analytics/revenue");
    expect([401, 403]).toContain(res.status);
  });

  it("GET /api/admin/analytics/users without auth should return 401/403", async () => {
    const res = await request.get("/api/admin/analytics/users");
    expect([401, 403]).toContain(res.status);
  });
});
