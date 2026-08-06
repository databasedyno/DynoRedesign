import axiosBaseApi from "@/axiosConfig";
import { API_ENDPOINTS } from "@/api/endpoints";

/**
 * Tiny module-level cache of invoice PDF blobs so hovering an invoice row can
 * warm the PDF before the merchant clicks — the preview drawer then opens
 * instantly instead of showing a spinner while the blob downloads.
 *
 * Stores the in-flight/resolved Blob promise keyed by invoice id. Blobs (not
 * object URLs) are cached; each drawer open mints its own object URL from the
 * blob and revokes it on close, so there are no leaked URLs.
 */
const cache = new Map<number, Promise<Blob>>();

function fetchBlob(invoiceId: number): Promise<Blob> {
  const p = axiosBaseApi
    .get(API_ENDPOINTS.invoices.pdf(invoiceId), { responseType: "blob" })
    .then((res) => new Blob([res.data], { type: "application/pdf" }))
    .catch((e) => {
      // Drop failed entries so a later real open can retry.
      cache.delete(invoiceId);
      throw e;
    });
  cache.set(invoiceId, p);
  return p;
}

/** Warm the PDF for `invoiceId` (no-op if already cached/in-flight). */
export function prefetchInvoicePdf(invoiceId?: number | null): void {
  if (!invoiceId || cache.has(invoiceId)) return;
  fetchBlob(invoiceId);
}

/** Get the (possibly prefetched) PDF blob for `invoiceId`. */
export function getInvoicePdf(invoiceId: number): Promise<Blob> {
  return cache.get(invoiceId) ?? fetchBlob(invoiceId);
}
