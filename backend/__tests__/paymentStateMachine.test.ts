/**
 * Payment State Machine — Unit Tests
 *
 * Validates every aspect of the formal payment lifecycle state machine:
 *   1. All valid transitions succeed
 *   2. All invalid transitions are rejected
 *   3. Terminal state enforcement
 *   4. TransitionRecord structure
 *   5. Legacy status parsing / aliases
 *   6. Helper utilities (getAllowedTransitions, getTransitionMap, etc.)
 */

import {
  PaymentState,
  canTransition,
  transition,
  getAllowedTransitions,
  isTerminal,
  parseState,
  getTransitionMap,
  InvalidTransitionError,
  ALL_STATES,
  TransitionRecord,
  toRedisStatus,
  toExternalStatus,
  toWebhookEvent,
  validateTransition,
} from "../services/paymentStateMachine";

// ── 1. canTransition — Valid Transitions ─────────────────────────────────────

describe("canTransition — valid transitions", () => {
  const validCases: [PaymentState, PaymentState][] = [
    // PENDING →
    [PaymentState.PENDING, PaymentState.DETECTED],
    [PaymentState.PENDING, PaymentState.EXPIRED],
    [PaymentState.PENDING, PaymentState.FAILED],
    // DETECTED →
    [PaymentState.DETECTED, PaymentState.CONFIRMING],
    [PaymentState.DETECTED, PaymentState.CONFIRMED],
    [PaymentState.DETECTED, PaymentState.PROCESSING],
    [PaymentState.DETECTED, PaymentState.UNDERPAID],
    [PaymentState.DETECTED, PaymentState.FAILED],
    // CONFIRMING →
    [PaymentState.CONFIRMING, PaymentState.CONFIRMED],
    [PaymentState.CONFIRMING, PaymentState.FAILED],
    // CONFIRMED →
    [PaymentState.CONFIRMED, PaymentState.PROCESSING],
    [PaymentState.CONFIRMED, PaymentState.CONVERTED],
    [PaymentState.CONFIRMED, PaymentState.FAILED],
    // UNDERPAID →
    [PaymentState.UNDERPAID, PaymentState.DETECTED],
    [PaymentState.UNDERPAID, PaymentState.PROCESSING],
    [PaymentState.UNDERPAID, PaymentState.EXPIRED],
    [PaymentState.UNDERPAID, PaymentState.FAILED],
    // PROCESSING →
    [PaymentState.PROCESSING, PaymentState.PAYOUT_COMPLETE],
    [PaymentState.PROCESSING, PaymentState.CONVERTED],
    [PaymentState.PROCESSING, PaymentState.FAILED],
    // CONVERTED →
    [PaymentState.CONVERTED, PaymentState.PAYOUT_COMPLETE],
    [PaymentState.CONVERTED, PaymentState.FAILED],
    // PAYOUT_COMPLETE →
    [PaymentState.PAYOUT_COMPLETE, PaymentState.REFUNDED],
  ];

  test.each(validCases)("%s → %s is allowed", (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });
});

// ── 2. canTransition — Invalid Transitions ───────────────────────────────────

