import React from "react";
import { Box, useTheme } from "@mui/material";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import TitleDescription from "@/Components/UI/AuthLayout/TitleDescription";
import CustomButton from "@/Components/UI/Buttons";
import useIsMobile from "@/hooks/useIsMobile";

/**
 * SingleQuestionForm — reusable primitives for the "single-question form screen"
 * pattern (UX_FEEDBACK_PATTERNS_2026-09.md, Batch C).
 *
 * Rules baked in:
 *  - One question as the screen H1 + a one-line "why we ask" helper
 *    (centered on phone, left-aligned on desktop) — reuses AuthLayout/TitleDescription.
 *  - Short related fields grouped in a responsive 2-column row (collapse to 1 col
 *    on narrow phones).
 *  - Inline field errors under the field (icon + text, role="alert") — never a toast.
 *  - Sticky footer with ONE primary ("Continue") + a text "Back".
 *
 * Required-marker (red *) + 2px gold accent focus ring live on the shared
 * `InputField` via its `required` / `accentFocus` props so any field (not just
 * ones rendered here) can opt in.
 *
 * Test IDs: form-question-title, form-question-help, field-<name>-error,
 * form-continue, form-back.
 */

export interface QuestionScreenProps {
  title: React.ReactNode;
  help?: React.ReactNode;
  /** Defaults to centered on phone, left on desktop. Override if needed. */
  align?: "left" | "center";
  maxWidth?: number;
  children?: React.ReactNode;
}

export const QuestionScreen: React.FC<QuestionScreenProps> = ({
  title,
  help,
  align,
  maxWidth = 640,
  children,
}) => {
  const isMobile = useIsMobile("sm");
  const resolvedAlign = align ?? (isMobile ? "center" : "left");
  return (
    <Box sx={{ width: "100%" }}>
      <TitleDescription
        align={resolvedAlign}
        title={
          <Box
            component="span"
            data-testid="form-question-title"
            sx={{ fontSize: { xs: 26, md: 30 }, fontWeight: 600, lineHeight: 1.2, fontFamily: "var(--font-sans)" }}
          >
            {title}
          </Box>
        }
        description={
          help ? (
            <Box component="span" data-testid="form-question-help">
              {help}
            </Box>
          ) : undefined
        }
      />
      {children ? (
        <Box
          sx={{
            display: "grid",
            gap: 2,
            mt: 3,
            width: "100%",
            maxWidth,
            mx: resolvedAlign === "center" ? "auto" : 0,
          }}
        >
          {children}
        </Box>
      ) : null}
    </Box>
  );
};

export interface FieldRowProps {
  children: React.ReactNode;
  /** Number of columns on >=360px. Collapses to 1 below that. */
  columns?: 2 | 3;
}

/** Group short related fields side-by-side (First | Last, Postal | City). */
export const FieldRow: React.FC<FieldRowProps> = ({ children, columns = 2 }) => (
  <Box
    sx={{
      display: "grid",
      gridTemplateColumns: {
        xs: "minmax(0,1fr)",
        sm: `repeat(${columns}, minmax(0,1fr))`,
      },
      gap: 1.5,
      width: "100%",
    }}
  >
    {children}
  </Box>
);

export interface FieldErrorProps {
  /** Field name, used for the data-testid: field-<name>-error. */
  name: string;
  children?: React.ReactNode;
}

/** Inline error under a field (icon + text). Renders nothing when empty. */
export const FieldError: React.FC<FieldErrorProps> = ({ name, children }) => {
  const theme = useTheme();
  if (!children) return null;
  return (
    <Box
      role="alert"
      data-testid={`field-${name}-error`}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        mt: 0.5,
        color: theme.palette.error.main,
        fontFamily: "var(--font-sans)",
        fontSize: 12.5,
        lineHeight: 1.3,
      }}
    >
      <ErrorOutlineIcon sx={{ fontSize: 15, flexShrink: 0 }} />
      <span>{children}</span>
    </Box>
  );
};

export interface StickyFormFooterProps {
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  primaryTestId?: string;
  onBack?: () => void;
  backLabel?: string;
}

/** Sticky footer: ONE primary ("Continue") + a quiet text "Back". */
export const StickyFormFooter: React.FC<StickyFormFooterProps> = ({
  primaryLabel,
  onPrimary,
  primaryDisabled,
  primaryLoading,
  primaryTestId = "form-continue",
  onBack,
  backLabel = "Back",
}) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        position: "sticky",
        bottom: 0,
        mt: 3,
        pt: 2,
        pb: `calc(env(safe-area-inset-bottom, 0px) + 8px)`,
        display: "flex",
        flexDirection: "column",
        gap: 1,
        background: `linear-gradient(to top, ${theme.palette.background.paper} 70%, transparent)`,
      }}
    >
      <CustomButton
        variant="primary"
        pill
        size="medium"
        fullWidth
        label={primaryLabel}
        onClick={onPrimary}
        disabled={primaryDisabled || primaryLoading}
        data-testid={primaryTestId}
        sx={{ fontWeight: 700, fontSize: "15px" }}
      />
      {onBack && (
        <Box
          component="button"
          type="button"
          data-testid="form-back"
          onClick={onBack}
          sx={{
            all: "unset",
            textAlign: "center",
            cursor: "pointer",
            fontFamily: "var(--font-sans)",
            fontSize: 13.5,
            fontWeight: 600,
            color: theme.palette.text.secondary,
            py: 0.75,
            borderRadius: "8px",
            "&:hover": { color: theme.palette.text.primary },
            "&:focus-visible": { outline: `2px solid ${theme.palette.primary.main}` },
          }}
        >
          {backLabel}
        </Box>
      )}
    </Box>
  );
};

export default QuestionScreen;
