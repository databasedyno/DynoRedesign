/**
 * PanelCard - A reusable card component with header, body, and optional footer sections
 *
 * @example
 * // Basic usage with title and content
 * <PanelCard title="Update Password">
 *   <YourFormContent />
 * </PanelCard>
 *
 * @example
 * // With header icon and footer actions
 * <PanelCard
 *   title="Update Password"
 *   headerIcon={<LockIcon />}
 *   footer={<Button>Update</Button>}
 * >
 *   <YourFormContent />
 * </PanelCard>
 *
 * @example
 * // With header action button
 * <PanelCard
 *   title="Account Settings"
 *   headerAction={<IconButton><EditIcon /></IconButton>}
 * >
 *   <YourContent />
 * </PanelCard>
 */

import useIsMobile from "@/hooks/useIsMobile";
import { Box, SxProps } from "@mui/material";
import React, { ReactNode } from "react";
import {
  CardBody,
  CardHeader,
  HeaderContent,
  HeaderSubTitle,
  HeaderTitle,
  StyledCard,
} from "./styled";

export interface PanelCardProps {
  /**
   * Title displayed in the card header
   */
  title?: string;
  /**
   * Subtitle displayed in the card header
   */
  subTitle?: string;
  titleGap?: SxProps;
  /**
   * Optional icon element displayed next to the title
   */
  headerIcon?: ReactNode;
  /**
   * Optional element displayed on the right side of the header (e.g., action buttons)
   */
  headerAction?: ReactNode;
  /**
   * Layout for the header action.
   * - absolute (default): floats on top-right in a pill wrapper
   * - inline: sits in the normal header row without wrapper styling
   */
  headerActionLayout?: "absolute" | "inline";
  /**
   * Custom styles for the header action wrapper (only applies to absolute layout)
   */
  headerActionWrapperSx?: SxProps;
  /**
   * Main content of the card
   */
  children: ReactNode;
  /**
   * Optional footer content (e.g., action buttons)
   */
  footer?: ReactNode;
  /**
   * Custom padding for the card body
   */
  bodyPadding?: number | string;
  /**
   * Custom padding for the card header
   */
  headerPadding?: number | string;
  /**
   * Custom padding for the card footer
   */
  footerPadding?: number | string;
  /**
   * Whether to show the header border
   */
  showHeaderBorder?: boolean;
  /**
   * Whether to show the footer border
   */
  showFooterBorder?: boolean;
  /**
   * Custom styles for the card
   */
  sx?: SxProps;
  /**
   * Custom styles for the header
   */
  headerSx?: SxProps;
  subTitleSx?: SxProps;
  /**
   * Custom styles for the body
   */
  bodySx?: SxProps;
  /**
   * Custom styles for the footer
   */
  footerSx?: SxProps;
  /**
   * Click handler for the entire card
   */
  onClick?: () => void;
}

const PanelCard: React.FC<PanelCardProps> = ({
  title,
  subTitle,
  titleGap,
  headerIcon,
  headerAction,
  headerActionLayout = "absolute",
  headerActionWrapperSx,
  children,
  bodyPadding,
  headerPadding,
  showHeaderBorder = true,
  sx,
  headerSx,
  subTitleSx,
  bodySx,
  onClick,
}) => {
  const isMobile = useIsMobile("md");
  return (
    <StyledCard sx={sx} onClick={onClick}>
      {(title || headerIcon || headerAction) && (
        <CardHeader
          sx={{
            padding: headerPadding,
            borderBottom: showHeaderBorder ? undefined : "none",
            ...headerSx,
          }}
        >
          <HeaderContent>
            {headerIcon && <>{headerIcon}</>}
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: "6.41px",
                ...titleGap,
              }}
            >
              {title && <HeaderTitle sx={{ ...headerSx }}>{title}</HeaderTitle>}
              {subTitle && (
                <HeaderSubTitle sx={{ ...subTitleSx }}>
                  {subTitle}
                </HeaderSubTitle>
              )}
            </Box>
          </HeaderContent>
          {headerAction &&
            (headerActionLayout === "inline" ? (
              <Box sx={{ display: "flex", alignItems: "center" }}>
                {headerAction}
              </Box>
            ) : (
              <Box
                sx={{
                  position: "absolute",
                  top: isMobile ? 6 : 12,
                  right: isMobile ? 6 : 12,
                  display: "flex",
                  alignItems: "center",
                  backgroundColor: "secondary.main",
                  borderRadius: "50px",
                  border: "1px solid #E9ECF2",
                  ...headerActionWrapperSx,
                }}
              >
                {headerAction}
              </Box>
            ))}
        </CardHeader>
      )}

      <CardBody
        sx={{
          padding: bodyPadding,
          ...bodySx,
        }}
      >
        {children}
      </CardBody>
    </StyledCard>
  );
};

export default PanelCard;