describe("canTransition — invalid transitions", () => {
  const invalidCases: [PaymentState, PaymentState][] = [
    // Can't skip states
    [PaymentState.PENDING, PaymentState.CONFIRMED],
    // FIX: pending → processing and pending → underpaid are now VALID (BUG-4 fix)
    [PaymentState.PENDING, PaymentState.PAYOUT_COMPLETE],
    [PaymentState.PENDING, PaymentState.CONVERTED],
    [PaymentState.PENDING, PaymentState.REFUNDED],
    // Can't go backward
    [PaymentState.DETECTED, PaymentState.PENDING],
    [PaymentState.CONFIRMED, PaymentState.DETECTED],
    [PaymentState.PROCESSING, PaymentState.CONFIRMED],
    [PaymentState.PAYOUT_COMPLETE, PaymentState.PROCESSING],
    // Terminal states can't transition (except payout→refunded and payout→payout)
    [PaymentState.FAILED, PaymentState.PENDING],
    [PaymentState.FAILED, PaymentState.PROCESSING],
    [PaymentState.FAILED, PaymentState.PAYOUT_COMPLETE],
    [PaymentState.EXPIRED, PaymentState.PENDING],
    [PaymentState.EXPIRED, PaymentState.DETECTED],
    [PaymentState.REFUNDED, PaymentState.PAYOUT_COMPLETE],
    [PaymentState.REFUNDED, PaymentState.PENDING],
    // Self-transitions not allowed (except payout_complete & processing which are idempotent)
    [PaymentState.PENDING, PaymentState.PENDING],
    [PaymentState.FAILED, PaymentState.FAILED],
    // Confirming can't go to underpaid
    [PaymentState.CONFIRMING, PaymentState.UNDERPAID],
    // Converted can't go back to processing
    [PaymentState.CONVERTED, PaymentState.PROCESSING],
  ];

  test.each(invalidCases)("%s → %s is rejected", (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });
});

// ── 3. transition() — Success Cases ─────────────────────────────────────────

describe("transition() — success", () => {
  it("returns a TransitionRecord on valid transition", () => {
    const result = transition(
      PaymentState.PENDING,
      PaymentState.DETECTED,
      "pay_abc123",
      "Transaction detected on BTC network",
    );

    expect(result).toMatchObject({
      from: PaymentState.PENDING,
      to: PaymentState.DETECTED,
      paymentId: "pay_abc123",
      reason: "Transaction detected on BTC network",
    });
    expect(result.timestamp).toBeDefined();
    // ISO-8601 format check
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
  });

  it("includes optional metadata in the record", () => {
    const meta = { txId: "0xabc", amount: 1.5, currency: "ETH" };
    const result = transition(
      PaymentState.DETECTED,
      PaymentState.CONFIRMED,
      "pay_xyz",
      "Fast-confirm chain",
      meta,
    );

    expect(result.metadata).toEqual(meta);
  });

  it("works without reason or metadata", () => {
    const result = transition(
      PaymentState.PROCESSING,
      PaymentState.PAYOUT_COMPLETE,
      "pay_no_reason",
    );

    expect(result.from).toBe(PaymentState.PROCESSING);
    expect(result.to).toBe(PaymentState.PAYOUT_COMPLETE);
    expect(result.reason).toBeUndefined();
    expect(result.metadata).toBeUndefined();
  });
});

// ── 4. transition() — Failure Cases ─────────────────────────────────────────

describe("transition() — throws InvalidTransitionError", () => {
  it("throws on invalid transition", () => {
    expect(() =>
      transition(PaymentState.PENDING, PaymentState.PAYOUT_COMPLETE, "pay_bad")
    ).toThrow(InvalidTransitionError);
  });

  it("error contains from, to, and paymentId", () => {
    try {
      transition(PaymentState.FAILED, PaymentState.PROCESSING, "pay_err");
      fail("Expected InvalidTransitionError");
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidTransitionError);
      const e = err as InvalidTransitionError;
      expect(e.from).toBe(PaymentState.FAILED);
      expect(e.to).toBe(PaymentState.PROCESSING);
      expect(e.paymentId).toBe("pay_err");
      expect(e.message).toContain("Invalid state transition");
      expect(e.message).toContain("failed → processing");
    }
  });

  it("error message lists allowed transitions", () => {
    try {
      transition(PaymentState.PENDING, PaymentState.CONFIRMED, "pay_msg");
    } catch (err) {
      const e = err as InvalidTransitionError;
      expect(e.message).toContain("detected");
      expect(e.message).toContain("expired");
      expect(e.message).toContain("failed");
    }
  });

  it("throws for self-transition", () => {
    // PENDING has no idempotent self-loop (unlike PROCESSING / PAYOUT_COMPLETE)
    expect(() =>
      transition(PaymentState.PENDING, PaymentState.PENDING, "pay_self")
    ).toThrow(InvalidTransitionError);
  });

  it("allows idempotent PROCESSING self-transition (retry/recovery)", () => {
    expect(() =>
      transition(PaymentState.PROCESSING, PaymentState.PROCESSING, "pay_retry")
    ).not.toThrow();
  });
});

