/**
 * Checkout status stream — buyer-facing real-time payment status (SSE).
 *
 * The checkout page used to discover "payment detected" / "confirmed" only by
 * polling verifyCryptoPayment every 10s, while the webhook pipeline moves from
 * detected → confirmed in ~3s. Buyers therefore jumped straight from "waiting"
 * to the paid card and never saw the intermediate steps.
 *
 * This module publishes lightweight status *hints* on a per-address SSE channel.
 * The payload deliberately carries no amounts or merchant data — the checkout
 * re-verifies through verifyCryptoPayment (the source of truth) on every hint.
 *
 * Channel: `checkout:<lowercased address>` (tag-based chains append `:<tag>`).
 * Delivery is in-process (same registry as merchant SSE) — prod runs a single
 * web instance; a Redis fan-out can be added if the web tier is ever scaled.
 */
import crypto from "crypto";
import type { Response } from "express";
import * as sseService from "./sseService";
import { log } from "../utils/loggers";

export type CheckoutStreamStatus =
  | "waiting"     // nothing seen yet
  | "pending"     // tx seen by the chain watcher (webhook received) — "payment detected"
  | "processing"  // on-chain verification / settlement running
  | "confirmed"   // settled — checkout should flip to the paid card
  | "underpaid"   // partial payment received, waiting for the remainder
  | "failed";     // verification failed

export const checkoutChannel = (address: string, destinationTag?: number | string | null): string => {
  const base = `checkout:${String(address || "").trim().toLowerCase()}`;
  return destinationTag ? `${base}:${destinationTag}` : base;
};

/**
 * Publish a status hint to every checkout tab watching `address`.
 * Never throws — a broken stream must never affect the money path.
 */
export const publishCheckoutStatus = (
  address: string | undefined | null,
  status: CheckoutStreamStatus,
  extra: Record<string, unknown> = {},
): number => {
  if (!address) return 0;
  try {
    const payload = { status, address, at: new Date().toISOString(), ...extra };
    let sent = sseService.sendToChannel(checkoutChannel(address), "status", payload);
    const tag = extra.destination_tag as number | string | undefined;
    if (tag) sent += sseService.sendToChannel(checkoutChannel(address, tag), "status", payload);
    if (sent > 0) log(`[CheckoutStream] ${status} → ${sent} client(s) for ${String(address).slice(0, 12)}…`, "info");
    return sent;
  } catch (err) {
    log(`[CheckoutStream] publish failed: ${(err as Error).message}`, "warn");
    return 0;
  }
};

/**
 * Attach an SSE response to the checkout channel for `address`.
 * Returns the client id (useful for tests / logging).
 */
export const attachCheckoutStream = (
  res: Response,
  address: string,
  destinationTag?: number | string | null,
): string => {
  const clientId = `checkout-${crypto.randomUUID()}`;
  const channels = [checkoutChannel(address)];
  if (destinationTag) channels.push(checkoutChannel(address, destinationTag));
  // userId 0 = anonymous buyer (channel-scoped delivery only)
  sseService.registerClient(clientId, 0, res, channels);
  return clientId;
};
