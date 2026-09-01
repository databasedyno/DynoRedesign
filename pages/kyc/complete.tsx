import React from "react";
import Head from "next/head";
import Link from "next/link";
import { Box, Button, Container, Stack, Typography } from "@mui/material";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import { BRAND_ACCENT } from "@/constants/theme";

/**
 * Post-verification landing page.
 *
 * This is the end-user redirect target (`verification.callback`) Veriff sends
 * the user to after they finish the identity flow. It is NOT the decision
 * source — the authoritative result arrives server-to-server on the Veriff
 * decision webhook (/api/kyc/webhook), after which we email + notify the user.
 * So this page only confirms submission; it never claims "approved".
 */
const KycCompletePage: React.FC = () => {
  return (
    <>
      <Head>
        <title>Verification submitted — Dynopay</title>
        <meta name="robots" content="noindex" />
      </Head>
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "background.default",
          px: 2,
          py: 6,
        }}
      >
        <Container maxWidth="sm">
          <Stack spacing={3} alignItems="center" textAlign="center">
            <Box
              sx={{
                width: 88,
                height: 88,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: `${BRAND_ACCENT}1A`,
              }}
            >
              <CheckCircleRoundedIcon sx={{ fontSize: 54, color: BRAND_ACCENT }} />
            </Box>

            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              Verification submitted
            </Typography>

            <Typography variant="body1" color="text.secondary">
              Thanks — your details were received and are being reviewed. This
              usually takes just a few minutes. We&apos;ll email you and add an
              in-app notification the moment your verification is complete, so
              there&apos;s nothing else you need to do here.
            </Typography>

            <Button
              component={Link}
              href="/dashboard"
              variant="contained"
              size="large"
              endIcon={<ArrowForwardRoundedIcon />}
              data-testid="kyc-complete-dashboard-btn"
              sx={{
                mt: 1,
                bgcolor: BRAND_ACCENT,
                textTransform: "none",
                fontWeight: 600,
                px: 4,
                "&:hover": { bgcolor: BRAND_ACCENT, filter: "brightness(0.95)" },
              }}
            >
              Back to dashboard
            </Button>

            <Typography variant="caption" color="text.secondary">
              You can safely close this tab.
            </Typography>
          </Stack>
        </Container>
      </Box>
    </>
  );
};

export default KycCompletePage;

// Public redirect target for the Veriff flow — render bare (no auth container),
// so it works even if the session doesn't carry into the redirected tab.
(KycCompletePage as unknown as { layout: string }).layout = "none";
