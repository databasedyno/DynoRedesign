/**
 * /qa/otp-harness — standalone QA harness for the shared <OtpInputPanel/>.
 *
 * Exists so the OTP input behavior (typing, paste, and — critically — the
 * iOS/Android AutoFill "insert whole code as ONE input event" path) can be
 * verified WITHOUT touching the backend or the production database: the
 * panel is rendered with a mock onVerify that only records what was
 * submitted. No network calls are made from this page.
 *
 * Regression context: iPhone Mail AutoFill only filled the FIRST digit
 * because each box had DOM maxLength=1, which truncated the inserted code
 * before JS ever saw it (AutoFill fires an input event, not a paste event).
 */
import React, { useState } from "react";
import Head from "next/head";
import { Box, Typography, Button } from "@mui/material";
import OtpInputPanel from "@/Components/UI/OtpInputPanel";

const OtpHarness: React.FC = () => {
  const [submitted, setSubmitted] = useState<string>("");
  const [submitCount, setSubmitCount] = useState<number>(0);
  const [resetKey, setResetKey] = useState<number>(0);

  return (
    <>
      <Head>
        <title>OTP Input Harness · QA</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <Box
        sx={{
          maxWidth: 520,
          margin: "40px auto",
          padding: "24px",
          fontFamily: "var(--font-sans)",
        }}
      >
        <Typography variant="h5" sx={{ marginBottom: "4px", fontWeight: 700 }}>
          OTP Input Harness
        </Typography>
        <Typography sx={{ marginBottom: "20px", fontSize: 14, opacity: 0.7 }}>
          Renders the shared OtpInputPanel with a mock verify handler. No
          backend calls are made from this page.
        </Typography>

        <OtpInputPanel
          contactInfo="qa-harness@example.com"
          contactType="email"
          otpLength={6}
          onVerify={(otp) => {
            setSubmitted(otp);
            setSubmitCount((c) => c + 1);
          }}
          onResendCode={() => {
            setSubmitted("");
            setResetKey((k) => k + 1);
          }}
          resetKey={resetKey}
          showInfoChip
          showLabel
          showActions
        />

        <Box
          sx={{
            marginTop: "24px",
            padding: "12px 16px",
            border: "1px dashed #999",
            borderRadius: "8px",
          }}
        >
          <Typography sx={{ fontSize: 13, opacity: 0.7 }}>
            Last submitted code:
          </Typography>
          <Typography
            data-testid="submitted-otp"
            sx={{ fontSize: 20, fontWeight: 700, letterSpacing: "2px" }}
          >
            {submitted || "(none)"}
          </Typography>
          <Typography data-testid="submit-count" sx={{ fontSize: 13 }}>
            Submit count: {submitCount}
          </Typography>
        </Box>

        <Button
          data-testid="harness-reset"
          variant="outlined"
          sx={{ marginTop: "16px" }}
          onClick={() => {
            setSubmitted("");
            setSubmitCount(0);
            setResetKey((k) => k + 1);
          }}
        >
          Reset harness
        </Button>
      </Box>
    </>
  );
};

// Set layout to "none" to bypass authentication checks
(OtpHarness as any).layout = "none";

export default OtpHarness;
