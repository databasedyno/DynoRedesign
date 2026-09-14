import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Button, CircularProgress, Divider, Stack, Typography, useTheme } from "@mui/material";
import { GroupAddRounded, PersonAddAlt1Rounded } from "@mui/icons-material";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";

import axiosBaseApi from "@/axiosConfig";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { rootReducer } from "@/utils/types";
import useTokenData from "@/hooks/useTokenData";
import { useSelectedCompanyId } from "@/contexts/CompanyDataContext";
import TeamActivityPanel from "./TeamActivityPanel";
import { Catalogue, Member, Toast, apiErrorMessage } from "./teamTypes";
import TeamMemberRow from "./TeamMemberRow";
import TeamMemberDialog, { useTeamMemberDialog } from "./TeamMemberDialog";
import { TeamResendDialog, TeamRevokeDialog } from "./TeamSmallDialogs";
import { brandFg } from "@/constants/theme";

/**
 * Team Members / RBAC — owner-facing management panel (Settings -> Team).
 * Only the company Owner or a teammate with `manage_team` can load/use this;
 * the backend enforces that (a 403 simply shows an empty state here).
 */
const TeamSettingsSection: React.FC = () => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const { t } = useTranslation("common");
  const companyId = useSelectedCompanyId();
  const tokenData = useTokenData();
  const reduxEmail = useSelector((s: rootReducer) => {
    const u = s.userReducer as { email?: string; profile?: { email?: string } | null };
    return String(u?.email || u?.profile?.email || "");
  });
  // Owner's own email — used to stop them inviting themselves. Prefer redux (set
  // on login), fall back to the decoded JWT so it's reliable even on a hard refresh.
  const ownerEmail = (reduxEmail || tokenData?.email || "").toLowerCase();

  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const toast = useCallback<Toast>(
    (message, severity = "info") => {
      dispatch({ type: TOAST_SHOW, payload: { message, severity } });
    },
    [dispatch],
  );

  const [revokeTarget, setRevokeTarget] = useState<Member | null>(null);
  const [revoking, setRevoking] = useState(false);

  const [resendingId, setResendingId] = useState<number | null>(null);
  const [resendLink, setResendLink] = useState<string | null>(null);
  const [resendEmail, setResendEmail] = useState("");
  const [resendCopied, setResendCopied] = useState(false);

  const fetchMembers = useCallback(async () => {
    if (!companyId) {
      setMembers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setForbidden(false);
    try {
      const res = await axiosBaseApi.get("team/members", { params: { company_id: companyId } });
      setMembers(res?.data?.data?.members || []);
    } catch (e: unknown) {
      if ((e as { response?: { status?: number } })?.response?.status === 403) {
        setForbidden(true);
      } else {
        toast(apiErrorMessage(e, "Couldn't load team members."), "error");
      }
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, toast]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await axiosBaseApi.get("team/permissions/catalogue");
        if (mounted) setCatalogue(res?.data?.data || null);
      } catch {
        /* non-fatal */
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const { openInvite, openEdit, dialogProps } = useTeamMemberDialog({ companyId, ownerEmail, catalogue, toast, onChanged: fetchMembers });

  const performRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      await axiosBaseApi.delete(`team/members/${revokeTarget.id}`);
      toast("Access revoked.", "success");
      setRevokeTarget(null);
      fetchMembers();
    } catch (e: unknown) {
      toast(apiErrorMessage(e, "Couldn't revoke access."), "error");
    } finally {
      setRevoking(false);
    }
  };

  const copyResend = async () => {
    if (!resendLink) return;
    try {
      await navigator.clipboard.writeText(resendLink);
      setResendCopied(true);
      setTimeout(() => setResendCopied(false), 2000);
    } catch {
      /* clipboard blocked — the link is still visible to copy manually */
    }
  };

  // Refresh a pending invite's link (re-issues the token; the old link stops working).
  const resend = async (m: Member) => {
    if (!companyId) return;
    setResendingId(m.id);
    try {
      const res = await axiosBaseApi.post("team/invite", { email: m.email, role: m.role, permissions: m.permissions, company_id: companyId });
      setResendLink(res?.data?.data?.invite_link || null);
      setResendEmail(m.email);
      setResendCopied(false);
      toast("Invite link refreshed.", "success");
      fetchMembers();
    } catch (e: unknown) {
      toast(apiErrorMessage(e, "Couldn't resend the invite."), "error");
    } finally {
      setResendingId(null);
    }
  };

  const activeMembers = useMemo(() => members.filter((m) => m.status !== "revoked"), [members]);
  const emptySx = { py: 6, textAlign: "center", border: `1px dashed ${theme.palette.divider}`, borderRadius: 2 } as const;

  return (
    <Box data-testid="team-settings-section">
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2, flexWrap: "wrap", gap: 1.5 }}>
        <Box>
          <Stack direction="row" alignItems="center" gap={1}>
            <GroupAddRounded sx={{ fontSize: 22, color: brandFg(theme.palette.mode === "dark") }} />
            <Typography variant="h6" fontWeight={700}>{t("team.title", { defaultValue: "Team" })}</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 560 }}>
            {t("team.subtitle", { defaultValue: "Invite teammates to help manage this business. You choose exactly what each person can access." })}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<PersonAddAlt1Rounded />}
          onClick={openInvite}
          disabled={!companyId || forbidden}
          data-testid="team-invite-button"
          sx={{ textTransform: "none", borderRadius: 2, fontWeight: 600 }}
        >
          {t("team.invite", { defaultValue: "Invite teammate" })}
        </Button>
      </Stack>

      {!companyId ? (
        <Typography color="text.secondary" sx={{ py: 6, textAlign: "center" }}>
          {t("team.selectCompany", { defaultValue: "Select a business first." })}
        </Typography>
      ) : forbidden ? (
        <Box sx={emptySx}>
          <Typography fontWeight={600}>{t("team.noAccessTitle", { defaultValue: "Owner access required" })}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {t("team.noAccessBody", { defaultValue: "Only the account owner (or a teammate with the Manage team permission) can manage the team." })}
          </Typography>
        </Box>
      ) : loading ? (
        <Box sx={{ py: 6, display: "flex", justifyContent: "center" }}>
          <CircularProgress size={26} />
        </Box>
      ) : activeMembers.length === 0 ? (
        <Box sx={emptySx}>
          <Typography fontWeight={600}>{t("team.emptyTitle", { defaultValue: "No teammates yet" })}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {t("team.emptyBody", { defaultValue: "Invite someone to manage payments, links or customers with you." })}
          </Typography>
        </Box>
      ) : (
        <Stack divider={<Divider />} sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 2, overflow: "hidden" }}>
          {activeMembers.map((m) => (
            <TeamMemberRow key={m.id} member={m} resending={resendingId === m.id} onEdit={openEdit} onResend={resend} onRevoke={setRevokeTarget} />
          ))}
        </Stack>
      )}

      <TeamActivityPanel />

      <TeamMemberDialog {...dialogProps} />
      <TeamRevokeDialog target={revokeTarget} revoking={revoking} onCancel={() => setRevokeTarget(null)} onConfirm={performRevoke} />
      <TeamResendDialog link={resendLink} email={resendEmail} copied={resendCopied} onCopy={copyResend} onClose={() => setResendLink(null)} />
    </Box>
  );
};

export default TeamSettingsSection;
