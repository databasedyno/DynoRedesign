import express from "express";
import authMiddleware from "../middleware/authMiddleware";
import {
  inviteMembers,
  listMembers,
  updateMember,
  revokeMember,
  permissionCatalogue,
  getInvite,
  acceptInvite,
} from "../controller/teamController";

/**
 * Team Members / RBAC routes — mounted at /api/team (see routes/index.ts).
 *
 * Public (invitee not logged in yet):  GET /invite/:token, POST /accept
 * Authenticated management (Owner or manage_team permission, enforced in the
 * controller against the target company): everything else.
 */
const router = express.Router();

// ── Public invite-accept flow ──
router.get("/invite/:token", getInvite);
router.post("/accept", acceptInvite);

// ── Authenticated team management ──
router.post("/invite", authMiddleware, inviteMembers);
router.get("/members", authMiddleware, listMembers);
router.patch("/members/:id", authMiddleware, updateMember);
router.delete("/members/:id", authMiddleware, revokeMember);
router.get("/permissions/catalogue", authMiddleware, permissionCatalogue);

export default router;