// ── 5. isTerminal ────────────────────────────────────────────────────────────

describe("isTerminal", () => {
  it("PAYOUT_COMPLETE is terminal", () => {
    expect(isTerminal(PaymentState.PAYOUT_COMPLETE)).toBe(true);
  });

  it("FAILED is terminal", () => {
    expect(isTerminal(PaymentState.FAILED)).toBe(true);
  });

  it("EXPIRED is terminal", () => {
    expect(isTerminal(PaymentState.EXPIRED)).toBe(true);
  });

  it("REFUNDED is terminal", () => {
    expect(isTerminal(PaymentState.REFUNDED)).toBe(true);
  });

  it("PENDING is not terminal", () => {
    expect(isTerminal(PaymentState.PENDING)).toBe(false);
  });

  it("PROCESSING is not terminal", () => {
    expect(isTerminal(PaymentState.PROCESSING)).toBe(false);
  });

  it("UNDERPAID is not terminal", () => {
    expect(isTerminal(PaymentState.UNDERPAID)).toBe(false);
  });

  it("CONVERTED is not terminal", () => {
    expect(isTerminal(PaymentState.CONVERTED)).toBe(false);
  });
});

// ── 6. getAllowedTransitions ─────────────────────────────────────────────────

describe("getAllowedTransitions", () => {
  it("returns correct transitions for PENDING", () => {
    const allowed = getAllowedTransitions(PaymentState.PENDING);
    expect(allowed).toContain(PaymentState.DETECTED);
    expect(allowed).toContain(PaymentState.PROCESSING);  // BUG-4 fix: fast-confirm chains skip DETECTED
    expect(allowed).toContain(PaymentState.UNDERPAID);    // BUG-4 fix: partial payments
    expect(allowed).toContain(PaymentState.EXPIRED);
    expect(allowed).toContain(PaymentState.FAILED);
    expect(allowed).toHaveLength(5);
  });

  it("returns correct transitions for DETECTED", () => {
    const allowed = getAllowedTransitions(PaymentState.DETECTED);
    expect(allowed).toHaveLength(5);
    expect(allowed).toContain(PaymentState.CONFIRMING);
    expect(allowed).toContain(PaymentState.CONFIRMED);
    expect(allowed).toContain(PaymentState.PROCESSING);
    expect(allowed).toContain(PaymentState.UNDERPAID);
    expect(allowed).toContain(PaymentState.FAILED);
  });

  it("returns empty array for terminal states with no transitions", () => {
    expect(getAllowedTransitions(PaymentState.FAILED)).toEqual([]);
    expect(getAllowedTransitions(PaymentState.EXPIRED)).toEqual([]);
    expect(getAllowedTransitions(PaymentState.REFUNDED)).toEqual([]);
  });

  it("PAYOUT_COMPLETE can go to PAYOUT_COMPLETE (idempotent) or REFUNDED", () => {
    const allowed = getAllowedTransitions(PaymentState.PAYOUT_COMPLETE);
    expect(allowed).toContain(PaymentState.PAYOUT_COMPLETE); // BUG-5 fix: idempotent self-transition
    expect(allowed).toContain(PaymentState.REFUNDED);
    expect(allowed).toHaveLength(2);
  });
});

// ── 7. parseState — Direct Matches ──────────────────────────────────────────

