import { FC } from "react";
import { LANDING_SECTION_IDS } from "./landingSections";
import { useLandingNav } from "./useLandingNav";
import { SectionRail } from "./SectionRail";
import { SectionChipBar } from "./SectionChipBar";

/** Landing navigators: dot rail on desktop, chip bar on mobile. Both appear once the hero scrolls away. */
const LandingNav: FC = () => {
  const { active, pastHero, headerBottom } = useLandingNav(LANDING_SECTION_IDS);
  return (
    <>
      <SectionRail active={active} visible={pastHero} />
      <SectionChipBar active={active} visible={pastHero} top={headerBottom} />
    </>
  );
};

export default LandingNav;
