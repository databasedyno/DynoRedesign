import React, { useEffect, useState } from "react";
import { Dialog, Box, Typography, useTheme } from "@mui/material";
import { useDispatch } from "react-redux";
import useTokenData from "@/hooks/useTokenData";
import useIsMobile from "@/hooks/useIsMobile";
import InputField from "@/Components/UI/AuthLayout/InputFields";
import CustomButton from "@/Components/UI/Buttons";
import { USER_LOGIN } from "@/Redux/Actions/UserAction";
import axiosBaseApi from "@/axiosConfig";

/**
 * NameGate — guarantees every logged-in merchant has a real name on file,
 * regardless of how they onboarded (product decision 2026-09-07).
 *
 * Email signups now collect First + Last on the OTP screen, but social logins
 * (e.g. a Google account with no name) and ~18 legacy accounts created before
 * this change can still be name-less. Mounted inside the authenticated shell
 * (Containers/Client), this shows a NON-dismissable dialog forcing those users
 * to enter their first + last name before they can use the dashboard. Anyone
 * who already has a name never sees it.
 */
const NameGate: React.FC = () => {
  const tokenData = useTokenData();
  const dispatch = useDispatch();
  const theme = useTheme();
  const isMobile = useIsMobile("sm");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Only gate once we've read the token client-side AND the name is genuinely blank.
  const nameOnToken = tokenData?.name ? String(tokenData.name).trim() : "";
  const needsName = mounted && !!tokenData?.user_id && nameOnToken.length === 0;

  const handleSave = async () => {
    const first = firstName.trim();
    const last = lastName.trim();
    if (!first) { setError("First name is required"); return; }
    if (!last) { setError("Last name is required"); return; }
    setError("");
    setSaving(true);
    try {
      const fullName = `${first} ${last}`.replace(/\s+/g, " ").trim();
      const fd = new FormData();
      fd.append("data", JSON.stringify({ name: fullName }));
      const res = await axiosBaseApi.put("user/updateUser", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const d = res?.data?.data;
      if (d?.accessToken) {
        // Persist the refreshed token (now carrying the name) so the whole app
        // — header, receipts, greetings — picks it up.
        dispatch({ type: USER_LOGIN, payload: { ...(d.userData || {}), accessToken: d.accessToken } });
      }
      // Reload so useTokenData re-reads the new token and the gate disappears.
      if (typeof window !== "undefined") window.location.reload();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Couldn't save your name. Please try again.");
      setSaving(false);
    }
  };

  if (!needsName) return null;

  return (
    <Dialog
      open
      disableEscapeKeyDown
      onClose={() => { /* non-dismissable — name is required */ }}
      data-testid="name-gate-dialog"
      PaperProps={{
        sx: {
          borderRadius: "16px",
          width: "100%",
          maxWidth: "440px",
          m: 2,
          p: { xs: 2.5, sm: 3.5 },
          backgroundColor: theme.palette.background.paper,
        },
      }}
    >
      <Typography sx={{ fontWeight: 700, fontSize: "20px", color: "text.primary", fontFamily: "var(--font-sans)" }}>
        What&apos;s your name?
      </Typography>
      <Typography sx={{ fontSize: "14px", color: "text.secondary", fontFamily: "var(--font-sans)", mt: 0.75, lineHeight: 1.5 }}>
        Add your first and last name so we can personalize your account, receipts and payout emails.
      </Typography>

      <Box sx={{ mt: 2.5, display: "flex", flexDirection: "column", gap: 1.5 }}>
        <Box sx={{ display: "flex", gap: 1.5, flexDirection: isMobile ? "column" : "row" }}>
          <Box sx={{ flex: 1 }}>
            <InputField
              data-testid="name-gate-first-name-input"
              type="text"
              value={firstName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setFirstName(e.target.value); if (error) setError(""); }}
              label="First name"
              placeholder="First name"
            />
          </Box>
          <Box sx={{ flex: 1 }}>
            <InputField
              data-testid="name-gate-last-name-input"
              type="text"
              value={lastName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setLastName(e.target.value); if (error) setError(""); }}
              label="Last name"
              placeholder="Last name"
            />
          </Box>
        </Box>
        {error && (
          <Typography data-testid="name-gate-error" sx={{ fontSize: "13px", color: "error.main", fontFamily: "var(--font-sans)" }}>
            {error}
          </Typography>
        )}
        <CustomButton
          data-testid="name-gate-submit"
          variant="primary"
          size="medium"
          label={saving ? "Saving..." : "Save & continue"}
          onClick={handleSave}
          disabled={saving}
          fullWidth
          sx={{ fontWeight: 700, padding: "13px 24px", borderRadius: "12px", fontSize: "15px", mt: 0.5 }}
        />
      </Box>
    </Dialog>
  );
};

export default NameGate;