describe("parseState — direct enum values", () => {
  it("parses all PaymentState values correctly", () => {
    for (const state of ALL_STATES) {
      expect(parseState(state)).toBe(state);
    }
  });

  it("handles case insensitivity", () => {
    expect(parseState("PENDING")).toBe(PaymentState.PENDING);
    expect(parseState("Detected")).toBe(PaymentState.DETECTED);
    expect(parseState("PAYOUT_COMPLETE")).toBe(PaymentState.PAYOUT_COMPLETE);
  });

  it("trims whitespace", () => {
    expect(parseState("  pending  ")).toBe(PaymentState.PENDING);
    expect(parseState(" failed\n")).toBe(PaymentState.FAILED);
  });
});

// ── 8. parseState — Legacy Aliases ──────────────────────────────────────────

describe("parseState — legacy aliases", () => {
  it("maps 'successful' to PAYOUT_COMPLETE", () => {
    expect(parseState("successful")).toBe(PaymentState.PAYOUT_COMPLETE);
  });

  it("maps 'completed' to PAYOUT_COMPLETE", () => {
    expect(parseState("completed")).toBe(PaymentState.PAYOUT_COMPLETE);
  });

  it("maps 'recovered' to PAYOUT_COMPLETE", () => {
    expect(parseState("recovered")).toBe(PaymentState.PAYOUT_COMPLETE);
  });

  it("maps 'done' to PAYOUT_COMPLETE", () => {
    expect(parseState("done")).toBe(PaymentState.PAYOUT_COMPLETE);
  });

  it("maps 'retrying' to PROCESSING", () => {
    expect(parseState("retrying")).toBe(PaymentState.PROCESSING);
  });

  it("maps 'pending_deposit' to PENDING", () => {
    expect(parseState("pending_deposit")).toBe(PaymentState.PENDING);
  });

  it("maps 'paid' to DETECTED", () => {
    expect(parseState("paid")).toBe(PaymentState.DETECTED);
  });

  it("maps 'incomplete' to UNDERPAID", () => {
    expect(parseState("incomplete")).toBe(PaymentState.UNDERPAID);
  });
});

// ── 9. parseState — Invalid Inputs ──────────────────────────────────────────

describe("parseState — invalid inputs", () => {
  it("returns undefined for null", () => {
    expect(parseState(null)).toBeUndefined();
  });

  it("returns undefined for undefined", () => {
    expect(parseState(undefined)).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(parseState("")).toBeUndefined();
  });

  it("returns undefined for unrecognized string", () => {
    expect(parseState("garbage")).toBeUndefined();
    expect(parseState("active")).toBeUndefined();
    expect(parseState("in_progress")).toBeUndefined();
  });
});

// ── 10. getTransitionMap ─────────────────────────────────────────────────────

describe("getTransitionMap", () => {
  it("returns a map for all states", () => {
    const map = getTransitionMap();
    expect(Object.keys(map)).toHaveLength(ALL_STATES.length);
    for (const state of ALL_STATES) {
      expect(map[state]).toBeDefined();
      expect(Array.isArray(map[state])).toBe(true);
    }
  });

  it("terminal states have empty arrays (except payout_complete)", () => {
    const map = getTransitionMap();
    expect(map[PaymentState.FAILED]).toEqual([]);
    expect(map[PaymentState.EXPIRED]).toEqual([]);
    expect(map[PaymentState.REFUNDED]).toEqual([]);
  });

  it("payout_complete allows self-transition and refunded", () => {
    const map = getTransitionMap();
    expect(map[PaymentState.PAYOUT_COMPLETE]).toContain(PaymentState.PAYOUT_COMPLETE); // BUG-5 fix
    expect(map[PaymentState.PAYOUT_COMPLETE]).toContain(PaymentState.REFUNDED);
    expect(map[PaymentState.PAYOUT_COMPLETE]).toHaveLength(2);
  });
});

// ── 11. Full Lifecycle Paths ─────────────────────────────────────────────────

