import express from "express";
import authMiddleware from "../middleware/authMiddleware";
import { requirePermission } from "../middleware/teamPermissionMiddleware";
import { requireStepUp } from "../middleware/requireStepUp";
import { auditMutations } from "../utils/activityLog";
import { teamMemberModel } from "../models";
import {
  inviteMembers,
  listMembers,
  updateMember,
  revokeMember,
  permissionCatalogue,
  getInvite,
  acceptInvite,
} from "../controller/teamController";
import { getActivity } from "../controller/teamActivityController";

/**
 * Team Members / RBAC routes — mounted at /api/team (see routes/index.ts).
 *
 * Public (invitee not logged in yet):  GET /invite/:token, POST /accept
 * Authenticated management (Owner or manage_team permission, enforced in the
 * controller against the target company): everything else.
 */
const router = express.Router();

// Activity-log company resolver for team routes: invite carries company_id in the
// body; member routes (:id = tbl_team_member.id) resolve company via that row.
const resolveTeamCompany = async (req: express.Request): Promise<number | null> => {
  const b = parseInt(
    String((req.body && (req.body.company_id ?? (req.body.company_ids && req.body.company_ids[0]))) ?? ""),
    10
  );
  if (!Number.isNaN(b)) return b;
  const id = parseInt(String(req.params?.id ?? ""), 10);
  if (Number.isNaN(id)) return null;
  const row = await teamMemberModel.findOne({ where: { id } });
  return row
    ? Number((row as unknown as { dataValues: { company_id: number } }).dataValues.company_id)
    : null;
};
const auditTeam = auditMutations("team", { resolveCompany: resolveTeamCompany });

// ── Public invite-accept flow ──
router.get("/invite/:token", getInvite);
router.post("/accept", acceptInvite);

// ── Authenticated team management (mutations are audited to the activity log) ──
// Granting access (invite) and changing permissions are step-up gated (scope `team`).
router.post("/invite", authMiddleware, requireStepUp("team"), auditTeam, inviteMembers);
router.get("/members", authMiddleware, listMembers);
router.patch("/members/:id", authMiddleware, requireStepUp("team"), auditTeam, updateMember);
router.delete("/members/:id", authMiddleware, auditTeam, revokeMember);
router.get("/permissions/catalogue", authMiddleware, permissionCatalogue);

// ── Team Activity Log (owner or manage_team) ──
router.get("/activity", authMiddleware, requirePermission("manage_team"), getActivity);

export default router;
