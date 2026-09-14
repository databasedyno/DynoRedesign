/**
 * API Integration Tests — Core Services
 *
 * Tests platform-level endpoints:
 * - Health check
 * - Status page
 * - CSRF token
 * - SSE events stats
 * - API root
 * - Swagger docs
 */
import supertest from "supertest";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:8001";
const request = supertest(BASE_URL);

describe("Health & Status", () => {
  it("GET /health should return 200 with healthy status", async () => {
    const res = await request.get("/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("healthy");
  });

  it("GET /api should return API info with available endpoints", async () => {
    const res = await request.get("/api");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("operational");
    expect(res.body.endpoints).toBeDefined();
    expect(res.body.endpoints.authentication).toBe("/api/user");
    expect(res.body.endpoints.admin).toBe("/api/admin");
  });

  it("GET /api/status/health should return service statuses", async () => {
    const res = await request.get("/api/status/health");

    expect(res.status).toBe(200);
    // Response may have top-level status or nested data
    expect(res.body.status || res.body.data).toBeDefined();
  });
});

describe("CSRF Token", () => {
  it("GET /api/csrf-token should return a token", async () => {
    const res = await request.get("/api/csrf-token");

    expect(res.status).toBe(200);
    expect(res.body.csrf_token).toBeDefined();
    expect(typeof res.body.csrf_token).toBe("string");
    expect(res.body.csrf_token.length).toBeGreaterThan(10);
  });

  it("CSRF token should be unique per request", async () => {
    const res1 = await request.get("/api/csrf-token");
    const res2 = await request.get("/api/csrf-token");

    expect(res1.body.csrf_token).toBeDefined();
    expect(res2.body.csrf_token).toBeDefined();
    // Tokens should be different (each call generates new)
    expect(res1.body.csrf_token).not.toBe(res2.body.csrf_token);
  });
});

describe("SSE Events", () => {
  it("GET /api/events/stats should return connection stats", async () => {
    const res = await request.get("/api/events/stats");

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(typeof res.body.data.total_clients).toBe("number");
  });
});

describe("Swagger Documentation", () => {
  it("GET /api/docs.json should return valid OpenAPI spec", async () => {
    const res = await request.get("/api/docs.json");

    expect(res.status).toBe(200);
    expect(res.body.openapi).toBeDefined();
    expect(res.body.info).toBeDefined();
    expect(res.body.paths).toBeDefined();

    // Verify new security paths are present
    expect(res.body.paths["/api/csrf-token"]).toBeDefined();
    expect(res.body.paths["/api/user/2fa/setup"]).toBeDefined();
    expect(res.body.paths["/api/user/sessions"]).toBeDefined();
    expect(res.body.paths["/api/events/stream"]).toBeDefined();
  });

  it("GET /api/docs should return HTML page or redirect", async () => {
    const res = await request.get("/api/docs");

    // Swagger UI may redirect /api/docs → /api/docs/ (301) or serve directly (200)
    expect([200, 301, 302]).toContain(res.status);
  });
});

describe("Rate Limiting", () => {
  it("Should not immediately rate-limit normal requests", async () => {
    // Send 3 requests quickly — should all succeed
    const results = await Promise.all([
      request.get("/health"),
      request.get("/health"),
      request.get("/health"),
    ]);

    results.forEach((res) => {
      expect(res.status).toBe(200);
    });
  });
});
