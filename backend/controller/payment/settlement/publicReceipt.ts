import express from "express";
import { errorResponseHelper, getErrorMessage, successResponseHelper } from "../../../helper";
import { apiLogger } from "../../../utils/loggers";
import { generatePaymentReceipt, getReceiptFilename } from "../../../services/pdfReceiptService";
import {
  fromSnapshot,
  getReceiptByToken,
  isValidReceiptToken,
  buildReceiptUrl,
  toPublicReceipt,
} from "../../../services/receiptLinkService";

/**
 * Public (no auth) shareable receipt endpoints — the token IS the credential
 * (22 chars, ~128 bits). Responses are immutable snapshots, so they may be
 * cached briefly by the CDN. Rate-limited at the router.
 */

/** GET /pay/receipt/:token — public JSON for the /receipt/<token> page. */
export const getPublicReceipt = async (req: express.Request, res: express.Response) => {
  try {
    const token = String(req.params.token || "");
    if (!isValidReceiptToken(token)) return errorResponseHelper(res, 404, "Receipt not found");
    const found = await getReceiptByToken(token);
    if (!found) return errorResponseHelper(res, 404, "Receipt not found");
    res.setHeader("Cache-Control", "private, max-age=300");
    res.setHeader("X-Robots-Tag", "noindex");
    return successResponseHelper(res, 200, "Receipt", toPublicReceipt(found.token, found.snapshot));
  } catch (e) {
    apiLogger.error("[getPublicReceipt] " + getErrorMessage(e), new Error(e));
    return errorResponseHelper(res, 500, "Could not load receipt");
  }
};

/** GET /pay/receipt/:token/pdf — the same branded PDF, rendered from the snapshot. */
export const getPublicReceiptPdf = async (req: express.Request, res: express.Response) => {
  try {
    const token = String(req.params.token || "");
    if (!isValidReceiptToken(token)) return errorResponseHelper(res, 404, "Receipt not found");
    const found = await getReceiptByToken(token);
    if (!found) return errorResponseHelper(res, 404, "Receipt not found");
    const pdf = await generatePaymentReceipt(fromSnapshot(found.snapshot, buildReceiptUrl(found.token)));
    const filename = getReceiptFilename(found.snapshot.transactionId);
    const inline = String(req.query.inline || "") === "1";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${inline ? "inline" : "attachment"}; filename="${filename}"`);
    res.setHeader("Content-Length", String(pdf.length));
    res.setHeader("Cache-Control", "private, max-age=300");
    res.setHeader("X-Robots-Tag", "noindex");
    return res.status(200).send(pdf);
  } catch (e) {
    apiLogger.error("[getPublicReceiptPdf] " + getErrorMessage(e), new Error(e));
    return errorResponseHelper(res, 500, "Could not generate receipt");
  }
};
