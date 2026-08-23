import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Button, CircularProgress, IconButton, Typography, useTheme } from "@mui/material";
import { Icon } from "@iconify/react";
import { useDispatch } from "react-redux";
import axiosBaseApi from "@/axiosConfig";
import { API_ENDPOINTS } from "@/api/endpoints";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { USER_PROFILE_FETCH, UserAction } from "@/Redux/Actions/UserAction";
import useDebounce from "@/hooks/useDebounce";
import useStorefrontProfile from "@/hooks/useStorefrontProfile";
import { useCompanyStore } from "@/contexts/CompanyDataContext";
import { getCreatorBaseUrl } from "@/helpers/creatorUrl";

const HANDLE_RE = /^[a-z0-9][a-z0-9_-]{2,29}$/;
const NUDGE_KEY_PREFIX = "dp_new_company_handle_nudge:";
const DISMISS_KEY_PREFIX = "dp_new_company_handle_nudge_dismissed:";

/**
 * HandleClaimNudge — quick-claim card shown at the top of /storefront right
 * after a merchant creates a new company. Prompts them to reserve that
 * company's @handle in one tap so its public page + checkout URLs go live
 * immediately instead of sitting empty.
 *
 * Trigger: CreateCompanyModal sets localStorage `NUDGE_KEY_PREFIX<companyId>`
 * on successful creation and switches the active company. This card:
 *   - reads the localStorage flag,
 *   - stays hidden unless the active company has NO handle yet + flag ON,
 *   - dismisses (localStorage) on Skip or after a successful claim,
 *   - deep-links "Full customize" straight to the theme + bio section below.
 */
