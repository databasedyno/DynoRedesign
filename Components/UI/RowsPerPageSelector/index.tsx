import MenuIcon from "@/assets/Icons/menu-icon.svg";
import CheckIcon from "@/assets/Icons/true-icon.svg";
import useIsMobile from "@/hooks/useIsMobile";
import { RowsPerPageSelectorProps } from "@/utils/types/transaction";
import { KeyboardArrowDown } from "@mui/icons-material";
import { Box, MenuList, Popover, Typography, useTheme } from "@mui/material";
import Image from "next/image";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CustomSelect,
  CustomSelectValue,
  RowsPerPageContainer,
  VerticalSeparator,
} from "./styled";

const RowsPerPageSelector: React.FC<RowsPerPageSelectorProps> = ({
  value,
  onChange,
  menuItems = [
    { value: 5, label: 5 },
    { value: 10, label: 10 },
    { value: 15, label: 15 },
    { value: 20, label: 20 },
  ],
}) => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const selectRef = useRef<HTMLDivElement>(null);
  const open = Boolean(anchorEl);
  const isMobile = useIsMobile("md");
  const { t } = useTranslation("transactions");
  const tRowsPerPageSelector = useCallback(
    (key: string, options?: any): string => {
      const result = t(key, { ns: "transactions", ...options });
      return typeof result === "string" ? result : String(result);
    },
    [t],
  );

  const handleClick = (event: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSelect = (selectedValue: number) => {
    onChange(selectedValue);
    handleClose();
  };

  const selectedLabel =
    menuItems.find((item) => item.value === value)?.label || value;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        selectRef.current &&
        !selectRef.current.contains(event.target as Node)
      ) {
        handleClose();
      }
    };

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  return (
    <RowsPerPageContainer>
      <Image
        src={MenuIcon}
        alt="menu"
        width={isMobile ? 12 : 15}
        height={isMobile ? 12 : 15}
      />
      <Typography
        variant="body2"
        sx={{
          color: theme.palette.text.secondary,
          fontSize: "13px",
          fontWeight: 500,
          fontFamily: "var(--font-sans)",
          lineHeight: "16px",
          [theme.breakpoints.down("md")]: {
            display: "none",
          },
        }}
      >
        {tRowsPerPageSelector("rowsPerPage")}:
      </Typography>
      <VerticalSeparator />
      <Box ref={selectRef} sx={{ position: "relative" }}>
        <CustomSelect
          onClick={handleClick}
          role="button"
          tabIndex={0}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={tRowsPerPageSelector("rowsPerPage")}
          data-testid="rows-per-page-trigger"
          onKeyDown={(e: React.KeyboardEvent<HTMLElement>) => {
            if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
              e.preventDefault();
              handleClick(e);
            }
          }}
        >
          <CustomSelectValue>{selectedLabel}</CustomSelectValue>
          <KeyboardArrowDown
            sx={{
              fontSize: "18px",
              color: theme.palette.text.primary,
              transition: "transform 0.2s",
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
              [theme.breakpoints.down("md")]: {
                fontSize: "14px",
              },
            }}
          />
        </CustomSelect>
        <Popover
          open={open}
          anchorEl={anchorEl}
          onClose={handleClose}
          anchorOrigin={{
            vertical: "bottom",
            horizontal: "left",
          }}
          transformOrigin={{
            vertical: "top",
            horizontal: "left",
          }}
          PaperProps={{
            sx: {
              mt: "4px",
              borderRadius: "8px",
              boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.15)",
              border: `1px solid ${theme.palette.border.main}`,
              minWidth: selectRef.current?.offsetWidth || "80px",
            },
          }}
        >
          <MenuList
            sx={{
              padding: "10px 6px",
              width: isMobile ? "80px" : "88px",
              display: "flex",
              flexDirection: "column",
              gap: "2px",
            }}
          >
            {menuItems.map((item) => (
              <Box
                key={item.value}
                component="button"
                type="button"
                role="option"
                aria-selected={item.value === value}
                data-testid={`rows-per-page-option-${item.value}`}
                onClick={() => handleSelect(item.value)}
                sx={{
                  width: "100%",
                  border: 0,
                  font: "inherit",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                  borderRadius: "82px",
                  backgroundColor:
                    item.value === value
                      ? theme.palette.primary.light
                      : "transparent",
                  "&:hover": {
                    backgroundColor: theme.palette.primary.light,
                  },
                }}
              >
                <Typography
                  sx={{
                    fontSize: "15px",
                    fontWeight: 500,
                    fontFamily: "var(--font-sans)",
                    lineHeight: "18px",
                    padding: "8px 12px",
                  }}
                >
                  {item.label}
                </Typography>

                {item.value === value && (
                  <Image
                    src={CheckIcon}
                    alt="check"
                    width={11}
                    height={8}
                    style={{ marginRight: 12 }}
                  />
                )}
              </Box>
            ))}
          </MenuList>
        </Popover>
      </Box>
    </RowsPerPageContainer>
  );
};

export default RowsPerPageSelector;
