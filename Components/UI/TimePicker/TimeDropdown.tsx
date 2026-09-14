import useIsMobile from "@/hooks/useIsMobile";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Box, useTheme } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { Text } from "../../Page/CreatePaymentLink/styled";
import { brandFg } from "@/constants/theme";

interface TimeDropdownProps {
  value: string;
  options: string[];
  disabledOptions?: string[];
  onChange: (val: string) => void;
  dropdownHeight?: number;
}

export default function TimeDropdown({
  value,
  options,
  disabledOptions,
  onChange,
  dropdownHeight = 160,
}: TimeDropdownProps) {
  const theme = useTheme();
  const isMobile = useIsMobile("md");
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const optionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const lockedParentRef = useRef<HTMLElement | null>(null);
  const originalOverflowRef = useRef<string | null>(null);

  const handleToggle = () => setOpen((prev) => !prev);
  const handleClose = () => setOpen(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        handleClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!open || !dropdownRef.current) return;

    const selectedEl = optionRefs.current[value];

    if (selectedEl) {
      const dropdown = dropdownRef.current;

      const offsetTop = selectedEl.offsetTop;
      const elementHeight = selectedEl.offsetHeight;
      const dropdownHeight = dropdown.clientHeight;

      dropdown.scrollTop = offsetTop - dropdownHeight / 2 + elementHeight / 2;
    } else {
      dropdownRef.current.scrollTop = 0;
    }
  }, [open, value]);

  useEffect(() => {
    if (!wrapperRef.current) return;

    if (open) {
      let parent = wrapperRef.current.parentElement;

      while (parent) {
        const style = window.getComputedStyle(parent);
        const isScrollable =
          style.overflowY === "auto" || style.overflowY === "scroll";

        if (isScrollable) {
          lockedParentRef.current = parent;
          originalOverflowRef.current = parent.style.overflow;
          parent.style.overflow = "hidden";
          break;
        }

        parent = parent.parentElement;
      }
    } else {
      if (lockedParentRef.current) {
        lockedParentRef.current.style.overflow =
          originalOverflowRef.current || "";
        lockedParentRef.current = null;
        originalOverflowRef.current = null;
      }
    }

    return () => {
      if (lockedParentRef.current) {
        lockedParentRef.current.style.overflow =
          originalOverflowRef.current || "";
      }
    };
  }, [open]);

  return (
    <Box
      ref={wrapperRef}
      sx={{
        border: `1px solid ${theme.palette.border.main}`,
        p: isMobile ? "7px 9px" : "11px 9px",
        borderRadius: "6px",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        position: "relative",
        cursor: "pointer",
      }}
      onClick={handleToggle}
    >
      <Text
        sx={{
          width: isMobile ? "12px" : "22px",
          textAlign: "center",
          fontSize: isMobile ? "10px" : "13px",
          color: theme.palette.text.primary,
        }}
      >
        {value}
      </Text>

      <Box sx={{ display: "flex", gap: "3px", alignItems: "center" }}>
        <Box
          sx={{
            height: "16px",
            width: "1px",
            backgroundColor: theme.palette.secondary.contrastText,
          }}
        />
        {open ? (
          <ExpandLessIcon
            sx={{ fontSize: "16px", color: theme.palette.text.secondary }}
          />
        ) : (
          <ExpandMoreIcon
            sx={{ fontSize: "16px", color: theme.palette.text.secondary }}
          />
        )}
      </Box>

      {open && (
        <Box
          ref={dropdownRef}
          sx={{
            height: dropdownHeight,
            width: "100%",
            position: "absolute",
            top: isMobile ? 32 : 42,
            left: 0,
            border: `1px solid ${theme.palette.border.main}`,
            borderRadius: "6px",
            padding: "7px 9px",
            backgroundColor: theme.palette.background.paper,
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "8px",
            overflowY: "auto",
            boxShadow: "#2F2F6526 0px 4px 16px 0px",
          }}
        >
          {options.map((option) => {
            const isDisabled = disabledOptions?.includes(option);

            return (
              <Box
                ref={(el) => {
                  optionRefs.current[option] = el as HTMLDivElement | null;
                }}
                key={option}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isDisabled) return;
                  onChange(option);
                  handleClose();
                }}
                sx={{
                  opacity: isDisabled ? 0.4 : 1,
                  pointerEvents: isDisabled ? "none" : "auto",
                  minHeight: isMobile ? "28px" : "32px",
                  minWidth: isMobile ? "28px" : "32px",
                  maxHeight: isMobile ? "28px" : "32px",
                  maxWidth: isMobile ? "28px" : "32px",
                  backgroundColor:
                    value === option
                      ? theme.palette.primary.main
                      : theme.palette.background.paper,
                  borderRadius: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  ":hover": {
                    backgroundColor: value === option ? "" : "primary.light",
                  },
                }}
              >
                <Text
                  sx={{
                    fontSize: isMobile ? "10px" : "13px",
                    color:
                      value === option
                        ? theme.palette.common.white
                        : theme.palette.text.primary,
                    ":hover": {
                      color: value === option ? "" : brandFg(theme.palette.mode === "dark"),
                    },
                  }}
                >
                  {option}
                </Text>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