describe("full lifecycle paths", () => {
  it("happy path: pending → detected → confirmed → processing → payout_complete", () => {
    const paymentId = "pay_happy";
    const records: TransitionRecord[] = [];

    records.push(transition(PaymentState.PENDING, PaymentState.DETECTED, paymentId, "tx detected"));
    records.push(transition(PaymentState.DETECTED, PaymentState.CONFIRMED, paymentId, "confirmations met"));
    records.push(transition(PaymentState.CONFIRMED, PaymentState.PROCESSING, paymentId, "settlement started"));
    records.push(transition(PaymentState.PROCESSING, PaymentState.PAYOUT_COMPLETE, paymentId, "funds delivered"));

    expect(records).toHaveLength(4);
    expect(records[0].from).toBe(PaymentState.PENDING);
    expect(records[3].to).toBe(PaymentState.PAYOUT_COMPLETE);
  });

  it("auto-conversion path: pending → detected → confirmed → converted → payout_complete", () => {
    const paymentId = "pay_convert";
    const records: TransitionRecord[] = [];

    records.push(transition(PaymentState.PENDING, PaymentState.DETECTED, paymentId));
    records.push(transition(PaymentState.DETECTED, PaymentState.CONFIRMED, paymentId));
    records.push(transition(PaymentState.CONFIRMED, PaymentState.CONVERTED, paymentId, "binance conversion"));
    records.push(transition(PaymentState.CONVERTED, PaymentState.PAYOUT_COMPLETE, paymentId, "USDT sent"));

    expect(records).toHaveLength(4);
    expect(records[2].to).toBe(PaymentState.CONVERTED);
  });

  it("underpayment recovery path: pending → detected → underpaid → detected → confirmed → processing → payout_complete", () => {
    const paymentId = "pay_partial";
    const records: TransitionRecord[] = [];

    records.push(transition(PaymentState.PENDING, PaymentState.DETECTED, paymentId));
    records.push(transition(PaymentState.DETECTED, PaymentState.UNDERPAID, paymentId, "partial amount"));
    records.push(transition(PaymentState.UNDERPAID, PaymentState.DETECTED, paymentId, "completion payment"));
    records.push(transition(PaymentState.DETECTED, PaymentState.CONFIRMED, paymentId));
    records.push(transition(PaymentState.CONFIRMED, PaymentState.PROCESSING, paymentId));
    records.push(transition(PaymentState.PROCESSING, PaymentState.PAYOUT_COMPLETE, paymentId));

    expect(records).toHaveLength(6);
  });

  it("underpayment expiry path: pending → detected → underpaid → expired", () => {
    const paymentId = "pay_expired";

    transition(PaymentState.PENDING, PaymentState.DETECTED, paymentId);
    transition(PaymentState.DETECTED, PaymentState.UNDERPAID, paymentId);
    const final = transition(PaymentState.UNDERPAID, PaymentState.EXPIRED, paymentId, "grace period lapsed");

    expect(final.to).toBe(PaymentState.EXPIRED);
    expect(isTerminal(final.to)).toBe(true);
  });

  it("failure at processing: pending → detected → confirmed → processing → failed", () => {
    const paymentId = "pay_fail";

    transition(PaymentState.PENDING, PaymentState.DETECTED, paymentId);
    transition(PaymentState.DETECTED, PaymentState.CONFIRMED, paymentId);
    transition(PaymentState.CONFIRMED, PaymentState.PROCESSING, paymentId);
    const final = transition(PaymentState.PROCESSING, PaymentState.FAILED, paymentId, "settlement error");

    expect(final.to).toBe(PaymentState.FAILED);
    // Can't transition out of FAILED
    expect(() =>
      transition(PaymentState.FAILED, PaymentState.PROCESSING, paymentId)
    ).toThrow(InvalidTransitionError);
  });

  it("refund after payout: payout_complete → refunded", () => {
    const record = transition(
      PaymentState.PAYOUT_COMPLETE,
      PaymentState.REFUNDED,
      "pay_refund",
      "customer requested refund",
    );

    expect(record.to).toBe(PaymentState.REFUNDED);
    expect(isTerminal(record.to)).toBe(true);
  });

  it("fast-confirm chain skips CONFIRMING: detected → processing directly", () => {
    const paymentId = "pay_fast";

    transition(PaymentState.PENDING, PaymentState.DETECTED, paymentId);
    const record = transition(PaymentState.DETECTED, PaymentState.PROCESSING, paymentId, "TRX fast-confirm");

    expect(record.to).toBe(PaymentState.PROCESSING);
  });
});

