import React from "react";
import Head from "next/head";
import { Box, Button, CircularProgress, TextField, Typography } from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";

export const QualityHead = () => (
  <Head>
    <title>QA Quality Center · Dynopay</title>
    <meta name="robots" content="noindex, nofollow" />
  </Head>
);

interface GateProps {
  booting: boolean;
  isDark: boolean;
  cardBg: string;
  border: string;
  passInput: string;
  setPassInput: (v: string) => void;
  authError: string;
  authLoading: boolean;
  onUnlock: () => void;
}

/** Boot spinner + passcode gate (rendered while the QA session is not authenticated). */
export const QualityGate: React.FC<GateProps> = ({ booting, isDark, cardBg, border, passInput, setPassInput, authError, authLoading, onUnlock }) => {
  if (booting) {
    return (
      <>
        <QualityHead />
        <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
          <CircularProgress />
        </Box>
      </>
    );
  }
  return (
    <>
      <QualityHead />
      <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", bgcolor: isDark ? "#0B0E11" : "#F8FAFC", p: 2 }}>
        <Box sx={{ width: "100%", maxWidth: 420, p: 4, borderRadius: 3, bgcolor: cardBg, border, textAlign: "center" }}>
          <LockOutlinedIcon sx={{ fontSize: 40, color: "primary.main", mb: 1 }} />
          <Typography sx={{ fontSize: 24, fontWeight: 700, mb: 0.5 }}>Dynopay Quality Center</Typography>
          <Typography sx={{ fontSize: 14, color: "text.secondary", mb: 3 }}>
            Enter the QA passcode to access the end-to-end test plan.
          </Typography>
          <TextField
            fullWidth
            type="password"
            label="Passcode"
            value={passInput}
            onChange={(e) => setPassInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onUnlock()}
            error={!!authError}
            helperText={authError}
            sx={{ mb: 2 }}
            autoFocus
          />
          <Button fullWidth variant="contained" size="large" onClick={onUnlock} disabled={authLoading || !passInput}>
            {authLoading ? <CircularProgress size={22} color="inherit" /> : "Unlock"}
          </Button>
        </Box>
      </Box>
    </>
  );
};

export default QualityGate;
