import express from "express";
import { teamActivityModel, userModel } from "../models";
import { errorResponseHelper, successResponseHelper } from "../helper";
import { apiLogger } from "../utils/loggers";
import { getRequestCompanyId } from "../middleware/teamPermissionMiddleware";

/**
 * Team Activity Log — the read path. GET /api/team/activity?company_id=&limit=
 * Access is gated by requirePermission("manage_team") on the route (owner passes;
 * a member needs the manage_team permission), so this handler just reads.
 */
export const getActivity = async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const companyId = getRequestCompanyId(req);
    if (!companyId) {
      return errorResponseHelper(res, 400, "company_id is required.");
    }
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "100"), 10) || 100, 1), 200);

    const rows = await teamActivityModel.findAll({
      where: { company_id: companyId },
      order: [["created_at", "DESC"]],
      limit,
    });

    const actorIds = [
      ...new Set(
        rows
          .map((r) => Number((r as unknown as { dataValues: { actor_user_id: number } }).dataValues.actor_user_id))
          .filter((n) => !Number.isNaN(n) && n > 0)
      ),
    ];
    const users = actorIds.length
      ? await userModel.findAll({ where: { user_id: actorIds } })
      : [];
    const nameById = new Map<number, string>();
    users.forEach((u) => {
      const dv = (u as unknown as { dataValues: { user_id: number; name?: string; email?: string } }).dataValues;
      nameById.set(Number(dv.user_id), dv.name || dv.email || "");
    });

    const data = rows.map((r) => {
      const dv = (r as unknown as { dataValues: Record<string, unknown> }).dataValues;
      return {
        ...dv,
        actor_name:
          nameById.get(Number(dv.actor_user_id)) || (dv.actor_email as string) || "Unknown",
      };
    });

    return successResponseHelper(res, 200, "Team activity", data);
  } catch (e) {
    apiLogger.error("[teamActivity] getActivity error:", e);
    return errorResponseHelper(res, 500, "Failed to load team activity.");
  }
};

export default { getActivity };