// ── 12. ALL_STATES constant ──────────────────────────────────────────────────

describe("ALL_STATES", () => {
  it("contains all 11 states", () => {
    expect(ALL_STATES).toHaveLength(11);
  });

  it("contains every PaymentState enum value", () => {
    expect(ALL_STATES).toContain(PaymentState.PENDING);
    expect(ALL_STATES).toContain(PaymentState.DETECTED);
    expect(ALL_STATES).toContain(PaymentState.CONFIRMING);
    expect(ALL_STATES).toContain(PaymentState.CONFIRMED);
    expect(ALL_STATES).toContain(PaymentState.UNDERPAID);
    expect(ALL_STATES).toContain(PaymentState.PROCESSING);
    expect(ALL_STATES).toContain(PaymentState.CONVERTED);
    expect(ALL_STATES).toContain(PaymentState.PAYOUT_COMPLETE);
    expect(ALL_STATES).toContain(PaymentState.FAILED);
    expect(ALL_STATES).toContain(PaymentState.EXPIRED);
    expect(ALL_STATES).toContain(PaymentState.REFUNDED);
  });
});

// ── 13. Transition map completeness ──────────────────────────────────────────

describe("transition map completeness", () => {
  it("every state has an entry in the transition map", () => {
    const map = getTransitionMap();
    for (const state of ALL_STATES) {
      expect(map).toHaveProperty(state);
    }
  });

  it("every target in the map is a valid PaymentState", () => {
    const map = getTransitionMap();
    const validStates = new Set(ALL_STATES);
    for (const targets of Object.values(map)) {
      for (const target of targets) {
        expect(validStates.has(target as PaymentState)).toBe(true);
      }
    }
  });

  it("every state can reach a terminal state", () => {
    // BFS from each non-terminal state to verify reachability to a terminal
    const map = getTransitionMap();

    for (const startState of ALL_STATES) {
      if (isTerminal(startState)) continue;

      const visited = new Set<string>();
      const queue: string[] = [startState];
      let reachesTerminal = false;

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current)) continue;
        visited.add(current);

        if (isTerminal(current as PaymentState)) {
          reachesTerminal = true;
          break;
        }

        for (const next of map[current] || []) {
          if (!visited.has(next)) queue.push(next);
        }
      }

      expect(reachesTerminal).toBe(true);
    }
  });
});

// ── 14. toRedisStatus — Backward-compatible Redis status mapping ─────────────

