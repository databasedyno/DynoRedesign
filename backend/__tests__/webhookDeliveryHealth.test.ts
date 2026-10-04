/**
 * Webhook Delivery health classifier — regression for the 2026-10 prod sweep:
 * a SINGLE misbehaving merchant endpoint (company 269, HTTP 400 at high volume)
 * flipped the GLOBAL "Webhook Delivery" status to OUTAGE even though the delivery
 * backbone and every other merchant were fine. The classifier must not let one
 * noisy company dominate, while still surfacing genuine system-wide failures.
 */
import { classifyWebhookDeliveryHealth } from "../services/monitoringService";

describe("classifyWebhookDeliveryHealth", () => {
  it("idle / very low volume is operational (below min sample)", () => {
    expect(classifyWebhookDeliveryHealth({ okTotal: 2, deliverableTotal: 3, companiesActive: 1, companiesDown: 0 }))
      .toBe("operational");
  });

  it("ONE bad high-volume merchant among several healthy ones stays operational (the fix)", () => {
    // Real incident shape with merchant 4xx EXCLUDED: company 269's 400s don't
    // count, so it contributes only a few 5xx while 4 healthy companies deliver.
    // volumeRate 60/66≈0.91 → operational (old code returned OUTAGE here).
    expect(classifyWebhookDeliveryHealth({
      okTotal: 60,
      deliverableTotal: 66,
      companiesActive: 5,
      companiesDown: 1,
    })).toBe("operational");
  });

  it("one bad merchant with high SERVER-error volume is degraded, never a global outage", () => {
    // Even in the pathological case (one company flooding 5xx), per-company
    // weighting caps the damage at 'degraded' instead of the old false OUTAGE.
    expect(classifyWebhookDeliveryHealth({
      okTotal: 40, deliverableTotal: 95, companiesActive: 5, companiesDown: 1,
    })).toBe("degraded");
  });

  it("most distinct merchants failing → outage (genuine system-wide problem)", () => {
    expect(classifyWebhookDeliveryHealth({
      okTotal: 2, deliverableTotal: 100, companiesActive: 5, companiesDown: 5,
    })).toBe("outage");
  });

  it("a single merchant that is fully failing → outage (cannot dedup one company)", () => {
    expect(classifyWebhookDeliveryHealth({
      okTotal: 0, deliverableTotal: 30, companiesActive: 1, companiesDown: 1,
    })).toBe("outage");
  });

  it("about half of distinct merchants down → degraded", () => {
    // volumeRate 0.5, companyRate 0.5 → max 0.5 → degraded (>=0.5, <0.9)
    expect(classifyWebhookDeliveryHealth({
      okTotal: 50, deliverableTotal: 100, companiesActive: 4, companiesDown: 2,
    })).toBe("degraded");
  });

  it("all healthy → operational", () => {
    expect(classifyWebhookDeliveryHealth({
      okTotal: 98, deliverableTotal: 100, companiesActive: 6, companiesDown: 0,
    })).toBe("operational");
  });
});
