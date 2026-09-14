import useIsMobile from "@/hooks/useIsMobile";
import { SxProps, Theme } from "@mui/material";
import React, { memo, useMemo } from "react";
import { Badge, Heading, HighlightText, SubText, Wrapper } from "./styled";

export type HomeSectionTitleType = "small" | "large";
export type HomeSectionTitleAlign = "center" | "start";

export interface HomeSectionTitleProps {
  type?: HomeSectionTitleType;
  badgeText?: string;
  title: string;
  highlightText?: string;
  subtitle: string;
  align?: HomeSectionTitleAlign;
  sx?: SxProps<Theme>;
  /** HTML heading element to render. Use "h1" only for the hero section. Defaults to "h2". */
  headingAs?: "h1" | "h2" | "h3";
}

const HomeSectionTitle: React.FC<HomeSectionTitleProps> = ({
  sx,
  badgeText,
  title,
  highlightText,
  subtitle,
  type = "large",
  align = "center",
  headingAs = "h2",
}) => {
  const isMobile = useIsMobile("md");

  const renderedTitle = useMemo<React.ReactNode>(() => {
    if (!highlightText || !title.includes(highlightText)) return title;
    const parts = title.split(highlightText);
    return (
      <>
        {parts[0]}
        <HighlightText>{highlightText}</HighlightText>
        {parts[1]}
      </>
    );
  }, [title, highlightText]);

  void isMobile;

  return (
    <Wrapper sx={sx} data-align={align}>
      {badgeText ? <Badge data-align={align}>{badgeText}</Badge> : null}

      <Heading variant={headingAs} component={headingAs} data-type={type} data-align={align}>
        {renderedTitle}
      </Heading>

      <SubText component="div" variant="body1" data-type={type} data-align={align}>
        {subtitle}
      </SubText>
    </Wrapper>
  );
};

export default memo(HomeSectionTitle);