describe("toRedisStatus — backward compatibility", () => {
  it("maps PENDING to 'pending' (what Redis stores)", () => {
    expect(toRedisStatus(PaymentState.PENDING)).toBe("pending");
  });

  it("maps DETECTED to 'pending' (merchants don't see 'detected')", () => {
    expect(toRedisStatus(PaymentState.DETECTED)).toBe("pending");
  });

  it("maps CONFIRMING to 'processing'", () => {
    expect(toRedisStatus(PaymentState.CONFIRMING)).toBe("processing");
  });

  it("maps CONFIRMED to 'processing'", () => {
    expect(toRedisStatus(PaymentState.CONFIRMED)).toBe("processing");
  });

  it("maps PROCESSING to 'processing'", () => {
    expect(toRedisStatus(PaymentState.PROCESSING)).toBe("processing");
  });

  it("maps UNDERPAID to 'underpaid'", () => {
    expect(toRedisStatus(PaymentState.UNDERPAID)).toBe("underpaid");
  });

  it("maps PAYOUT_COMPLETE to 'successful'", () => {
    expect(toRedisStatus(PaymentState.PAYOUT_COMPLETE)).toBe("successful");
  });

  it("maps CONVERTED to 'successful'", () => {
    expect(toRedisStatus(PaymentState.CONVERTED)).toBe("successful");
  });

  it("maps FAILED to 'failed'", () => {
    expect(toRedisStatus(PaymentState.FAILED)).toBe("failed");
  });

  it("maps EXPIRED to 'failed'", () => {
    expect(toRedisStatus(PaymentState.EXPIRED)).toBe("failed");
  });

  it("maps REFUNDED to 'successful'", () => {
    expect(toRedisStatus(PaymentState.REFUNDED)).toBe("successful");
  });

  it("every state has a Redis mapping", () => {
    for (const state of ALL_STATES) {
      expect(toRedisStatus(state)).toBeDefined();
      expect(typeof toRedisStatus(state)).toBe("string");
    }
  });
});

// ── 15. toExternalStatus — API response status mapping ───────────────────────

describe("toExternalStatus — merchant API compatibility", () => {
  it("maps PENDING to 'waiting' (no tx yet)", () => {
    expect(toExternalStatus(PaymentState.PENDING)).toBe("waiting");
  });

  it("maps DETECTED to 'pending'", () => {
    expect(toExternalStatus(PaymentState.DETECTED)).toBe("pending");
  });

  it("maps CONFIRMING to 'pending'", () => {
    expect(toExternalStatus(PaymentState.CONFIRMING)).toBe("pending");
  });

  it("maps CONFIRMED to 'confirmed'", () => {
    expect(toExternalStatus(PaymentState.CONFIRMED)).toBe("confirmed");
  });

  it("maps PROCESSING to 'processing'", () => {
    expect(toExternalStatus(PaymentState.PROCESSING)).toBe("processing");
  });

  it("maps UNDERPAID to 'underpaid'", () => {
    expect(toExternalStatus(PaymentState.UNDERPAID)).toBe("underpaid");
  });

  it("maps PAYOUT_COMPLETE to 'settled' (funds forwarded to merchant)", () => {
    expect(toExternalStatus(PaymentState.PAYOUT_COMPLETE)).toBe("settled");
  });

  it("maps CONVERTED to 'settled'", () => {
    expect(toExternalStatus(PaymentState.CONVERTED)).toBe("settled");
  });

  it("maps FAILED to 'failed'", () => {
    expect(toExternalStatus(PaymentState.FAILED)).toBe("failed");
  });

  it("maps EXPIRED to 'expired'", () => {
    expect(toExternalStatus(PaymentState.EXPIRED)).toBe("expired");
  });

  it("every state has an external mapping", () => {
    for (const state of ALL_STATES) {
      expect(toExternalStatus(state)).toBeDefined();
      expect(typeof toExternalStatus(state)).toBe("string");
    }
  });
});

// ── 16. toWebhookEvent — Merchant webhook event mapping ─────────────────────

describe("toWebhookEvent — webhook event names", () => {
  it("maps PENDING to 'payment.pending'", () => {
    expect(toWebhookEvent(PaymentState.PENDING)).toBe("payment.pending");
  });

  it("maps DETECTED to 'payment.pending'", () => {
    expect(toWebhookEvent(PaymentState.DETECTED)).toBe("payment.pending");
  });

  it("maps CONFIRMED to 'payment.confirmed'", () => {
    expect(toWebhookEvent(PaymentState.CONFIRMED)).toBe("payment.confirmed");
  });

  it("maps PAYOUT_COMPLETE to 'payment.settled'", () => {
    expect(toWebhookEvent(PaymentState.PAYOUT_COMPLETE)).toBe("payment.settled");
  });

  it("maps UNDERPAID to 'payment.underpaid'", () => {
    expect(toWebhookEvent(PaymentState.UNDERPAID)).toBe("payment.underpaid");
  });

  it("maps FAILED to 'payment.settlement_failed'", () => {
    expect(toWebhookEvent(PaymentState.FAILED)).toBe("payment.settlement_failed");
  });

  it("returns null for states without webhook events", () => {
    expect(toWebhookEvent(PaymentState.CONFIRMING)).toBeNull();
    expect(toWebhookEvent(PaymentState.PROCESSING)).toBeNull();
    expect(toWebhookEvent(PaymentState.CONVERTED)).toBeNull();
    expect(toWebhookEvent(PaymentState.EXPIRED)).toBeNull();
    expect(toWebhookEvent(PaymentState.REFUNDED)).toBeNull();
  });
});

