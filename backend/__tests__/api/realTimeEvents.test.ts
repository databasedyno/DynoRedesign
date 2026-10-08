/**
 * API Integration Tests — Real-Time Events & Push Notifications
 *
 * Tests SSE and push notification endpoints:
 * - SSE stats
 * - Push notification stats
 * - Admin broadcast (auth guard + functionality)
 * - Admin push to user (auth guard + functionality)
 * - Admin event (auth guard + functionality)
 */
import { adminLogin, itWrites, request } from "./helpers/adminSession";

let adminToken = "";

describe("Setup: Admin Auth", () => {
  it("two-step admin login returns a token", async () => {
    adminToken = await adminLogin();
    expect(adminToken.length).toBeGreaterThan(20);
  });
});

describe("SSE Stats Endpoints", () => {
  it("GET /api/events/stats should return SSE connection stats", async () => {
    const res = await request.get("/api/events/stats");

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(typeof res.body.data.total_clients).toBe("number");
    expect(res.body.data.clients_by_channel).toBeDefined();
  });

  it("GET /api/events/push-stats should return push service stats", async () => {
    const res = await request.get("/api/events/push-stats");

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.sse).toBeDefined();
    expect(Array.isArray(res.body.data.channels_available)).toBe(true);
    expect(res.body.data.channels_available).toContain("payments");
    expect(res.body.data.channels_available).toContain("notifications");
    expect(res.body.data.channels_available).toContain("admin");
  });
});

describe("Admin Broadcast Endpoint", () => {
  it("POST /api/events/broadcast without auth should fail", async () => {
    const res = await request
      .post("/api/events/broadcast")
      .send({ title: "Test", message: "Test broadcast" });

    expect([401, 403]).toContain(res.status);
  });

  it("POST /api/events/broadcast without required fields should return 400", async () => {
    if (!adminToken) return;

    const res = await request
      .post("/api/events/broadcast")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ title: "Only title" });

    expect(res.status).toBe(400);
  });

  // Shows a banner to every connected client — opt-in only.
  itWrites("POST /api/events/broadcast with valid data should succeed", async () => {
    if (!adminToken) return;

    const res = await request
      .post("/api/events/broadcast")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Test Announcement",
        message: "This is a test broadcast from integration tests",
        type: "system",
      });

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(typeof res.body.data.clients_reached).toBe("number");
    expect(res.body.data.announcement.title).toBe("Test Announcement");
  });
});

describe("Admin Push Notification Endpoint", () => {
  it("POST /api/events/push without auth should fail", async () => {
    const res = await request
      .post("/api/events/push")
      .send({ user_id: 1, title: "Test", message: "Test push" });

    expect([401, 403]).toContain(res.status);
  });

  it("POST /api/events/push without required fields should return 400", async () => {
    if (!adminToken) return;

    const res = await request
      .post("/api/events/push")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ user_id: 1 }); // missing title and message

    expect(res.status).toBe(400);
  });

  // Persists a notification for user 1 in the live DB — opt-in only.
  itWrites("POST /api/events/push with valid data should succeed", async () => {
    if (!adminToken) return;

    const res = await request
      .post("/api/events/push")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        user_id: 1,
        type: "system",
        title: "Integration Test Notification",
        message: "This notification was sent from the integration test suite",
      });

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(typeof res.body.data.persisted).toBe("boolean");
    expect(typeof res.body.data.sse_delivered).toBe("boolean");
  });
});

describe("Admin Event Endpoint", () => {
  it("POST /api/events/admin-event without auth should fail", async () => {
    const res = await request
      .post("/api/events/admin-event")
      .send({ event: "test_event", data: {} });

    expect([401, 403]).toContain(res.status);
  });

  it("POST /api/events/admin-event without event name should return 400", async () => {
    if (!adminToken) return;

    const res = await request
      .post("/api/events/admin-event")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ data: {} });

    expect(res.status).toBe(400);
  });

  it("POST /api/events/admin-event with valid data should succeed", async () => {
    if (!adminToken) return;

    const res = await request
      .post("/api/events/admin-event")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        event: "test_event",
        data: { test: true, timestamp: Date.now() },
      });

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.event).toBe("test_event");
    expect(typeof res.body.data.clients_reached).toBe("number");
  });
});

describe("Swagger Documentation — real-time endpoints", () => {
  // /api/docs.json is the MERCHANT spec: only the SSE stream is public; admin event routes
  // live in the internal spec (/api/docs/internal.json, ENABLE_INTERNAL_API_DOCS=true).
  it("merchant spec exposes the SSE stream but not the admin event routes", async () => {
    const res = await request.get("/api/docs.json");

    expect(res.status).toBe(200);
    expect(res.body.paths["/api/events/stream"]).toBeDefined();
    expect(res.body.paths["/api/events/broadcast"]).toBeUndefined();
    expect(res.body.paths["/api/events/push"]).toBeUndefined();
    expect(res.body.paths["/api/events/admin-event"]).toBeUndefined();
  });

  it("internal spec documents every real-time endpoint (or is disabled)", async () => {
    const res = await request.get("/api/docs/internal.json");
    if (res.status === 404) return expect(res.body.message).toMatch(/ENABLE_INTERNAL_API_DOCS/);

    expect(res.status).toBe(200);
    for (const p of ["/api/events/stream", "/api/events/stats", "/api/events/push-stats", "/api/events/broadcast", "/api/events/push", "/api/events/admin-event"]) {
      expect(res.body.paths[p]).toBeDefined();
    }
  });
});
