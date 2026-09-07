/**
 * Warmer Email Greetings — verifies the payout / wallet lifecycle emails greet
 * the merchant by FIRST name ("Hey John,") rather than the full name
 * ("Hey John Davis,"). The mail transporter is mocked so we can inspect the
 * rendered HTML body without sending anything.
 */

const sent: Array<{ to: string; name: string; subject: string; body: string }> = [];

jest.mock("../utils/mailTransporter", () => ({
  __esModule: true,
  default: jest.fn(async (opts: { to: string; name: string; subject: string; body: string }) => {
    sent.push(opts);
    return { messageId: "test-message-id" };
  }),
}));

import {
  sendWalletSudoOTPEmail,
  sendWalletBatchSummaryEmail,
} from "../services/email/walletEmails";
import {
  sendWalletChangeAlertEmail,
  sendWalletSecuredEmail,
} from "../services/email/walletSecurityEmails";

const lastBody = (): string => sent[sent.length - 1]?.body || "";

beforeEach(() => {
  sent.length = 0;
});

describe("Warmer email greetings use the first name only", () => {
  it("sendWalletSudoOTPEmail greets by first name", async () => {
    await sendWalletSudoOTPEmail("merchant@example.com", "John Davis", "123456");
    expect(lastBody()).toContain("Hey John,");
    expect(lastBody()).not.toContain("Hey John Davis,");
  });

  it("sendWalletBatchSummaryEmail greets by first name", async () => {
    await sendWalletBatchSummaryEmail("merchant@example.com", "John Davis", {
      companyName: "Acme Corp",
      added: ["Bitcoin"],
    });
    expect(lastBody()).toContain("Hey John,");
    expect(lastBody()).not.toContain("Hey John Davis,");
  });

  it("sendWalletChangeAlertEmail greets by first name", async () => {
    await sendWalletChangeAlertEmail(
      "merchant@example.com",
      "Grace Hopper",
      {
        companyName: "Acme Corp",
        rows: [{ network: "Bitcoin", address: "bc1qexample", actionLabel: "added" }] as any,
        revertUrl: "https://example.com/revert",
      } as any,
    );
    expect(lastBody()).toContain("Hey Grace,");
    expect(lastBody()).not.toContain("Hey Grace Hopper,");
  });

  it("sendWalletSecuredEmail greets by first name", async () => {
    await sendWalletSecuredEmail("merchant@example.com", "Grace Hopper", {
      companyName: "Acme Corp",
      networks: ["Bitcoin"],
    });
    expect(lastBody()).toContain("Hey Grace,");
    expect(lastBody()).not.toContain("Hey Grace Hopper,");
  });

  it("still falls back to a friendly generic greeting when no name is known", async () => {
    await sendWalletSudoOTPEmail("merchant@example.com", "", "123456");
    expect(lastBody()).toContain("Hey there,");
  });
});
