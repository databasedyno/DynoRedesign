import {
  ExpireDropdown,
  ExpireText,
  ExpireTrigger,
} from "@/Components/Page/CreatePaymentLink/styled";
import useIsMobile from "@/hooks/useIsMobile";
import { ExpireSelectorProps } from "@/utils/types/create-pay-link";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Box,
  ListItemButton,
  ListItemText,
  Popover,
  Typography,
  useTheme,
} from "@mui/material";
import React, { useEffect, useRef, useState } from "react";

const ExpireSelector: React.FC<ExpireSelectorProps> = ({
  tPaymentLink,
  label,
  value = "No",
  onChange,
  error = false,
  helperText,
  fullWidth = true,
  required = false,
}) => {
  // Backend accepts exactly these preset windows: 'No' | '24h' | '7d' | '30d'.
  // (Session: replaced the old No/Yes + free-form date picker, whose "yes"
  // value + custom date were never accepted by the API → 400 error.)
  const expireOptions = [
    { value: "No", label: tPaymentLink("noExpiration") },
    { value: "24h", label: tPaymentLink("expire24h") },
    { value: "7d", label: tPaymentLink("expire7d") },
    { value: "30d", label: tPaymentLink("expire30d") },
  ];
  const theme = useTheme();
  const isMobile = useIsMobile("sm");

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const isOpen = Boolean(anchorEl);

  const handleOpen = (e: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSelect = (val: string) => {
    onChange?.(val);
    handleClose();
  };

  // Click outside handler (same as CurrencySelector)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node) &&
        anchorEl &&
        !(anchorEl as HTMLElement).contains(event.target as Node)
      ) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, anchorEl]);

  const borderColor = error
    ? theme.palette.error.main
    : theme.palette.border.main;

  const focusBorderColor = error
    ? theme.palette.error.main
    : theme.palette.border.focus;

  // Normalise legacy values ("no"/"yes") from previously-created links so the
  // trigger shows a valid preset instead of falling back silently.
  const normalizedValue = value === "no" || value === "yes" ? "No" : value;
  const selected =
    expireOptions.find((o) => o.value === normalizedValue) || expireOptions[0];

  return (
    <Box
      sx={{
        width: fullWidth ? "100%" : "auto",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
      }}
    >
      {label && (
        <Typography
          sx={{
            fontFamily: "var(--font-sans)",
            fontSize: isMobile ? "13px" : "15px",
            fontWeight: 500,
            color: theme.palette.text.primary,
            lineHeight: 1.2,
          }}
        >
          {label} {required && "*"}
        </Typography>
      )}

      <Box sx={{ width: "100%" }}>
        <ExpireTrigger
          ref={triggerRef}
          onClick={handleOpen}
          role="button"
          tabIndex={0}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label={label ? String(label) : undefined}
          data-testid="expire-selector-trigger"
          onKeyDown={(e: React.KeyboardEvent<HTMLElement>) => {
            if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
              e.preventDefault();
              handleOpen(e);
            }
          }}
          isOpen={isOpen}
          isMobile={isMobile}
          fullWidth={fullWidth}
          sx={{
            borderColor,
            borderRadius: "6px",
            "&:hover": { borderColor: focusBorderColor },
            "&:focus": { borderColor: focusBorderColor },
            "&:focus-visible": { borderColor: focusBorderColor },
            "&:active": { borderColor: focusBorderColor },
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", flex: 1 }}>
            <ExpireText isMobile={isMobile}>{selected.label}</ExpireText>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center" }}>
            {isOpen ? (
              <ExpandLessIcon
                sx={{
                  color: theme.palette.text.secondary,
                  fontSize: isMobile ? "18px" : "20px",
                }}
              />
            ) : (
              <ExpandMoreIcon
                sx={{
                  color: theme.palette.text.secondary,
                  fontSize: isMobile ? "18px" : "20px",
                }}
              />
            )}
          </Box>
        </ExpireTrigger>

        <Popover
          anchorEl={anchorEl}
          open={isOpen}
          onClose={handleClose}
          anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
          transformOrigin={{ vertical: "top", horizontal: "left" }}
          PaperProps={{
            sx: {
              mt: "2px",
              borderRadius: "6px",
              overflow: "hidden",
              width: triggerRef.current?.offsetWidth || "auto",
              border: `1px solid ${borderColor}`,
              borderTop: "none",
              maxHeight: "200px",
              backgroundColor: theme.palette.background.paper,
              boxShadow: "0px 4px 16px 0px rgba(47, 47, 101, 0.15)",
            },
          }}
        >
          <ExpireDropdown>
            {expireOptions.map((option) => (
              <ListItemButton
                key={option.value}
                onClick={() => handleSelect(option.value)}
                selected={option.value === normalizedValue}
                sx={{
                  maxHeight: "36px",
                  borderRadius: "50px",
                  p: "10px 0px 10px 20px",
                  background:
                    option.value === normalizedValue
                      ? theme.palette.primary.light
                      : "transparent",
                  "&:hover": {
                    background: theme.palette.primary.light,
                  },
                  "&.Mui-selected": {
                    background: theme.palette.primary.light,
                    "&:hover": {
                      background: theme.palette.primary.light,
                    },
                  },
                }}
              >
                <ListItemText
                  primary={option.label}
                  primaryTypographyProps={{
                    sx: {
                      fontFamily: "var(--font-sans)",
                      fontWeight: 500,
                      fontSize: isMobile ? "12px" : "14px",
                      color: theme.palette.text.primary,
                      lineHeight: 1.2,
                      textTransform: "capitalize",
                    },
                  }}
                />
              </ListItemButton>
            ))}
          </ExpireDropdown>
        </Popover>

        {helperText && (
          <Typography
            sx={{
              mt: "4px",
              fontSize: isMobile ? "10px" : "13px",
              fontWeight: 500,
              color: error
                ? theme.palette.error.main
                : theme.palette.text.secondary,
            }}
          >
            {helperText}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default ExpireSelector;
