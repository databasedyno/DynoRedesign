import { pageProps } from "@/utils/types";
import { Box } from "@mui/material";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Head from "next/head";
import HelpAndSupport from "@/Components/Page/HelpAndSupport";
import PageHeroV8 from "@/Components/Page/Home/v8/PageHeroV8";
import CtaBandV8 from "@/Components/Page/Home/v8/CtaBandV8";
import { SectionV8, GradientText, useConsole } from "@/Components/Page/Home/v8/kit";

// Imported by /help-support/[slug].tsx — keep this export stable.
export interface HelpArticle {
  slug: string;
  title: string;
  description: string;
}

const HelpAndSupportPage = ({ setPageName, setPageDescription }: pageProps) => {
  const { t } = useTranslation("helpAndSupport");
  const s = useConsole();
  const [mounted, setMounted] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      setAuthed(!!localStorage.getItem("token"));
    } catch {
      setAuthed(false);
    }
  }, []);

  // Mirror the _app layout resolver: logged-in merchants see this inside the
  // authenticated app shell, so keep the compact in-app help center for them.
  useEffect(() => {
    if (setPageName && setPageDescription) {
      setPageName(t("helpAndSupportTitle"));
      setPageDescription(t("helpAndSupportDescription"));
    }
  }, [setPageName, setPageDescription, t]);

  if (mounted && authed) {
    return (
      <Box sx={{ flex: 1, display: "flex", minHeight: 0, width: "100%", maxWidth: 1280, mx: "auto", px: { xs: "16px", md: "20px" } }}>
        <HelpAndSupport />
      </Box>
    );
  }

  // Public (logged-out) marketing help center — v8 shell around the shared
  // search + article grid + support-chat component.
  return (
    <>
      <Head>
        <title>{t("metaTitle", { defaultValue: "Help & Support · Dynopay" })}</title>
        <meta name="description" content={t("helpAndSupportDescription", { defaultValue: "Search Dynopay guides, integration docs and FAQs, or chat with support." })} />
        <meta key="og:title" property="og:title" content={t("metaTitle", { defaultValue: "Help & Support · Dynopay" })} />
        <meta key="og:type" property="og:type" content="website" />
        <meta key="og:url" property="og:url" content="https://dynopay.com/help-support" />
        <link key="canonical" rel="canonical" href="https://dynopay.com/help-support" />
      </Head>

      <PageHeroV8
        testId="help-hero"
        eyebrow={t("helpEyebrow", { defaultValue: "Knowledge base" })}
        title={
          <>
            {t("helpHeroLead", { defaultValue: "How can we" })} <GradientText>{t("helpHeroAccent", { defaultValue: "help?" })}</GradientText>
          </>
        }
        body={t("helpAndSupportDescription", { defaultValue: "Search our documentation, integration guides and FAQs — or chat with support." })}
      />

      <SectionV8 testId="help-center" sx={{ pt: { xs: 1, md: 2 }, pb: { xs: 8, md: 12 } }}>
        <HelpAndSupport searchBg={s.canvas} />
      </SectionV8>

      <CtaBandV8
        testId="help-final-cta"
        badge={t("helpCtaBadge", { defaultValue: "We're here to help" })}
        title={t("helpCtaTitle", { defaultValue: "Still have questions?" })}
        body={t("helpCtaBody", { defaultValue: "Create your account in minutes, or reach our team any time — we reply fast." })}
        primaryLabel={t("helpCtaPrimary", { defaultValue: "Start free" })}
        primaryRef="help_final"
        secondaryLabel={t("documentation", { ns: "landing", defaultValue: "Read the docs" })}
        secondaryHref="/documentation"
      />
    </>
  );
};

export default HelpAndSupportPage;
