import Help_Support from "@/assets/Icons/Help&Support.svg";
import {
  HelpSupportBtn,
  KnowledgeBaseTitle,
  SidebarFooter,
} from "@/Components/Layout/NewSidebar/styled";
import CardGiftcardRounded from "@mui/icons-material/CardGiftcardRounded";
import { BRAND_ACCENT, brandFg } from "@/constants/theme";
import { useTheme } from "@mui/material";
import Image from "next/image";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";

/**
 * Sidebar footer — "Quiet Money" redesign (Blueprint §3 / rule 5: "the nav
 * sells nothing"). The loud referral card was removed; a quiet "Refer & earn"
 * link now sits above Help & Support so the 25% revenue-share program stays
 * discoverable from anywhere in the app without shouting.
 */
const ReferralAndKnowledge = ({ isMobile }: { isMobile: boolean }) => {
  const router = useRouter();
  const theme = useTheme();
  const { t } = useTranslation("common");

  return (
    <SidebarFooter>
      <HelpSupportBtn
        onClick={() => router.push("/referrals")}
        data-testid="sidebar-refer-earn"
        style={{
          borderColor: theme.palette.mode === "dark"
            ? "rgba(129,140,248,0.35)"
            : "rgba(79,70,229,0.28)",
        }}
      >
        <CardGiftcardRounded
          sx={{ fontSize: isMobile ? 16 : 18, color: brandFg(theme.palette.mode === "dark") }}
        />
        <KnowledgeBaseTitle style={{ color: brandFg(theme.palette.mode === "dark"), fontWeight: 600 }}>
          {t("referAndEarn", { defaultValue: "Refer & earn" })}
        </KnowledgeBaseTitle>
      </HelpSupportBtn>
      <HelpSupportBtn
        onClick={() => router.push("/help-support")}
        data-testid="sidebar-help-support"
      >
        <Image
          src={Help_Support}
          alt=""
          width={isMobile ? 14 : 18}
          height={isMobile ? 14 : 18}
          draggable={false}
        />
        <KnowledgeBaseTitle>{t("helpSupport")}</KnowledgeBaseTitle>
      </HelpSupportBtn>
    </SidebarFooter>
  );
};

export default ReferralAndKnowledge;
