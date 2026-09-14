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
import supertest from "supertest";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:8001";
const request = supertest(BASE_URL);

const ADMIN_CREDS = {
  email: "moxxcompany@gmail.com",
  password: "Katiekendra123@",
};

let adminToken = "";

describe("Setup: Admin Auth", () => {
  it("POST /api/admin/login should return a token", async () => {
    const res = await request
      .post("/api/admin/login")
      .send(ADMIN_CREDS);

    expect(res.status).toBe(200);
    expect(res.body.data?.accessToken).toBeDefined();
    adminToken = res.body.data.accessToken;
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

  it("POST /api/events/broadcast with valid data should succeed", async () => {
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

  it("POST /api/events/push with valid data should succeed", async () => {
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

describe("Swagger Documentation — New Endpoints", () => {
  it("GET /api/docs.json should include new real-time endpoints", async () => {
    const res = await request.get("/api/docs.json");

    expect(res.status).toBe(200);
    expect(res.body.paths["/api/events/stream"]).toBeDefined();
    expect(res.body.paths["/api/events/stats"]).toBeDefined();
    expect(res.body.paths["/api/events/push-stats"]).toBeDefined();
    expect(res.body.paths["/api/events/broadcast"]).toBeDefined();
    expect(res.body.paths["/api/events/push"]).toBeDefined();
    expect(res.body.paths["/api/events/admin-event"]).toBeDefined();
  });
});
