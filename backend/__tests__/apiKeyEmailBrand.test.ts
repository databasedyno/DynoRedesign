/**
 * API key emails name the affected brand (subject, intro and a "Brand" row) so merchants
 * with several brands know which integration a rotated key belongs to.
 */

const sent: Array<{ to: string; name: string; subject: string; body: string }> = [];

jest.mock("../utils/mailTransporter", () => ({
  __esModule: true,
  default: jest.fn(async (opts: { to: string; name: string; subject: string; body: string }) => {
    sent.push(opts);
    return { messageId: "test-message-id" };
  }),
}));

import { sendApiKeyCreatedEmail } from "../services/email/billingReportEmails";

const last = () => sent[sent.length - 1];

beforeEach(() => {
  sent.length = 0;
});

describe("API key emails include the brand", () => {
  it("regenerated email names the brand in subject, intro and details", async () => {
    await sendApiKeyCreatedEmail("m@example.com", "Alex", "production", "regenerated", "dpk_live_…4f9a", "08 Oct 2026", "00:45 UTC", "The Dev Store", "en");
    expect(last().subject).toBe("Production API key rotated for The Dev Store — old key stopped working");
    expect(last().body).toContain("API key for <strong>The Dev Store</strong> has been regenerated.");
    expect(last().body).toMatch(/Brand<\/td>\s*<td[^>]*><strong>The Dev Store<\/strong>/);
    expect(last().body).toContain("The production API key for The Dev Store was rotated.");
  });

  it("created email names the brand too", async () => {
    await sendApiKeyCreatedEmail("m@example.com", "Alex", "development", "created", "dpk_test_…1a2b", "08 Oct 2026", "00:45 UTC", "Acme", "en");
    expect(last().subject).toBe("New development API key created for Acme");
    expect(last().body).toContain("API key for <strong>Acme</strong> has been created.");
  });

  it("localizes the brand line (de)", async () => {
    await sendApiKeyCreatedEmail("m@example.com", "Alex", "production", "regenerated", "dpk_live_…4f9a", "08 Oct 2026", "00:45 UTC", "Acme", "de");
    expect(last().subject).toContain("für Acme");
    expect(last().body).toContain("Marke");
  });

  it("escapes HTML in the brand name inside the body", async () => {
    await sendApiKeyCreatedEmail("m@example.com", "Alex", "production", "regenerated", "dpk_live_…4f9a", "08 Oct 2026", "00:45 UTC", "<b>Evil</b>", "en");
    expect(last().body).not.toContain("<b>Evil</b>");
    expect(last().body).toContain("&lt;b&gt;Evil&lt;/b&gt;");
  });
});
