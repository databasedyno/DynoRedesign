import Help_Support from "@/assets/Icons/Help&Support.svg";
import {
  HelpSupportBtn,
  KnowledgeBaseTitle,
  SidebarFooter,
} from "@/Components/Layout/NewSidebar/styled";
import Image from "next/image";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";

/**
 * Sidebar footer — "Quiet Money" redesign (Blueprint §3 / rule 5: "the nav
 * sells nothing"). The referral card, its social-share icons and the copy
 * control were removed from the sidebar; referrals now live on their own
 * /referrals page (reachable from Settings). Only the utility Help & Support
 * link remains pinned to the bottom of the nav.
 */
const ReferralAndKnowledge = ({ isMobile }: { isMobile: boolean }) => {
  const router = useRouter();
  const { t } = useTranslation("common");

  return (
    <SidebarFooter>
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
