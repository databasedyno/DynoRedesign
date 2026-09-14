import { FC, ReactNode, memo } from "react";
import { MotionConfig } from "framer-motion";

import HomeFooter from "@/Components/Layout/HomeFooter";
import HomeHeader from "@/Components/Layout/HomeHeader";
import PublicDashboardBar from "@/Components/Layout/PublicDashboardBar";
import ScrollToTopButton from "@/Components/Layout/ScrollToTopButton";
import { PageTransition } from "@/Components/Page/Home/motion/PageTransition";
import { MainBox, MainSection } from "./styled";

interface HomeLayoutProps {
  children: ReactNode;
}

/* MotionConfig reducedMotion="user": every framer-motion transform/layout animation
 * in the marketing shell switches off for visitors who asked for reduced motion. */
const HomeLayout: FC<HomeLayoutProps> = ({ children }) => {
  return (
    <MotionConfig reducedMotion="user">
      <MainBox>
        <HomeHeader />

        <MainSection>
          <PageTransition>{children}</PageTransition>
        </MainSection>

        <HomeFooter />

        <PublicDashboardBar />

        <ScrollToTopButton />
      </MainBox>
    </MotionConfig>
  );
};

export default memo(HomeLayout);
