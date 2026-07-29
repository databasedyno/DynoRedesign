import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "next/router";
import { Box, Button, Dialog, DialogContent, Typography, useTheme } from "@mui/material";
import { Icon } from "@iconify/react";
import confetti from "canvas-confetti";
import axiosBaseApi from "@/axiosConfig";
import { rootReducer } from "@/utils/types";
import { USER_PROFILE_FETCH, UserAction } from "@/Redux/Actions/UserAction";
import { prettyCreatorUrl } from "@/helpers/creatorUrl";

const HANDLE_RE = /^[a-z0-9][a-z0-9_-]{2,29}$/;
const MONO = 'ui-monospace, "Roboto Mono", "JetBrains Mono", SFMono-Regular, Menlo, monospace';

/** Two-burst brand-colored confetti — tasteful, ~200ms. Client-only. */
const fireConfetti = () => {
  try {
    const colors = ["#4F46E5", "#7C5CFF", "#10B981", "#F59E0B"];
    confetti({ particleCount: 70, spread: 62, startVelocity: 38, origin: { x: 0.35, y: 0.4 }, colors, scalar: 0.95, ticks: 220 });
    confetti({ particleCount: 70, spread: 62, startVelocity: 38, origin: { x: 0.65, y: 0.4 }, colors, scalar: 0.95, ticks: 220 });
  } catch {
    /* canvas-confetti is client-only and safe to ignore */
  }
};

/**
 * Invisible dashboard companion that finalizes a creator handle the visitor
 * reserved on the landing page (carried through signup via localStorage).
 *
 * The moment the profile loads after first login — if the user has NO handle
 * yet and a valid reserved handle is sitting in localStorage — it silently
 * submits PUT /user/creator/profile (assign only, page stays unpublished),
 * clears the carried handle/token, refreshes the profile, then celebrates with
 * a confetti burst + a "your page is reserved" dialog that nudges the user to
 * publish. On any failure it stays silent and leaves the reserved handle in
 * place so CreatorPageCard's inline claim can pre-fill it (user picks another).
 */
const AutoClaimHandle: React.FC = () => {
  const theme = useTheme();
  const router = useRouter();
  const dispatch = useDispatch();
  const profile = useSelector((s: rootReducer) => (s as any).userReducer.profile) as any;
  const attemptedRef = useRef(false);
  // The handle just auto-claimed this session — drives the celebration dialog.
  const [claimedHandle, setClaimedHandle] = useState<string | null>(null);

  useEffect(() => {
    if (attemptedRef.current) return;
    // Wait until the profile has loaded.
    if (!profile?.user_id) return;
    // Already has a handle — nothing to auto-apply.
    if (profile?.handle) {
      attemptedRef.current = true;
      return;
    }

    let handle = "";
    let token: string | undefined;
    try {
      handle = (localStorage.getItem("dynopay.claimedHandle") || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "")
        .slice(0, 30);
      token = localStorage.getItem("dynopay.claimedHandleToken") || undefined;
    } catch {
      return;
    }

    if (handle.length < 3 || !HANDLE_RE.test(handle)) return;

    attemptedRef.current = true;
    (async () => {
      try {
        await axiosBaseApi.put("/user/creator/profile", {
          handle,
          handle_reservation_token: token,
        });
        try {
          localStorage.removeItem("dynopay.claimedHandle");
          localStorage.removeItem("dynopay.claimedHandleToken");
        } catch {
          /* ignore storage errors */
        }
        // Delightful moment: confetti + celebration dialog nudging to publish.
        setClaimedHandle(handle);
        fireConfetti();
        dispatch(UserAction(USER_PROFILE_FETCH));
      } catch {
        // Silent (user choice): keep the reserved handle so CreatorPageCard can
        // pre-fill it and the user can pick another name if it was just taken.
      }
    })();
  }, [profile?.user_id, profile?.handle, dispatch]);

  const isDark = theme.palette.mode === "dark";
  const prettyUrl = prettyCreatorUrl(claimedHandle);

  const closeDialog = () => setClaimedHandle(null);
  const goPublish = () => {
    setClaimedHandle(null);
    router.push("/creator");
  };

  return (
    <Dialog
      open={Boolean(claimedHandle)}
      onClose={closeDialog}
      maxWidth="xs"
      fullWidth
      data-testid="auto-claim-celebration-dialog"
      PaperProps={{ sx: { borderRadius: "20px", overflow: "hidden" } }}
    >
      <DialogContent sx={{ p: { xs: 3, sm: 3.5 }, textAlign: "center" }}>
        <Box
          sx={{
            width: 64,
            height: 64,
            borderRadius: "18px",
            margin: "0 auto 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #4F46E5 0%, #7C5CFF 100%)",
            boxShadow: "0 10px 28px rgba(79,70,229,0.35)",
          }}
        >
          <Icon icon="mdi:party-popper" width={34} color="#FFFFFF" />
        </Box>

        <Typography
          sx={{ fontSize: { xs: 20, sm: 22 }, fontWeight: 800, color: theme.palette.text.primary, lineHeight: 1.2 }}
        >
          Your creator page is reserved!
        </Typography>

        <Box
          data-testid="auto-claim-url"
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 0.75,
            mt: 1.5,
            px: 1.5,
            py: 0.85,
            borderRadius: "999px",
            border: `1px solid ${theme.palette.divider}`,
            backgroundColor: isDark ? "rgba(79,70,229,0.14)" : "rgba(79,70,229,0.06)",
          }}
        >
          <Icon icon="mdi:link-variant" width={16} color={theme.palette.text.secondary} />
          <Typography
            sx={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: theme.palette.text.primary }}
          >
            {prettyUrl}
          </Typography>
        </Box>

        <Typography
          sx={{ fontSize: 14, color: theme.palette.text.secondary, mt: 1.75, lineHeight: 1.55 }}
        >
          It&apos;s locked to your account. Publish it to start accepting tips &amp; payments.
        </Typography>

        <Button
          variant="contained"
          disableElevation
          fullWidth
          onClick={goPublish}
          data-testid="auto-claim-publish-btn"
          endIcon={<Icon icon="mdi:rocket-launch-outline" width={18} />}
          sx={{
            mt: 2.5,
            textTransform: "none",
            fontWeight: 700,
            fontSize: 15,
            borderRadius: "12px",
            py: 1.15,
            background: "linear-gradient(135deg, #4F46E5 0%, #4338CA 100%)",
            color: "#FFFFFF",
            "&:hover": { background: "linear-gradient(135deg, #4338CA 0%, #3730A3 100%)" },
          }}
        >
          Publish my page
        </Button>

        <Button
          variant="text"
          fullWidth
          onClick={closeDialog}
          data-testid="auto-claim-later-btn"
          sx={{
            mt: 1,
            textTransform: "none",
            fontSize: 13.5,
            fontWeight: 600,
            color: theme.palette.text.secondary,
            "&:hover": { backgroundColor: "transparent", color: theme.palette.text.primary },
          }}
        >
          Maybe later
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default AutoClaimHandle;