const HandleClaimNudge: React.FC = () => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const { profile, mutate: mutateStorefront } = useStorefrontProfile();
  const { companyList, selectedCompanyId } = useCompanyStore();
  const siteUrl = getCreatorBaseUrl();

  const currentCompany = useMemo(
    () => companyList.find((c: any) => Number(c.company_id) === Number(selectedCompanyId)),
    [companyList, selectedCompanyId],
  );
  const currentName =
    (currentCompany?.company_name as string) || (currentCompany?.name as string) || "this company";

  const [visible, setVisible] = useState(false);
  const [handle, setHandle] = useState("");
  const [checking, setChecking] = useState(false);
  const [availability, setAvailability] = useState<{ available: boolean; reason: string | null } | null>(null);
  const [saving, setSaving] = useState(false);

  // Show only when: this company has the "new-company" flag set AND has no handle
  // AND it isn't a legacy shared storefront (storefront_pending means the
  // account still shares one handle across companies — the pending card
  // already tells the user what to do there).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!selectedCompanyId) return;
    if (profile === undefined) return; // still loading
    if (profile?.handle) return; // already claimed
    if (profile?.storefront_pending) return; // legacy account-shared

    const nudgeKey = `${NUDGE_KEY_PREFIX}${selectedCompanyId}`;
    const dismissKey = `${DISMISS_KEY_PREFIX}${selectedCompanyId}`;
    try {
      const flagged = window.localStorage.getItem(nudgeKey) === "1";
      const dismissed = window.localStorage.getItem(dismissKey) === "1";
      setVisible(flagged && !dismissed);
    } catch {
      setVisible(false);
    }
  }, [selectedCompanyId, profile]);

  // Seed a suggestion from the company name (lowercased, alnum + dash only)
  useEffect(() => {
    if (!visible) return;
    if (handle) return;
    const suggested = currentName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 30);
    if (suggested.length >= 3) setHandle(suggested);
  }, [visible, currentName, handle]);

  // Debounced availability check (matches CreatorPageSettings behavior)
  const debouncedHandle = useDebounce(handle, 400);
  const formatError = useMemo(() => {
    if (!handle) return null;
    if (!HANDLE_RE.test(handle)) {
      return "3–30 chars: lowercase letters, numbers, - or _";
    }
    return null;
  }, [handle]);

  useEffect(() => {
    const h = handle.trim().toLowerCase();
    setAvailability(null);
    setChecking(Boolean(h && !formatError));
  }, [handle, formatError]);

  useEffect(() => {
    const h = debouncedHandle.trim().toLowerCase();
    if (!h || formatError) {
      setChecking(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const r = await axiosBaseApi.get(
          `${API_ENDPOINTS.creator.checkHandle}?handle=${encodeURIComponent(h)}`,
        );
        if (!cancelled) setAvailability(r?.data?.data || null);
      } catch {
        if (!cancelled) setAvailability(null);
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedHandle, formatError]);

  const dismiss = useCallback(() => {
    if (!selectedCompanyId) return;
    try {
      window.localStorage.setItem(`${DISMISS_KEY_PREFIX}${selectedCompanyId}`, "1");
      window.localStorage.removeItem(`${NUDGE_KEY_PREFIX}${selectedCompanyId}`);
    } catch {
      /* noop */
    }
    setVisible(false);
  }, [selectedCompanyId]);

  const canClaim =
    !!handle && !formatError && !checking && availability?.available === true && !saving;

  const claim = useCallback(async () => {
    if (!canClaim) return;
    setSaving(true);
    try {
      await axiosBaseApi.put(API_ENDPOINTS.creator.profile, {
        handle: handle.trim().toLowerCase(),
      });
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message: `Reserved! ${siteUrl.replace(/^https?:\/\//, "")}/${handle} is now ${currentName}'s.`,
        },
      });
      dispatch(UserAction(USER_PROFILE_FETCH));
      await mutateStorefront();
      dismiss();
    } catch (e: any) {
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message: e?.response?.data?.message || "Could not reserve the handle. Please try again.",
          severity: "error",
        },
      });
    } finally {
      setSaving(false);
    }
  }, [canClaim, dispatch, handle, mutateStorefront, siteUrl, currentName, dismiss]);

  if (!visible) return null;

  const isDark = theme.palette.mode === "dark";
  const border = theme.palette.divider;

  const hintColor = formatError || availability?.available === false
    ? theme.palette.error.main
    : availability?.available
      ? "#22c55e"
      : theme.palette.text.secondary;

  const hintText =
    formatError
    || (availability && availability.available === false && availability.reason)
    || (availability?.available
      ? `${siteUrl.replace(/^https?:\/\//, "")}/${handle} is available — grab it!`
      : `Pick a short, memorable handle for ${currentName}.`);

  return (
    <Box
      data-testid="handle-claim-nudge"
      sx={{
        position: "relative",
        borderRadius: "16px",
        border: `1px solid ${isDark ? "rgba(129,140,248,0.4)" : "rgba(79,70,229,0.35)"}`,
        background: isDark
          ? "linear-gradient(135deg, rgba(79,70,229,0.14) 0%, rgba(34,197,94,0.06) 100%)"
          : "linear-gradient(135deg, rgba(79,70,229,0.06) 0%, rgba(34,197,94,0.04) 100%)",
        p: { xs: 2, sm: 2.5 },
        mb: 2.5,
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
      }}
    >
      <IconButton
        size="small"
        onClick={dismiss}
        data-testid="handle-claim-nudge-dismiss"
        aria-label="Dismiss"
        sx={{
          position: "absolute",
          top: 8,
          right: 8,
          color: theme.palette.text.secondary,
          width: 32,
          height: 32,
        }}
      >
        <Icon icon="mdi:close" width={17} />
      </IconButton>

      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, pr: 4 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: isDark ? "#818CF8" : "#4F46E5",
            color: "#FFFFFF",
            flexShrink: 0,
          }}
        >
          <Icon icon="mdi:party-popper" width={22} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: { xs: 15.5, sm: 16.5 },
              fontWeight: 800,
              color: theme.palette.text.primary,
              lineHeight: 1.2,
            }}
          >
            {currentName} is ready — claim its handle
          </Typography>
          <Typography
            sx={{
              fontSize: 13,
              color: theme.palette.text.secondary,
              mt: 0.35,
              lineHeight: 1.45,
            }}
          >
            Reserve <b>{currentName}</b>&apos;s public page and checkout URL. It goes live the
            moment you claim it — no other setup needed.
          </Typography>
        </Box>
      </Box>

      <Box sx={{ mt: 0.5 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "stretch",
            border: `1px solid ${
              availability && availability.available === false ? theme.palette.error.main : border
            }`,
            borderRadius: "10px",
            overflow: "hidden",
            backgroundColor: theme.palette.background.default,
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              px: 1.5,
              backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
              fontFamily: "ui-monospace, monospace",
              fontSize: 13,
              color: theme.palette.text.secondary,
              whiteSpace: "nowrap",
            }}
          >
            {siteUrl.replace(/^https?:\/\//, "")}/
          </Box>
          <Box
            component="input"
            data-testid="handle-claim-nudge-input"
            value={handle}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setHandle(
                e.target.value
                  .toLowerCase()
                  .replace(/\s/g, "")
                  .replace(/[^a-z0-9_-]/g, "")
                  .slice(0, 30),
              )
            }
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === "Enter" && canClaim) {
                e.preventDefault();
                void claim();
              }
            }}
            placeholder={`e.g. ${currentName.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20) || "yourbrand"}`}
            sx={{
              flex: 1,
              border: "none",
              outline: "none",
              background: "transparent",
              padding: "11px 12px",
              fontFamily: "ui-monospace, monospace",
              fontSize: 14,
              color: theme.palette.text.primary,
              minWidth: 0,
            }}
          />
          <Box sx={{ display: "flex", alignItems: "center", px: 1.5 }}>
            {checking ? (
              <CircularProgress size={15} />
            ) : handle && availability?.available ? (
              <Icon icon="mdi:check-circle" width={18} color="#22c55e" />
            ) : handle && availability && !availability.available ? (
              <Icon icon="mdi:close-circle" width={18} color={theme.palette.error.main} />
            ) : null}
          </Box>
        </Box>
        <Typography
          fontSize={11.5}
          sx={{ color: hintColor, mt: 0.5 }}
          data-testid="handle-claim-nudge-hint"
        >
          {hintText}
        </Typography>
      </Box>

      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 0.5 }}>
        <Button
          variant="contained"
          disableElevation
          onClick={claim}
          disabled={!canClaim}
          data-testid="handle-claim-nudge-btn"
          sx={{
            textTransform: "none",
            fontWeight: 700,
            fontSize: 14,
            borderRadius: "10px",
            px: 2.5,
            py: 1,
            backgroundColor: isDark ? "#818CF8" : "#4F46E5",
            color: "#FFFFFF",
            "&:hover": { backgroundColor: isDark ? "#6D74E8" : "#4338CA" },
            "&.Mui-disabled": {
              backgroundColor: isDark ? "rgba(129,140,248,0.35)" : "rgba(79,70,229,0.35)",
              color: "rgba(255,255,255,0.85)",
            },
          }}
        >
          {saving ? (
            <CircularProgress size={16} sx={{ color: "#fff" }} />
          ) : (
            <>Claim @{handle || "handle"}</>
          )}
        </Button>
        <Button
          onClick={dismiss}
          data-testid="handle-claim-nudge-skip"
          sx={{
            textTransform: "none",
            fontWeight: 600,
            fontSize: 13.5,
            borderRadius: "10px",
            color: theme.palette.text.secondary,
          }}
        >
          Skip for now
        </Button>
      </Box>
    </Box>
  );
};

export default HandleClaimNudge;
