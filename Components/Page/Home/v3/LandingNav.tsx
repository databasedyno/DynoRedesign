import { FC } from "react";
import { LANDING_SECTION_IDS } from "./landingSections";
import { useLandingNav } from "./useLandingNav";
import { SectionChipBar } from "./SectionChipBar";

/** Landing navigator: one compact chip bar docked under the header once the hero scrolls away (the side rail was retired). */
const LandingNav: FC = () => {
  const { active, pastHero, headerBottom } = useLandingNav(LANDING_SECTION_IDS);
  return <SectionChipBar active={active} visible={pastHero} top={headerBottom} />;
};

export default LandingNav;
