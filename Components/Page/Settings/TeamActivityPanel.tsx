import React, { useCallback, useEffect, useState } from "react";
import { Box, CircularProgress, Divider, Stack, Typography, useTheme } from "@mui/material";
import { HistoryRounded } from "@mui/icons-material";
import { useTranslation } from "react-i18next";

import axiosBaseApi from "@/axiosConfig";
import { useSelectedCompanyId } from "@/contexts/CompanyDataContext";

interface Activity {
  id: number;
  action: string;
  description: string | null;
  actor_name: string;
  actor_email: string | null;
  created_at: string;
}

const relTime = (iso: string): string => {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Math.max(0, Date.now() - then);
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
};

/**
 * Team Activity Log — read-only audit trail of write actions on this business
 * (who did what, and when). Owner or a teammate with manage_team; the backend
 * returns 403 otherwise, which simply hides the panel.
 */
const TeamActivityPanel: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation("common");
  const companyId = useSelectedCompanyId();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Activity[]>([]);
  const [hidden, setHidden] = useState(false);

  const fetchActivity = useCallback(async () => {
    if (!companyId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setHidden(false);
    try {
      const res = await axiosBaseApi.get("team/activity", { params: { company_id: companyId, limit: 50 } });
      setRows(res?.data?.data || []);
    } catch (e: unknown) {
      const err = e as { response?: { status?: number } };
      if (err?.response?.status === 403) setHidden(true);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  if (!companyId || hidden) return null;

  return (
    <Box data-testid="team-activity-panel" sx={{ mt: 4 }}>
      <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1.5 }}>
        <HistoryRounded sx={{ fontSize: 20, color: theme.palette.primary.main }} />
        <Typography variant="h6" fontWeight={700}>
          {t("team.activityTitle", { defaultValue: "Activity" })}
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 560 }}>
        {t("team.activitySubtitle", {
          defaultValue: "A record of changes made to this business — who did what, and when.",
        })}
      </Typography>

      {loading ? (
        <Box sx={{ py: 4, display: "flex", justifyContent: "center" }}>
          <CircularProgress size={22} />
        </Box>
      ) : rows.length === 0 ? (
        <Box sx={{ py: 5, textAlign: "center", border: `1px dashed ${theme.palette.divider}`, borderRadius: 2 }}>
          <Typography fontWeight={600}>{t("team.activityEmptyTitle", { defaultValue: "No activity yet" })}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {t("team.activityEmptyBody", { defaultValue: "Changes to settings, keys, wallets and the team will show up here." })}
          </Typography>
        </Box>
      ) : (
        <Stack
          divider={<Divider />}
          sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 2, overflow: "hidden" }}
        >
          {rows.map((r) => (
            <Stack
              key={r.id}
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ p: 1.75, gap: 1.5, flexWrap: "wrap" }}
              data-testid={`team-activity-row-${r.id}`}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography fontWeight={600} sx={{ fontSize: 14 }} noWrap>
                  {r.description || r.action}
                </Typography>
                <Typography variant="body2" color="text.secondary" noWrap>
                  {r.actor_name}
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                {relTime(r.created_at)}
              </Typography>
            </Stack>
          ))}
        </Stack>
      )}
    </Box>
  );
};

export default TeamActivityPanel;
