import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, Button, CircularProgress, Switch, Typography, useTheme } from "@mui/material";
import { Icon } from "@iconify/react";
import { useDispatch, useSelector } from "react-redux";
import axiosBaseApi from "@/axiosConfig";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { USER_PROFILE_FETCH, UserAction } from "@/Redux/Actions/UserAction";
import { rootReducer } from "@/utils/types";

const HANDLE_RE = /^[a-z0-9][a-z0-9_-]{2,29}$/;

const CreatorPageSettings = () => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const profile = useSelector((s: rootReducer) => s.userReducer.profile) as any;

  const siteUrl = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
  const border = theme.palette.divider;

  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const [checking, setChecking] = useState(false);
  const [availability, setAvailability] = useState<{ available: boolean; reason: string | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ensure the profile is loaded even when landing directly on this section
  useEffect(() => {
    if (!profile?.user_id) dispatch(UserAction(USER_PROFILE_FETCH));
  }, [dispatch, profile?.user_id]);

  // Seed from profile once loaded (wait for a real profile, not the empty {} default)
  useEffect(() => {
    if (profile?.user_id && !seeded) {
      setHandle(profile.handle || "");
      setBio(profile.bio || "");
      setEnabled(Boolean(profile.creator_page_enabled));
      setSeeded(true);
    }
  }, [profile, seeded]);

  const savedHandle = profile?.handle || "";
  const formatError = useMemo(() => {
    if (!handle) return null;
    if (!HANDLE_RE.test(handle)) return "3–30 chars: lowercase letters, numbers, - or _ (start with a letter/number)";
    return null;
  }, [handle]);

  // Debounced availability check
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setAvailability(null);
    const h = handle.trim().toLowerCase();
    if (!h || formatError || h === savedHandle) return;
    setChecking(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await axiosBaseApi.get(`/user/creator/check-handle?handle=${encodeURIComponent(h)}`);
        setAvailability(r?.data?.data || null);
      } catch {
        setAvailability(null);
      } finally {
        setChecking(false);
      }
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [handle, formatError, savedHandle]);

  const canSave =
    seeded &&
    !saving &&
    !!handle &&
    !formatError &&
    (handle === savedHandle || availability?.available === true) &&
    (handle !== savedHandle || bio !== (profile?.bio || "") || enabled !== Boolean(profile?.creator_page_enabled));

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await axiosBaseApi.put("/user/creator/profile", {
        handle: handle.trim().toLowerCase(),
        bio,
        creator_page_enabled: enabled,
      });
      dispatch({ type: TOAST_SHOW, payload: { message: "Creator page saved" } });
      dispatch(UserAction(USER_PROFILE_FETCH));
    } catch (e: any) {
      dispatch({ type: TOAST_SHOW, payload: { message: e?.response?.data?.message || "Could not save", severity: "error" } });
    } finally {
      setSaving(false);
    }
  };

  const publicUrl = savedHandle ? `${siteUrl}/${savedHandle}` : "";
  const prettyUrl = savedHandle ? `${siteUrl.replace(/^https?:\/\//, "")}/${savedHandle}` : "";

  const copyUrl = () => {
    if (!publicUrl) return;
    navigator.clipboard?.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const inputSx = {
    width: "100%",
    padding: "11px 12px",
    borderRadius: "10px",
    border: `1px solid ${border}`,
    backgroundColor: theme.palette.background.default,
    color: theme.palette.text.primary,
    fontFamily: "var(--font-sans)",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box" as const,
    "&:focus": { borderColor: theme.palette.primary.main },
  };

  const labelSx = { fontSize: 13, fontWeight: 600, color: theme.palette.text.primary, mb: 0.75, display: "block", fontFamily: "var(--font-sans)" };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3, maxWidth: 560 }} data-testid="creator-settings">
      {/* Live URL banner */}
      {savedHandle && (
        <Box
          sx={{
            p: 2, borderRadius: "14px", border: `1px solid ${border}`,
            backgroundColor: theme.palette.mode === "dark" ? "rgba(204,255,0,0.06)" : "rgba(204,255,0,0.10)",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.5, flexWrap: "wrap",
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography fontSize={11.5} color={theme.palette.text.secondary}>Your public page</Typography>
            <Typography sx={{ fontFamily: "ui-monospace, monospace", fontSize: 14, fontWeight: 600, color: theme.palette.text.primary, wordBreak: "break-all" }}>
              {prettyUrl}
            </Typography>
          </Box>
          <Box display="flex" gap={1}>
            <Button size="small" onClick={copyUrl} data-testid="creator-copy-url" startIcon={<Icon icon={copied ? "mdi:check" : "mdi:content-copy"} width={16} />} sx={{ textTransform: "none", fontSize: 12.5, color: theme.palette.text.primary }}>
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button size="small" href={publicUrl} target="_blank" rel="noopener" data-testid="creator-view-page" endIcon={<Icon icon="mdi:open-in-new" width={15} />} sx={{ textTransform: "none", fontSize: 12.5, color: theme.palette.primary.main }}>
              View
            </Button>
          </Box>
        </Box>
      )}

      {/* Handle */}
      <Box>
        <Typography sx={labelSx}>Handle</Typography>
        <Box sx={{ display: "flex", alignItems: "stretch", border: `1px solid ${availability && !availability.available ? theme.palette.error.main : border}`, borderRadius: "10px", overflow: "hidden", backgroundColor: theme.palette.background.default }}>
          <Box sx={{ display: "flex", alignItems: "center", px: 1.5, backgroundColor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", fontFamily: "ui-monospace, monospace", fontSize: 13, color: theme.palette.text.secondary, whiteSpace: "nowrap" }}>
            {siteUrl.replace(/^https?:\/\//, "")}/
          </Box>
          <Box
            component="input"
            data-testid="creator-handle-input"
            value={handle}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHandle(e.target.value.toLowerCase().replace(/\s/g, ""))}
            placeholder="yourname"
            sx={{ flex: 1, border: "none", outline: "none", background: "transparent", padding: "11px 12px", fontFamily: "ui-monospace, monospace", fontSize: 14, color: theme.palette.text.primary, minWidth: 0 }}
          />
          <Box sx={{ display: "flex", alignItems: "center", px: 1.5 }}>
            {checking ? <CircularProgress size={15} /> :
              handle && handle !== savedHandle && availability?.available ? <Icon icon="mdi:check-circle" width={18} color="#22c55e" /> :
              handle && availability && !availability.available ? <Icon icon="mdi:close-circle" width={18} color={theme.palette.error.main} /> : null}
          </Box>
        </Box>
        <Typography fontSize={11.5} color={formatError || (availability && !availability.available) ? theme.palette.error.main : theme.palette.text.secondary} mt={0.5} data-testid="creator-handle-hint">
          {formatError || (availability && !availability.available ? availability.reason : "This is your unique, shareable Dynopay address.")}
        </Typography>
      </Box>

      {/* Bio */}
      <Box>
        <Typography sx={labelSx}>Bio <Typography component="span" fontSize={11.5} color={theme.palette.text.disabled} fontWeight={400}>(optional)</Typography></Typography>
        <Box
          component="textarea"
          rows={3}
          maxLength={500}
          data-testid="creator-bio-input"
          value={bio}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBio(e.target.value)}
          placeholder="Tell visitors who you are and what you're raising for…"
          sx={{ ...inputSx, resize: "vertical", minHeight: 74, display: "block" }}
        />
        <Typography fontSize={10.5} color={theme.palette.text.disabled} textAlign="right" mt={0.25}>{bio.length}/500</Typography>
      </Box>

      {/* Enable toggle */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", p: 2, borderRadius: "12px", border: `1px solid ${border}` }}>
        <Box sx={{ pr: 2 }}>
          <Typography fontSize={14} fontWeight={600} color={theme.palette.text.primary}>Publish my creator page</Typography>
          <Typography fontSize={12.5} color={theme.palette.text.secondary} mt={0.25}>When on, anyone with your link can view your page and support you.</Typography>
        </Box>
        <Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} data-testid="creator-enabled-switch" sx={{ "& .Mui-checked": { color: theme.palette.primary.main }, "& .Mui-checked + .MuiSwitch-track": { backgroundColor: theme.palette.primary.main } }} />
      </Box>

      <Box>
        <Button
          variant="contained"
          disableElevation
          onClick={handleSave}
          disabled={!canSave}
          data-testid="creator-save-btn"
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: "10px", px: 3, py: 1.1, fontSize: 14 }}
        >
          {saving ? <CircularProgress size={18} sx={{ color: "#fff" }} /> : "Save changes"}
        </Button>
      </Box>
    </Box>
  );
};

export default CreatorPageSettings;