// ── 17. validateTransition — Soft enforcement ────────────────────────────────

describe("validateTransition — soft enforcement", () => {
  it("returns valid=true with record for allowed transition", () => {
    const result = validateTransition(
      PaymentState.PENDING,
      PaymentState.DETECTED,
      "pay_soft_ok",
      "tx detected",
    );

    expect(result.valid).toBe(true);
    expect(result.record).toBeDefined();
    expect(result.record!.from).toBe(PaymentState.PENDING);
    expect(result.record!.to).toBe(PaymentState.DETECTED);
    expect(result.error).toBeUndefined();
  });

  it("returns valid=false with error for invalid transition (no throw)", () => {
    const result = validateTransition(
      PaymentState.PENDING,
      PaymentState.PAYOUT_COMPLETE,
      "pay_soft_bad",
    );

    expect(result.valid).toBe(false);
    expect(result.record).toBeUndefined();
    expect(result.error).toContain("Invalid state transition");
    expect(result.error).toContain("pending → payout_complete");
  });

  it("does not throw on invalid transition", () => {
    expect(() =>
      validateTransition(PaymentState.FAILED, PaymentState.PROCESSING, "pay_no_throw")
    ).not.toThrow();
  });

  it("includes allowed states in error message", () => {
    const result = validateTransition(
      PaymentState.PENDING,
      PaymentState.CONFIRMED,
      "pay_allowed",
    );

    expect(result.error).toContain("detected");
    expect(result.error).toContain("expired");
    expect(result.error).toContain("failed");
  });

  it("includes optional metadata in the record", () => {
    const meta = { txId: "0xabc" };
    const result = validateTransition(
      PaymentState.DETECTED,
      PaymentState.CONFIRMED,
      "pay_meta",
      "fast confirm",
      meta,
    );

    expect(result.valid).toBe(true);
    expect(result.record!.metadata).toEqual(meta);
  });
});

// ── 18. Round-trip: parseState → toRedisStatus consistency ───────────────────

describe("round-trip consistency", () => {
  it("parseState(toRedisStatus(state)) returns a valid PaymentState for all states", () => {
    for (const state of ALL_STATES) {
      const redis = toRedisStatus(state);
      const parsed = parseState(redis);
      expect(parsed).toBeDefined();
    }
  });

  it("legacy Redis statuses round-trip correctly through parseState", () => {
    // These are the actual strings stored in Redis today
    const legacyStatuses = ["pending", "processing", "successful", "failed", "underpaid", "retrying", "recovered", "completed"];
    for (const legacy of legacyStatuses) {
      const parsed = parseState(legacy);
      expect(parsed).toBeDefined();
    }
  });

  it("toExternalStatus matches what verifyCryptoPayment returns for each internal state", () => {
    // The verify endpoint / merchant API returns these exact strings to merchants
    const expectedExternals = new Set([
      "waiting", "pending", "confirmed", "underpaid",
      "processing", "settled", "failed", "expired", "refunded",
    ]);
    for (const state of ALL_STATES) {
      const ext = toExternalStatus(state);
      expect(expectedExternals.has(ext)).toBe(true);
    }
  });
});

