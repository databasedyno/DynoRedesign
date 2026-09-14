import { companyModel, teamActivityModel, userModel } from "../../models";
import { apiLogger } from "../../utils/loggers";
import { createNotification, NOTIFICATION_TYPES } from "../notificationController";
import { sendTeamMemberJoinedEmail } from "../../services/email/companyEmails";

interface Dv {
  dataValues?: Record<string, unknown>;
}
const dv = (row: unknown): Record<string, unknown> =>
  (row as Dv).dataValues || (row as Record<string, unknown>);

/**
 * Best-effort owner alert when an invitee accepts: in-app notification + audit
 * row + (prod-only) email. NEVER throws — the accept flow must not depend on it.
 */
export async function notifyInviteAccepted(
  companyIds: number[],
  memberUserId: number,
  memberEmail: string,
  memberName: string | null
): Promise<void> {
  const who = memberName || memberEmail;
  for (const companyId of Array.from(new Set(companyIds))) {
    try {
      const company = await companyModel.findOne({ where: { company_id: companyId } });
      if (!company) continue;
      const c = dv(company) as { company_name?: string | null; user_id?: number };
      const ownerId = Number(c.user_id);
      if (!ownerId || ownerId === memberUserId) continue; // never notify the joiner themselves
      const companyName = c.company_name || `Business #${companyId}`;

      // (a) in-app notification for the owner (createNotification is best-effort)
      await createNotification(
        ownerId,
        NOTIFICATION_TYPES.TEAM_MEMBER_JOINED,
        "A teammate joined",
        `${who} accepted your invite and joined ${companyName}.`,
        { member_user_id: memberUserId, member_email: memberEmail, company_id: companyId },
        companyId
      );

      // (b) audit-trail row attributed to the joining member
      await teamActivityModel.create({
        company_id: companyId,
        actor_user_id: memberUserId,
        actor_email: memberEmail,
        action: "team.accept",
        description: "Joined the team",
        method: "POST",
        path: "/api/team/accept",
        status_code: 200,
        meta: null,
      });

      // (c) email the owner — suppressed in preview via DISABLE_OUTBOUND_EMAIL
      const owner = await userModel.findOne({ where: { user_id: ownerId } });
      const o = owner ? (dv(owner) as { email?: string; name?: string }) : null;
      if (o?.email) void sendTeamMemberJoinedEmail(o.email, o.name || "", who, memberEmail, companyName);
    } catch (e) {
      apiLogger.error(`[Team] notifyInviteAccepted failed for company ${companyId}:`, e);
    }
  }
}

export default notifyInviteAccepted;
