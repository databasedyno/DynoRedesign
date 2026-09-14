/**
 * crowdfundingController — Phase 3.2 CRUD endpoints for the GoFundMe-lite
 * features: tiers, updates feed, expanded donor wall, organizer replies.
 *
 * All endpoints assume the parent link is a `link_type='donation'`. The
 * merchant-owned endpoints (create/update/delete tier/update) require the
 * session JWT + must verify ownership against the parent link's user_id.
 * Public endpoints (list tiers, list updates, donor wall) do NOT require
 * auth — they're read-only projections of the campaign.
 */

import express from "express";
import { Op } from "sequelize";
import { QueryTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";
import paymentLinkModel from "../../models/userModels/paymentLinkModel";
import donationTierModel from "../../models/userModels/donationTierModel";
import donationUpdateModel from "../../models/userModels/donationUpdateModel";
import {
  successResponseHelper,
  errorResponseHelper,
} from "../../helper";
import { handleControllerError } from "../../helper/controllerErrorHandler";
import { apiLogger } from "../../utils/loggers";
import { sendCrowdfundingUpdateEmail } from "../../services/emailService";

// ── Helpers ────────────────────────────────────────────────────────────────
/**
 * Resolve a payment-link parent by either its numeric ID (server-side) OR
 * by its public `d=<ref>` string (customer-side). Returns null when the
 * row doesn't exist or is not a donation parent.
 */
async function findDonationParent(refOrId: string | number) {
  let link;
  if (typeof refOrId === "number" || /^\d+$/.test(String(refOrId))) {
    link = await paymentLinkModel.findOne({
      where: { link_id: Number(refOrId), link_type: "donation" },
    });
  } else {
    link = await paymentLinkModel.findOne({
      where: {
        payment_link: { [Op.like]: `%d=${refOrId}%` },
        link_type: "donation",
      },
    });
  }
  return link;
}

/**
 * Ownership check — throws (via response) if the authenticated user doesn't
 * own the campaign or one of its co-organizers (co-organizers deferred to
 * Phase 3.3; for now, only owner).
 */
function ensureOwner(
  res: express.Response,
  link: any
): number | null {
  const authUser = res.locals.user as { user_id?: number } | undefined;
  if (!authUser?.user_id) {
    errorResponseHelper(res, 401, "Authentication required.");
    return null;
  }
  if (Number(authUser.user_id) !== Number(link.dataValues.user_id)) {
    errorResponseHelper(res, 403, "You are not the organizer of this campaign.");
    return null;
  }
  return Number(authUser.user_id);
}

/**
 * Fan out a crowdfunding update to every past contributor of a campaign.
 * Runs asynchronously (fire-and-forget) — never blocks the request that
 * created the update. Failures per-recipient are captured in the log.
 */
async function fanOutUpdateEmail(
  parentLink: any,
  updateId: number,
  updateTitle: string,
  updateBodyMd: string
): Promise<void> {
  try {
    const campaignTitle: string = String(parentLink.dataValues.title || "").trim() || "the campaign";
    const campaignLink: string = String(parentLink.dataValues.payment_link || "");
    const rows = (await sequelize.query(
      `SELECT DISTINCT ON (LOWER(email))
              email, donor_name
       FROM tbl_payment_link
       WHERE parent_link_id = :pid
         AND link_type = 'contribution'
         AND status = 'completed'
         AND email IS NOT NULL
         AND email <> ''`,
      {
        replacements: { pid: parentLink.dataValues.link_id },
        type: QueryTypes.SELECT,
      }
    )) as Array<{ email: string; donor_name: string | null }>;

    if (!rows.length) {
      apiLogger.info(`[fanOutUpdateEmail] update_id=${updateId} no contributors to notify`);
      return;
    }

    const results = await Promise.allSettled(
      rows.map((r) =>
        sendCrowdfundingUpdateEmail(
          r.email,
          r.donor_name || "",
          campaignTitle,
          updateTitle,
          updateBodyMd,
          campaignLink
        )
      )
    );
    const ok = results.filter((r) => r.status === "fulfilled").length;
    const fail = results.length - ok;
    apiLogger.info(
      `[fanOutUpdateEmail] update_id=${updateId} sent=${ok} failed=${fail} total=${rows.length}`
    );
  } catch (e) {
    apiLogger.error(`[fanOutUpdateEmail] update_id=${updateId} unexpected error:`, e);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TIERS — merchant CRUD + public list
// ═══════════════════════════════════════════════════════════════════════════

/** POST /api/payment/link/campaign/:linkId/tiers  (auth: owner) */
export const createTier = async (req: express.Request, res: express.Response) => {
  try {
    const { linkId } = req.params;
    const link = await findDonationParent(Number(linkId));
    if (!link) return errorResponseHelper(res, 404, "Campaign not found.");
    if (ensureOwner(res, link) === null) return;

    const { min_amount, title, description, image_url, order } = req.body || {};
    const minAmt = Number(min_amount);
    if (!isFinite(minAmt) || minAmt <= 0) {
      return errorResponseHelper(res, 400, "min_amount must be a positive number.");
    }
    if (!title || typeof title !== "string" || !title.trim()) {
      return errorResponseHelper(res, 400, "title is required.");
    }
    if (title.length > 200) {
      return errorResponseHelper(res, 400, "title is too long (max 200 characters).");
    }
    if (description && String(description).length > 2000) {
      return errorResponseHelper(res, 400, "description is too long (max 2,000 characters).");
    }
    if (image_url) {
      const u = String(image_url).trim();
      if (u.length > 512 || !/^(https?:\/\/|\/)/i.test(u)) {
        return errorResponseHelper(res, 400, "image_url must be a valid URL.");
      }
    }

    const created = await donationTierModel.create({
      parent_link_id: link.dataValues.link_id,
      min_amount: minAmt,
      title: String(title).trim(),
      description: description ? String(description).trim() : null,
      image_url: image_url || null,
      order: Number.isFinite(Number(order)) ? Number(order) : 0,
      is_active: true,
    } as any);

    apiLogger.info(`[createTier] tier_id=${created.dataValues.tier_id} campaign=${link.dataValues.link_id}`);
    return successResponseHelper(res, 201, "Tier created.", created);
  } catch (e) {
    handleControllerError(res, e, apiLogger, {});
  }
};

/** PATCH /api/payment/link/tier/:tierId  (auth: owner) */
export const updateTier = async (req: express.Request, res: express.Response) => {
  try {
    const { tierId } = req.params;
    const tier = await donationTierModel.findByPk(Number(tierId));
    if (!tier) return errorResponseHelper(res, 404, "Tier not found.");
    const parent = await paymentLinkModel.findByPk((tier.dataValues as any).parent_link_id);
    if (!parent) return errorResponseHelper(res, 404, "Parent campaign not found.");
    if (ensureOwner(res, parent) === null) return;

    const patch: Record<string, unknown> = {};
    if (req.body.min_amount !== undefined) {
      const m = Number(req.body.min_amount);
      if (!isFinite(m) || m <= 0) return errorResponseHelper(res, 400, "min_amount must be a positive number.");
      patch.min_amount = m;
    }
    if (req.body.title !== undefined) {
      const t = String(req.body.title).trim();
      if (!t) return errorResponseHelper(res, 400, "title cannot be empty.");
      if (t.length > 200) return errorResponseHelper(res, 400, "title is too long (max 200).");
      patch.title = t;
    }
    if (req.body.description !== undefined) {
      patch.description = req.body.description ? String(req.body.description).slice(0, 2000) : null;
    }
    if (req.body.image_url !== undefined) {
      if (req.body.image_url === null || req.body.image_url === "") {
        patch.image_url = null;
      } else {
        const u = String(req.body.image_url).trim();
        if (u.length > 512 || !/^(https?:\/\/|\/)/i.test(u)) {
          return errorResponseHelper(res, 400, "image_url must be a valid URL.");
        }
        patch.image_url = u;
      }
    }
    if (req.body.order !== undefined) patch.order = Number(req.body.order) || 0;
    if (req.body.is_active !== undefined) patch.is_active = Boolean(req.body.is_active);

    await tier.update(patch);
    return successResponseHelper(res, 200, "Tier updated.", tier);
  } catch (e) {
    handleControllerError(res, e, apiLogger, {});
  }
};

/** DELETE /api/payment/link/tier/:tierId  (auth: owner) */
export const deleteTier = async (req: express.Request, res: express.Response) => {
  try {
    const { tierId } = req.params;
    const tier = await donationTierModel.findByPk(Number(tierId));
    if (!tier) return errorResponseHelper(res, 404, "Tier not found.");
    const parent = await paymentLinkModel.findByPk((tier.dataValues as any).parent_link_id);
    if (!parent) return errorResponseHelper(res, 404, "Parent campaign not found.");
    if (ensureOwner(res, parent) === null) return;

    await tier.destroy();
    return successResponseHelper(res, 200, "Tier deleted.", { tier_id: Number(tierId) });
  } catch (e) {
    handleControllerError(res, e, apiLogger, {});
  }
};

/** GET /api/payment/link/campaign/:refOrId/tiers  (public) */
export const listTiers = async (req: express.Request, res: express.Response) => {
  try {
    const { refOrId } = req.params;
    const link = await findDonationParent(refOrId);
    if (!link) return errorResponseHelper(res, 404, "Campaign not found.");
    const tiers = await donationTierModel.findAll({
      where: { parent_link_id: link.dataValues.link_id, is_active: true },
      order: [["order", "ASC"], ["tier_id", "ASC"]],
    });
    return successResponseHelper(res, 200, "Tiers loaded.", tiers);
  } catch (e) {
    handleControllerError(res, e, apiLogger, {});
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// UPDATES FEED — merchant CRUD + public list
// ═══════════════════════════════════════════════════════════════════════════

/** POST /api/payment/link/campaign/:linkId/updates  (auth: owner) */
export const createUpdate = async (req: express.Request, res: express.Response) => {
  try {
    const { linkId } = req.params;
    const link = await findDonationParent(Number(linkId));
    if (!link) return errorResponseHelper(res, 404, "Campaign not found.");
    const authUserId = ensureOwner(res, link);
    if (authUserId === null) return;

    const { title, body_md, image_url, is_published, notify_contributors } = req.body || {};
    if (!title || typeof title !== "string" || !title.trim()) {
      return errorResponseHelper(res, 400, "title is required.");
    }
    if (title.length > 200) return errorResponseHelper(res, 400, "title is too long (max 200).");
    if (!body_md || typeof body_md !== "string" || !body_md.trim()) {
      return errorResponseHelper(res, 400, "body_md is required.");
    }
    if (body_md.length > 20000) return errorResponseHelper(res, 400, "body_md is too long (max 20,000).");
    if (image_url) {
      const u = String(image_url).trim();
      if (u.length > 512 || !/^(https?:\/\/|\/)/i.test(u)) {
        return errorResponseHelper(res, 400, "image_url must be a valid URL.");
      }
    }

    const created = await donationUpdateModel.create({
      campaign_link_id: link.dataValues.link_id,
      author_user_id: authUserId,
      title: String(title).trim(),
      body_md: String(body_md),
      image_url: image_url || null,
      is_published: is_published !== false,
      notify_contributors: Boolean(notify_contributors),
    } as any);

    // If notify_contributors, fan out emails to all past contributors. Best-
    // effort — never fails the request; runs after we return 201.
    if (notify_contributors) {
      void fanOutUpdateEmail(link, created.dataValues.update_id, String(title).trim(), String(body_md));
    }

    apiLogger.info(`[createUpdate] update_id=${created.dataValues.update_id} campaign=${link.dataValues.link_id}`);
    return successResponseHelper(res, 201, "Update created.", created);
  } catch (e) {
    handleControllerError(res, e, apiLogger, {});
  }
};

/** PATCH /api/payment/link/update/:updateId  (auth: owner) */
export const updateUpdate = async (req: express.Request, res: express.Response) => {
  try {
    const { updateId } = req.params;
    const upd = await donationUpdateModel.findByPk(Number(updateId));
    if (!upd) return errorResponseHelper(res, 404, "Update not found.");
    const parent = await paymentLinkModel.findByPk((upd.dataValues as any).campaign_link_id);
    if (!parent) return errorResponseHelper(res, 404, "Parent campaign not found.");
    if (ensureOwner(res, parent) === null) return;

    const patch: Record<string, unknown> = {};
    if (req.body.title !== undefined) {
      const t = String(req.body.title).trim();
      if (!t) return errorResponseHelper(res, 400, "title cannot be empty.");
      if (t.length > 200) return errorResponseHelper(res, 400, "title is too long (max 200).");
      patch.title = t;
    }
    if (req.body.body_md !== undefined) {
      const b = String(req.body.body_md);
      if (!b.trim()) return errorResponseHelper(res, 400, "body_md cannot be empty.");
      if (b.length > 20000) return errorResponseHelper(res, 400, "body_md is too long (max 20,000).");
      patch.body_md = b;
    }
    if (req.body.image_url !== undefined) {
      if (req.body.image_url === null || req.body.image_url === "") {
        patch.image_url = null;
      } else {
        const u = String(req.body.image_url).trim();
        if (u.length > 512 || !/^(https?:\/\/|\/)/i.test(u)) {
          return errorResponseHelper(res, 400, "image_url must be a valid URL.");
        }
        patch.image_url = u;
      }
    }
    if (req.body.is_published !== undefined) patch.is_published = Boolean(req.body.is_published);

    await upd.update(patch);
    return successResponseHelper(res, 200, "Update saved.", upd);
  } catch (e) {
    handleControllerError(res, e, apiLogger, {});
  }
};

/** DELETE /api/payment/link/update/:updateId  (auth: owner) */
export const deleteUpdate = async (req: express.Request, res: express.Response) => {
  try {
    const { updateId } = req.params;
    const upd = await donationUpdateModel.findByPk(Number(updateId));
    if (!upd) return errorResponseHelper(res, 404, "Update not found.");
    const parent = await paymentLinkModel.findByPk((upd.dataValues as any).campaign_link_id);
    if (!parent) return errorResponseHelper(res, 404, "Parent campaign not found.");
    if (ensureOwner(res, parent) === null) return;

    await upd.destroy();
    return successResponseHelper(res, 200, "Update deleted.", { update_id: Number(updateId) });
  } catch (e) {
    handleControllerError(res, e, apiLogger, {});
  }
};

/** GET /api/payment/link/campaign/:refOrId/updates  (public) */
export const listUpdates = async (req: express.Request, res: express.Response) => {
  try {
    const { refOrId } = req.params;
    const link = await findDonationParent(refOrId);
    if (!link) return errorResponseHelper(res, 404, "Campaign not found.");
    const updates = await donationUpdateModel.findAll({
      where: { campaign_link_id: link.dataValues.link_id, is_published: true },
      order: [["createdAt", "DESC"]],
      limit: 50,
    });
    return successResponseHelper(res, 200, "Updates loaded.", updates);
  } catch (e) {
    handleControllerError(res, e, apiLogger, {});
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// DONOR WALL — public paginated feed of contributions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/payment/link/campaign/:refOrId/wall?limit=&offset=&sort=recent|top  (public)
 * Returns the paginated donor wall: paid contribution rows with donor name /
 * message / amount / relative time / organizer reply.
 * Anonymous contributions never expose the donor's name — but their message
 * IS included (identity is opt-in per contribution).
 */
export const getDonorWall = async (req: express.Request, res: express.Response) => {
  try {
    const { refOrId } = req.params;
    const link = await findDonationParent(refOrId);
    if (!link) return errorResponseHelper(res, 404, "Campaign not found.");

    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const sort = String(req.query.sort || "recent");

    const orderClause = sort === "top" ? 'base_amount DESC, "createdAt" DESC' : '"createdAt" DESC';

    const rows = await sequelize.query(
      `SELECT link_id, donor_name, donor_message, is_anonymous, base_amount, base_currency, "createdAt",
              organizer_reply, organizer_reply_at
       FROM tbl_payment_link
       WHERE parent_link_id = :pid AND link_type = 'contribution' AND status = 'completed'
       ORDER BY ${orderClause}
       LIMIT :limit OFFSET :offset`,
      {
        replacements: { pid: link.dataValues.link_id, limit, offset },
        type: QueryTypes.SELECT,
      }
    ) as Array<Record<string, unknown>>;

    // Also return the total count so the frontend can drive pagination UI.
    const [{ count }] = (await sequelize.query(
      `SELECT count(*)::int as count
       FROM tbl_payment_link
       WHERE parent_link_id = :pid AND link_type = 'contribution' AND status = 'completed'`,
      { replacements: { pid: link.dataValues.link_id }, type: QueryTypes.SELECT }
    )) as Array<{ count: number }>;

    const items = rows.map((r) => ({
      contribution_id: r.link_id,
      name: r.is_anonymous ? null : r.donor_name || null,
      message: r.donor_message || null,
      amount: Number(r.base_amount) || 0,
      currency: r.base_currency,
      at: r.createdAt,
      organizer_reply: r.organizer_reply || null,
      organizer_reply_at: r.organizer_reply_at || null,
      is_anonymous: Boolean(r.is_anonymous),
    }));

    return successResponseHelper(res, 200, "Donor wall loaded.", {
      items,
      total: count,
      limit,
      offset,
      has_more: offset + items.length < count,
    });
  } catch (e) {
    handleControllerError(res, e, apiLogger, {});
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// ORGANIZER REPLY — reply to a specific contribution
// ═══════════════════════════════════════════════════════════════════════════

/** PATCH /api/payment/link/contribution/:contribId/reply  (auth: parent owner) */
export const setContributionReply = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { contribId } = req.params;
    const contrib = await paymentLinkModel.findByPk(Number(contribId));
    if (!contrib || contrib.dataValues.link_type !== "contribution") {
      return errorResponseHelper(res, 404, "Contribution not found.");
    }
    const parent = await paymentLinkModel.findByPk((contrib.dataValues as any).parent_link_id);
    if (!parent) return errorResponseHelper(res, 404, "Parent campaign not found.");
    if (ensureOwner(res, parent) === null) return;

    const { reply } = req.body || {};
    if (reply !== null && reply !== "" && (typeof reply !== "string" || reply.length > 2000)) {
      return errorResponseHelper(res, 400, "Reply must be a string ≤ 2,000 characters (or null to clear).");
    }
    await contrib.update({
      organizer_reply: reply ? String(reply).trim() : null,
      organizer_reply_at: reply ? new Date() : null,
    } as any);
    return successResponseHelper(res, 200, reply ? "Reply saved." : "Reply cleared.", {
      contribution_id: Number(contribId),
    });
  } catch (e) {
    handleControllerError(res, e, apiLogger, {});
  }
};
