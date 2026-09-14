/**
 * CampaignManager — merchant editor for a donation campaign's reward tiers
 * and update posts. Shown on the pay-link edit page when the merchant loads
 * a `link_type='donation'` campaign for editing.
 *
 * Two tabs:
 *   • Reward Tiers — organizer defines milestone reward cards ($50 → thank-you card, $500 → signed print).
 *   • Updates      — organizer posts campaign updates. Toggling "Notify contributors" fans out an email
 *                    to every past contributor on publish.
 *
 * Uses the crowdfundingController endpoints under `/api/pay/campaign/:id/{tiers,updates}` etc.
 */
import React, { useCallback, useEffect, useState } from "react";
import { formatDateTimeI18n } from "@/utils/formatDate";
import {
  Box,
  Button,
  CircularProgress,
  Switch,
  Tab,
  Tabs,
  Typography,
  useTheme,
} from "@mui/material";
import { Icon } from "@iconify/react";
import { useTranslation } from "react-i18next";
import axiosBaseApi from "@/axiosConfig";
import { API_ENDPOINTS } from "@/api/endpoints";

interface Tier {
  tier_id: number;
  min_amount: number;
  title: string;
  description?: string | null;
  image_url?: string | null;
  order?: number;
  is_active?: boolean;
}

interface CampaignUpdate {
  update_id: number;
  title: string;
  body_md: string;
  image_url?: string | null;
  is_published?: boolean;
  createdAt?: string;
  created_at?: string;
}

interface CampaignSupporter {
  contribution_id: number;
  name: string | null;
  message: string | null;
  amount: number;
  currency: string;
  at: string;
  organizer_reply: string | null;
  organizer_reply_at: string | null;
  is_anonymous?: boolean;
}

interface CampaignManagerProps {
  linkId: string | number;
  currency: string;
}

