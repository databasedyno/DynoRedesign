import React, { memo } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CtaBand from "./CtaBand";
import { PrimaryBtn, SecondaryBtn, goStart } from "./shared";

interface Props {
  /** Attribution tag passed to /auth/register?ref= (defaults to the page path). */
  attributionRef?: string;
  title?: React.ReactNode;
  body?: string;
  /** Replace the default Start · Live checkout · Talk to us trio. */
  actions?: React.ReactNode;
  footnote?: string | null;
  testId?: string;
}

/** The one closing CTA every public page ends on — same copy + trust row as the landing FinalCTA. */
const PublicFinalCta: React.FC<Props> = ({ attributionRef, title, body, actions, footnote, testId }) => {
  const router = useRouter();
  const { t } = useTranslation("landing");
  const attribution = attributionRef || router.pathname.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "") || "public";
  return (
    <CtaBand
      testId={testId || "public-final-cta"}
      eyebrow={t("v5.final.eyebrow")}
      title={
        title ?? (
          <>
            {t("v5.final.headline1")}
            <br />
            <span style={{ color: "#A5B4FC" }}>{t("v5.final.headline2")}</span>
          </>
        )
      }
      body={body ?? t("v5.final.body")}
      footnote={footnote === null ? undefined : footnote ?? t("v3.finalcta.trustLine")}
      actions={
        actions ?? (
          <>
            <PrimaryBtn data-testid="public-cta-start" onClick={() => goStart(router, attribution)} endIcon={<ArrowForwardIcon sx={{ fontSize: 18 }} />}>
              {t("v5.hero.primary")}
            </PrimaryBtn>
            <SecondaryBtn onDark data-testid="public-cta-demo" href="/pay/demo">
              {t("v5.hero.secondary")}
            </SecondaryBtn>
            <SecondaryBtn onDark data-testid="public-cta-talk" href="mailto:hi@dynopay.com?subject=Dynopay%20enquiry">
              {t("v5.final.talk")}
            </SecondaryBtn>
          </>
        )
      }
    />
  );
};

export default memo(PublicFinalCta);
