import React from "react";
import { Box, Skeleton, Typography, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import PanelCard from "@/Components/UI/PanelCard";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";
import { Icon } from "@/styles/uiKit";
import type { KycRequirements as Req } from "./useKycPage";

const DOC_ICON: Record<string, string> = { government_id: "lucide:id-card", proof_of_address: "lucide:house", selfie: "lucide:camera" };

/** "What you'll need" + "How it works" — from GET /kyc/requirements, translated per doc type. */
const KycRequirements: React.FC<{ requirements?: Req }> = ({ requirements }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation("dashboardLayout");
  const muted = isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight;
  const border = isDark ? CB_TOKENS.border.dark : CB_TOKENS.border.light;
  const indigo = isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light;

  const docs = requirements?.required_documents || [];
  const docCopy: Record<string, { name: string; desc: string }> = {
    government_id: { name: t("kycPage.docIdName", { defaultValue: "Government-issued ID" }), desc: t("kycPage.docIdDesc", { defaultValue: "Passport, driver's licence or national ID card — valid and not expired." }) },
    proof_of_address: { name: t("kycPage.docAddressName", { defaultValue: "Proof of address" }), desc: t("kycPage.docAddressDesc", { defaultValue: "A utility bill, bank statement or government letter from the last 3 months." }) },
    selfie: { name: t("kycPage.docSelfieName", { defaultValue: "A quick selfie" }), desc: t("kycPage.docSelfieDesc", { defaultValue: "A live photo so we can match you to your ID. Good light, no hat or glasses." }) },
  };
  const steps = [
    t("kycPage.how1", { defaultValue: "Tap Continue — you'll go to our verification partner Veriff." }),
    t("kycPage.how2", { defaultValue: "Photograph your ID and take a selfie with your phone or webcam." }),
    t("kycPage.how3", { defaultValue: "Come back here. We email you and add a notification when the result is in." }),
  ];

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.2fr) minmax(0, 1fr)" }, gap: { xs: 2, md: 2.5 }, alignItems: "start" }}>
      <PanelCard title={t("kycPage.needTitle", { defaultValue: "What you'll need" })} subTitle={t("kycPage.needSubtitle", { defaultValue: "Have these ready and the whole thing takes a few minutes." })} showHeaderBorder={false}>
        <Box data-testid="kyc-requirements" sx={{ display: "grid", gap: 1.25 }}>
          {!requirements
            ? [0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={64} />)
            : docs.map((d) => (
                <Box key={d.type} data-testid={`kyc-doc-${d.type}`} sx={{ display: "flex", gap: 1.5, alignItems: "flex-start", p: 1.5, borderRadius: "12px", border: `1px solid ${border}` }}>
                  <Box sx={{ width: 36, height: 36, borderRadius: "10px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: indigo, backgroundColor: isDark ? "rgba(129,140,248,0.12)" : "rgba(79,70,229,0.08)" }}>
                    <Icon name={DOC_ICON[d.type] || "lucide:file-text"} size={18} />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 700, color: theme.palette.text.primary }}>{docCopy[d.type]?.name || d.name}</Typography>
                    <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 12.5, lineHeight: 1.5, color: muted, mt: 0.25 }}>{docCopy[d.type]?.desc || d.description}</Typography>
                  </Box>
                </Box>
              ))}
        </Box>
      </PanelCard>

      <PanelCard title={t("kycPage.howTitle", { defaultValue: "How it works" })} showHeaderBorder={false}>
        <Box component="ol" data-testid="kyc-how" sx={{ listStyle: "none", m: 0, p: 0, display: "grid", gap: 1.5 }}>
          {steps.map((s, i) => (
            <Box component="li" key={i} sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
              <Box sx={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 800, color: "#fff", backgroundColor: indigo }}>{i + 1}</Box>
              <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 13.5, lineHeight: 1.55, color: theme.palette.text.primary, pt: 0.25 }}>{s}</Typography>
            </Box>
          ))}
        </Box>
        <Box sx={{ mt: 2.5, pt: 2, borderTop: `1px solid ${border}`, display: "flex", alignItems: "center", gap: 1, fontFamily: "var(--font-sans)", fontSize: 12.5, color: muted }}>
          <Icon name="lock" size={14} />
          {t("kycPage.partnerNote", { defaultValue: "Verified securely by Veriff. Dynopay never stores your ID images." })}
        </Box>
      </PanelCard>
    </Box>
  );
};

export default KycRequirements;