const CampaignManager = ({ linkId, currency }: CampaignManagerProps) => {
  const theme = useTheme();
  const { t } = useTranslation("createPaymentLinkScreen");
  const green = "#10B981";
  const [tab, setTab] = useState<"tiers" | "updates" | "supporters">("tiers");
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [updates, setUpdates] = useState<CampaignUpdate[]>([]);
  const [supporters, setSupporters] = useState<CampaignSupporter[]>([]);
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({});
  const [replyingId, setReplyingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>("");
  const [notice, setNotice] = useState<string>("");

  // ── new-tier form state ──
  const [tierDraft, setTierDraft] = useState({ title: "", min_amount: "", description: "" });
  const [editingTierId, setEditingTierId] = useState<number | null>(null);

  // ── new-update form state ──
  const [updateDraft, setUpdateDraft] = useState({ title: "", body_md: "", notify_contributors: false });
  const [editingUpdateId, setEditingUpdateId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [tiersRes, updatesRes, wallRes] = await Promise.all([
        axiosBaseApi.get(API_ENDPOINTS.pay.campaignTiers(linkId)),
        axiosBaseApi.get(API_ENDPOINTS.pay.campaignUpdates(linkId)),
        axiosBaseApi.get(API_ENDPOINTS.pay.campaignWall(linkId)),
      ]);
      setTiers(tiersRes.data?.data || []);
      setUpdates(updatesRes.data?.data || []);
      const wallItems: CampaignSupporter[] = wallRes.data?.data?.items || [];
      setSupporters(wallItems);
      setReplyDrafts(
        wallItems.reduce((acc: Record<number, string>, s) => {
          acc[s.contribution_id] = s.organizer_reply || "";
          return acc;
        }, {})
      );
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load campaign details.");
    } finally {
      setLoading(false);
    }
  }, [linkId]);

  useEffect(() => {
    if (linkId) void load();
  }, [linkId, load]);

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(""), 3500);
  };

  // ══════════════ TIER CRUD ══════════════
  const submitTier = async () => {
    if (busy) return;
    const min = Number(tierDraft.min_amount);
    if (!tierDraft.title.trim()) return setError("Tier title is required.");
    if (!isFinite(min) || min <= 0) return setError("Minimum amount must be positive.");
    setBusy(true);
    setError("");
    try {
      const body = {
        title: tierDraft.title.trim(),
        min_amount: min,
        description: tierDraft.description.trim() || null,
      };
      if (editingTierId) {
        await axiosBaseApi.patch(API_ENDPOINTS.pay.tier(editingTierId), body);
        showNotice("Tier updated.");
      } else {
        await axiosBaseApi.post(API_ENDPOINTS.pay.campaignTiers(linkId), body);
        showNotice("Tier added.");
      }
      setTierDraft({ title: "", min_amount: "", description: "" });
      setEditingTierId(null);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Could not save tier.");
    } finally {
      setBusy(false);
    }
  };

  const editTier = (tier: Tier) => {
    setEditingTierId(tier.tier_id);
    setTierDraft({
      title: tier.title,
      min_amount: String(tier.min_amount),
      description: tier.description || "",
    });
  };

  const cancelTierEdit = () => {
    setEditingTierId(null);
    setTierDraft({ title: "", min_amount: "", description: "" });
  };

  const deleteTier = async (tier_id: number) => {
    if (busy) return;
    if (!window.confirm("Delete this tier?")) return;
    setBusy(true);
    try {
      await axiosBaseApi.delete(API_ENDPOINTS.pay.tier(tier_id));
      showNotice("Tier deleted.");
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Delete failed.");
    } finally {
      setBusy(false);
    }
  };

  // ══════════════ UPDATE CRUD ══════════════
  const submitUpdate = async () => {
    if (busy) return;
    if (!updateDraft.title.trim()) return setError("Update title is required.");
    if (!updateDraft.body_md.trim()) return setError("Update body is required.");
    setBusy(true);
    setError("");
    try {
      if (editingUpdateId) {
        await axiosBaseApi.patch(API_ENDPOINTS.pay.update(editingUpdateId), {
          title: updateDraft.title.trim(),
          body_md: updateDraft.body_md,
        });
        showNotice("Update saved.");
      } else {
        await axiosBaseApi.post(API_ENDPOINTS.pay.campaignUpdates(linkId), {
          title: updateDraft.title.trim(),
          body_md: updateDraft.body_md,
          notify_contributors: updateDraft.notify_contributors,
        });
        showNotice(
          updateDraft.notify_contributors
            ? "Update posted & contributors notified."
            : "Update posted."
        );
      }
      setUpdateDraft({ title: "", body_md: "", notify_contributors: false });
      setEditingUpdateId(null);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Could not save update.");
    } finally {
      setBusy(false);
    }
  };

  const editUpdate = (u: CampaignUpdate) => {
    setEditingUpdateId(u.update_id);
    setUpdateDraft({ title: u.title, body_md: u.body_md, notify_contributors: false });
  };

  const cancelUpdateEdit = () => {
    setEditingUpdateId(null);
    setUpdateDraft({ title: "", body_md: "", notify_contributors: false });
  };

  const deleteUpdate = async (update_id: number) => {
    if (busy) return;
    if (!window.confirm("Delete this update?")) return;
    setBusy(true);
    try {
      await axiosBaseApi.delete(API_ENDPOINTS.pay.update(update_id));
      showNotice("Update deleted.");
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Delete failed.");
    } finally {
      setBusy(false);
    }
  };

  // ══════════════ DONOR-WALL REPLY ══════════════
  const submitReply = async (contribId: number, clear = false) => {
    if (replyingId) return;
    const text = clear ? "" : (replyDrafts[contribId] || "").trim();
    if (!clear && !text) return setError("Write a reply before posting.");
    setReplyingId(contribId);
    setError("");
    try {
      await axiosBaseApi.patch(API_ENDPOINTS.pay.contributionReply(contribId), {
        reply: clear ? null : text,
      });
      showNotice(clear ? "Reply removed." : "Reply posted — it now shows on your public wall.");
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Could not save your reply.");
    } finally {
      setReplyingId(null);
    }
  };

  // ── shared input styles ──
  const inputSx = {
    width: "100%",
    p: "10px 14px",
    borderRadius: "10px",
    border: `1px solid ${theme.palette.border.main}`,
    bgcolor: theme.palette.background.paper,
    color: theme.palette.text.primary,
    fontFamily: "var(--font-sans)",
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box" as const,
    "&:focus": { borderColor: green },
    "&::placeholder": { color: theme.palette.text.disabled },
  };
  const labelSx = {
    fontSize: "13px",
    fontFamily: "var(--font-sans)",
    fontWeight: 600,
    color: theme.palette.text.primary,
    mb: 0.5,
  };
  const cardSx = {
    p: 1.75,
    borderRadius: "10px",
    border: `1px solid ${theme.palette.border.main}`,
    backgroundColor:
      theme.palette.mode === "dark" ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.015)",
  };

  return (
    <Box
      data-testid="campaign-manager"
      sx={{
        mt: 3,
        p: { xs: 2, md: 3 },
        borderRadius: "14px",
        border: `1px solid ${theme.palette.border.main}`,
        bgcolor: theme.palette.background.paper,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
        <Icon icon="mdi:cog-outline" width={20} color={green} />
        <Typography sx={{ fontWeight: 700, fontSize: 16, color: theme.palette.text.primary }}>
          {t("campaignManagerTitle", { defaultValue: "Manage campaign" })}
        </Typography>
      </Box>
      <Typography sx={{ fontSize: 12.5, color: theme.palette.text.secondary, mb: 2 }}>
        {t("campaignManagerHelper", {
          defaultValue:
            "Add reward tiers to thank contributors, or post updates to keep them in the loop.",
        })}
      </Typography>

      <Tabs
        value={tab}
        onChange={(_, v) => {
          setTab(v);
          setError("");
        }}
        sx={{
          minHeight: 40,
          mb: 2,
          "& .MuiTab-root": {
            minHeight: 40,
            textTransform: "none",
            fontWeight: 600,
            fontFamily: "var(--font-sans)",
            fontSize: 13.5,
          },
          "& .Mui-selected": { color: `${green} !important` },
          "& .MuiTabs-indicator": { backgroundColor: green },
        }}
      >
        <Tab
          data-testid="cm-tab-tiers"
          value="tiers"
          label={`${t("campaignTabTiers", { defaultValue: "Reward tiers" })} · ${tiers.length}`}
        />
        <Tab
          data-testid="cm-tab-updates"
          value="updates"
          label={`${t("campaignTabUpdates", { defaultValue: "Updates" })} · ${updates.length}`}
        />
        <Tab
          data-testid="cm-tab-supporters"
          value="supporters"
          label={`${t("campaignTabSupporters", { defaultValue: "Supporters" })} · ${supporters.length}`}
        />
      </Tabs>

      {loading && (
        <Box sx={{ py: 4, display: "flex", justifyContent: "center" }}>
          <CircularProgress size={22} sx={{ color: green }} />
        </Box>
      )}

      {!loading && error && (
        <Typography
          data-testid="cm-error"
          sx={{
            fontSize: 12.5,
            color: theme.palette.error.main,
            mb: 1.5,
            p: "8px 12px",
            borderRadius: "8px",
            bgcolor: theme.palette.mode === "dark" ? "rgba(239,68,68,0.08)" : "rgba(239,68,68,0.06)",
          }}
        >
          {error}
        </Typography>
      )}
      {!loading && notice && (
        <Typography
          data-testid="cm-notice"
          sx={{
            fontSize: 12.5,
            color: green,
            mb: 1.5,
            p: "8px 12px",
            borderRadius: "8px",
            bgcolor:
              theme.palette.mode === "dark" ? "rgba(16,185,129,0.08)" : "rgba(16,185,129,0.06)",
          }}
        >
          {notice}
        </Typography>
      )}

      {/* ═══════ TIERS TAB ═══════ */}
      {!loading && tab === "tiers" && (
        <Box>
          {tiers.length === 0 ? (
            <Typography sx={{ fontSize: 13, color: theme.palette.text.secondary, mb: 2 }}>
              {t("noTiersYet", {
                defaultValue: "No reward tiers yet. Add one below to thank contributors.",
              })}
            </Typography>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25, mb: 2 }}>
              {tiers.map((tier) => (
                <Box key={tier.tier_id} data-testid={`cm-tier-${tier.tier_id}`} sx={cardSx}>
                  <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mb: 0.25 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: 14.5, flex: 1 }}>
                      {tier.title}
                    </Typography>
                    <Typography sx={{ fontWeight: 700, fontSize: 13, color: green }}>
                      {tier.min_amount} {currency}+
                    </Typography>
                  </Box>
                  {tier.description && (
                    <Typography
                      sx={{
                        fontSize: 12.5,
                        color: theme.palette.text.secondary,
                        whiteSpace: "pre-line",
                        mb: 0.5,
                      }}
                    >
                      {tier.description}
                    </Typography>
                  )}
                  <Box sx={{ display: "flex", gap: 0.75, mt: 1 }}>
                    <Button
                      size="small"
                      data-testid={`cm-tier-edit-${tier.tier_id}`}
                      onClick={() => editTier(tier)}
                      sx={{ textTransform: "none", fontSize: 12 }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="small"
                      data-testid={`cm-tier-delete-${tier.tier_id}`}
                      onClick={() => deleteTier(tier.tier_id)}
                      sx={{ textTransform: "none", fontSize: 12, color: theme.palette.error.main }}
                    >
                      {t("campaignDelete", { defaultValue: "Delete" })}
                    </Button>
                  </Box>
                </Box>
              ))}
            </Box>
          )}

          <Box sx={{ ...cardSx, mt: 1 }}>
            <Typography sx={{ ...labelSx, mb: 1 }}>
              {editingTierId
                ? t("editTier", { defaultValue: "Edit tier" })
                : t("addTier", { defaultValue: "Add a reward tier" })}
            </Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "2fr 1fr" }, gap: 1 }}>
              <Box
                component="input"
                data-testid="cm-tier-title-input"
                type="text"
                placeholder={t("tierTitlePlaceholder", {
                  defaultValue: "e.g. Named on the wall",
                }) as string}
                value={tierDraft.title}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setTierDraft({ ...tierDraft, title: e.target.value })
                }
                sx={inputSx}
              />
              <Box
                component="input"
                data-testid="cm-tier-min-input"
                type="number"
                inputMode="decimal"
                min="0"
                placeholder={`Min ${currency}`}
                value={tierDraft.min_amount}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setTierDraft({ ...tierDraft, min_amount: e.target.value })
                }
                sx={inputSx}
              />
            </Box>
            <Box
              component="textarea"
              data-testid="cm-tier-description-input"
              placeholder={t("tierDescriptionPlaceholder", {
                defaultValue: "What the contributor gets (optional)",
              }) as string}
              value={tierDraft.description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setTierDraft({ ...tierDraft, description: e.target.value })
              }
              rows={2}
              sx={{ ...inputSx, mt: 1, resize: "vertical" }}
            />
            <Box sx={{ display: "flex", gap: 1, mt: 1.25 }}>
              <Button
                data-testid="cm-tier-submit"
                variant="contained"
                disableElevation
                onClick={submitTier}
                disabled={busy}
                sx={{
                  bgcolor: green,
                  color: "#fff",
                  textTransform: "none",
                  fontWeight: 600,
                  "&:hover": { bgcolor: "#0F9E6E" },
                }}
              >
                {busy ? "Saving…" : editingTierId ? "Save changes" : "Add tier"}
              </Button>
              {editingTierId && (
                <Button
                  data-testid="cm-tier-cancel"
                  onClick={cancelTierEdit}
                  sx={{ textTransform: "none" }}
                >
                  {t("cancel")}
                </Button>
              )}
            </Box>
          </Box>
        </Box>
      )}

      {/* ═══════ UPDATES TAB ═══════ */}
      {!loading && tab === "updates" && (
        <Box>
          {updates.length === 0 ? (
            <Typography sx={{ fontSize: 13, color: theme.palette.text.secondary, mb: 2 }}>
              {t("noUpdatesYet", {
                defaultValue:
                  "No updates posted yet. Share progress with your supporters below.",
              })}
            </Typography>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25, mb: 2 }}>
              {updates.map((u) => (
                <Box key={u.update_id} data-testid={`cm-update-${u.update_id}`} sx={cardSx}>
                  <Typography sx={{ fontWeight: 700, fontSize: 14.5, mb: 0.25 }}>
                    {u.title}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: 11.5,
                      color: theme.palette.text.secondary,
                      mb: 0.5,
                    }}
                  >
                    {(u.createdAt || u.created_at) &&
                      formatDateTimeI18n(u.createdAt || u.created_at!)}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: 13,
                      color: theme.palette.text.primary,
                      whiteSpace: "pre-wrap",
                      mb: 0.5,
                    }}
                  >
                    {u.body_md.length > 240 ? u.body_md.slice(0, 240) + "…" : u.body_md}
                  </Typography>
                  <Box sx={{ display: "flex", gap: 0.75, mt: 1 }}>
                    <Button
                      size="small"
                      data-testid={`cm-update-edit-${u.update_id}`}
                      onClick={() => editUpdate(u)}
                      sx={{ textTransform: "none", fontSize: 12 }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="small"
                      data-testid={`cm-update-delete-${u.update_id}`}
                      onClick={() => deleteUpdate(u.update_id)}
                      sx={{ textTransform: "none", fontSize: 12, color: theme.palette.error.main }}
                    >
                      {t("campaignDelete", { defaultValue: "Delete" })}
                    </Button>
                  </Box>
                </Box>
              ))}
            </Box>
          )}

          <Box sx={{ ...cardSx, mt: 1 }}>
            <Typography sx={{ ...labelSx, mb: 1 }}>
              {editingUpdateId
                ? t("editUpdate", { defaultValue: "Edit update" })
                : t("postUpdate", { defaultValue: "Post an update" })}
            </Typography>
            <Box
              component="input"
              data-testid="cm-update-title-input"
              type="text"
              placeholder={t("updateTitlePlaceholder", {
                defaultValue: "e.g. Day 5 — We hit $2K, thank you!",
              }) as string}
              value={updateDraft.title}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setUpdateDraft({ ...updateDraft, title: e.target.value })
              }
              sx={inputSx}
            />
            <Box
              component="textarea"
              data-testid="cm-update-body-input"
              placeholder={t("updateBodyPlaceholder", {
                defaultValue:
                  "Share progress, thank supporters, or announce milestones. Markdown supported.",
              }) as string}
              value={updateDraft.body_md}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setUpdateDraft({ ...updateDraft, body_md: e.target.value })
              }
              rows={5}
              sx={{ ...inputSx, mt: 1, resize: "vertical", fontFamily: "var(--font-sans)" }}
            />
            {!editingUpdateId && (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  mt: 1,
                  p: "6px 10px",
                  borderRadius: "8px",
                  bgcolor:
                    theme.palette.mode === "dark"
                      ? "rgba(16,185,129,0.06)"
                      : "rgba(16,185,129,0.04)",
                }}
              >
                <Switch
                  data-testid="cm-update-notify-toggle"
                  size="small"
                  checked={updateDraft.notify_contributors}
                  onChange={(_, checked) =>
                    setUpdateDraft({ ...updateDraft, notify_contributors: checked })
                  }
                  sx={{
                    "& .MuiSwitch-switchBase.Mui-checked": { color: green },
                    "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                      backgroundColor: green,
                    },
                  }}
                />
                <Box>
                  <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
                    {t("notifyContributors", { defaultValue: "Email all contributors" })}
                  </Typography>
                  <Typography sx={{ fontSize: 11.5, color: theme.palette.text.secondary }}>
                    {t("notifyContributorsHelper", {
                      defaultValue:
                        "Send this update to everyone who has contributed to your campaign.",
                    })}
                  </Typography>
                </Box>
              </Box>
            )}
            <Box sx={{ display: "flex", gap: 1, mt: 1.25 }}>
              <Button
                data-testid="cm-update-submit"
                variant="contained"
                disableElevation
                onClick={submitUpdate}
                disabled={busy}
                sx={{
                  bgcolor: green,
                  color: "#fff",
                  textTransform: "none",
                  fontWeight: 600,
                  "&:hover": { bgcolor: "#0F9E6E" },
                }}
              >
                {busy
                  ? "Saving…"
                  : editingUpdateId
                    ? "Save changes"
                    : updateDraft.notify_contributors
                      ? "Post & notify"
                      : "Post update"}
              </Button>
              {editingUpdateId && (
                <Button
                  data-testid="cm-update-cancel"
                  onClick={cancelUpdateEdit}
                  sx={{ textTransform: "none" }}
                >
                  {t("cancel")}
                </Button>
              )}
            </Box>
          </Box>
        </Box>
      )}

      {/* ═══════ SUPPORTERS TAB ═══════ */}
      {!loading && tab === "supporters" && (
        <Box data-testid="cm-supporters-panel">
          {supporters.length === 0 ? (
            <Typography sx={{ fontSize: 13, color: theme.palette.text.secondary, mb: 2 }}>
              {t("noSupportersYet", {
                defaultValue:
                  "No contributions yet. Once people support your campaign, you can reply to them here.",
              })}
            </Typography>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
              <Typography sx={{ fontSize: 12, color: theme.palette.text.secondary, mb: 0.5 }}>
                {t("supportersHelper", {
                  defaultValue:
                    "Reply to a supporter to thank them. Your reply appears publicly under their message on the campaign page.",
                })}
              </Typography>
              {supporters.map((s) => {
                const displayName = s.is_anonymous || !s.name ? "Anonymous" : s.name;
                const draft = replyDrafts[s.contribution_id] ?? "";
                const isReplying = replyingId === s.contribution_id;
                return (
                  <Box
                    key={s.contribution_id}
                    data-testid={`cm-supporter-${s.contribution_id}`}
                    sx={cardSx}
                  >
                    <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mb: 0.25 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: 14, flex: 1 }}>
                        {displayName}
                      </Typography>
                      <Typography sx={{ fontWeight: 700, fontSize: 13, color: green }}>
                        {Number(s.amount).toLocaleString()} {s.currency}
                      </Typography>
                    </Box>
                    {s.at && (
                      <Typography sx={{ fontSize: 11, color: theme.palette.text.disabled, mb: 0.5 }}>
                        {formatDateTimeI18n(s.at)}
                      </Typography>
                    )}
                    {s.message && (
                      <Typography
                        sx={{
                          fontSize: 12.5,
                          color: theme.palette.text.secondary,
                          whiteSpace: "pre-wrap",
                          mb: 0.75,
                        }}
                      >
                        &ldquo;{s.message}&rdquo;
                      </Typography>
                    )}
                    <Box
                      component="textarea"
                      data-testid={`cm-supporter-reply-input-${s.contribution_id}`}
                      placeholder={t("replyPlaceholder", {
                        defaultValue: "Write a public thank-you reply…",
                      }) as string}
                      value={draft}
                      maxLength={2000}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                        setReplyDrafts({ ...replyDrafts, [s.contribution_id]: e.target.value })
                      }
                      rows={2}
                      sx={{ ...inputSx, resize: "vertical", fontFamily: "var(--font-sans)" }}
                    />
                    <Box sx={{ display: "flex", gap: 0.75, mt: 1 }}>
                      <Button
                        data-testid={`cm-supporter-reply-submit-${s.contribution_id}`}
                        variant="contained"
                        disableElevation
                        onClick={() => submitReply(s.contribution_id)}
                        disabled={isReplying}
                        size="small"
                        sx={{
                          bgcolor: green,
                          color: "#fff",
                          textTransform: "none",
                          fontWeight: 600,
                          fontSize: 12.5,
                          "&:hover": { bgcolor: "#0F9E6E" },
                        }}
                      >
                        {isReplying
                          ? "Saving…"
                          : s.organizer_reply
                            ? "Update reply"
                            : "Post reply"}
                      </Button>
                      {s.organizer_reply && (
                        <Button
                          data-testid={`cm-supporter-reply-clear-${s.contribution_id}`}
                          onClick={() => submitReply(s.contribution_id, true)}
                          disabled={isReplying}
                          size="small"
                          sx={{
                            textTransform: "none",
                            fontSize: 12.5,
                            color: theme.palette.error.main,
                          }}
                        >
                          {t("campaignRemoveReply", { defaultValue: "Remove reply" })}
                        </Button>
                      )}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

export default CampaignManager;
