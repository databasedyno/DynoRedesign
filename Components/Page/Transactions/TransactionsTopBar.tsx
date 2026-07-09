import InputField from "@/Components/UI/AuthLayout/InputFields";
import CustomButton from "@/Components/UI/Buttons";
import CustomDatePicker, { DatePickerRef } from "@/Components/UI/DatePicker";
import CalendarIcon from "@/assets/Icons/calendar-icon.svg";
import ExportIcon from "@/assets/Icons/export-icon.svg";
import SearchIcon from "@/assets/Icons/search-icon.svg";
import WalletIcon from "@/assets/Icons/wallet-icon.svg";
import useIsMobile from "@/hooks/useIsMobile";
import { ALLCRYPTOCURRENCIES } from "@/hooks/useWalletData";
import { DateRange } from "@/utils/types/dashboard";
import { TransactionsTopBarProps } from "@/utils/types/transaction";
import CheckIcon from "@mui/icons-material/Check";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { Box, Typography, useTheme } from "@mui/material";
import { format } from "date-fns";
import Image from "next/image";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import {
  CryptoIconChip,
  DatePickerTriggerButton,
  DatePickerWrapper,
  ExportButtonWrapper,
  FiltersContainer,
  SearchContainer,
  SearchIconButton,
  TransactionsTopBarContainer,
  WalletDropdownContainer,
  WalletListItem,
  WalletSelectorButton,
} from "./styled";

const TransactionsTopBar: React.FC<TransactionsTopBarProps & { initialWallet?: string }> = ({
  onSearch,
  onDateRangeChange,
  onWalletChange,
  onExport,
  initialWallet,
}) => {
  const theme = useTheme();
  const isMobile = useIsMobile("md");
  const isLgMobile = useIsMobile("lg");
  const { t } = useTranslation("transactions");
  const tTransactions = useCallback(
    (key: string) => t(key, { ns: "transactions" }),
    [t],
  );
  const datePickerRef = useRef<DatePickerRef>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const walletButtonRef = useRef<HTMLButtonElement>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: null,
    endDate: null,
  });
  const [selectedWallet, setSelectedWallet] = useState(initialWallet || "all");
  const [walletMenuAnchor, setWalletMenuAnchor] = useState<null | HTMLElement>(
    null,
  );

  // Sync with external wallet selection (e.g., from URL query param)
  useEffect(() => {
    if (initialWallet && initialWallet !== selectedWallet) {
      setSelectedWallet(initialWallet);
    }
  }, [initialWallet]);


  const handleSearch = () => {
    onSearch?.(searchTerm);
  };

  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleDateRangeChange = (range: DateRange) => {
    setDateRange(range);
    onDateRangeChange?.(range);
  };

  const handleWalletChange = (value: string) => {
    setSelectedWallet(value);
    setWalletMenuAnchor(null);
    onWalletChange?.(value);
  };

  const handleWalletButtonClick = (e: React.MouseEvent<HTMLElement>) => {
    setWalletMenuAnchor(e.currentTarget);
  };

  const handleWalletMenuClose = () => {
    setWalletMenuAnchor(null);
  };

  const handleCalendarButtonClick = (e: React.MouseEvent<HTMLElement>) => {
    if (datePickerRef.current) {
      datePickerRef.current.open(e);
    }
  };

  const formatDateRange = (): string => {
    if (dateRange.startDate && dateRange.endDate) {
      if (isMobile) {
        return `${format(dateRange.startDate, "dd.MM.yy")}-${format(
          dateRange.endDate,
          "dd.MM.yy",
        )}`;
      }
      return `${format(dateRange.startDate, "MMM dd, yyyy")} - ${format(
        dateRange.endDate,
        "MMM dd, yyyy",
      )}`;
    }
    if (dateRange.startDate) {
      if (isMobile) {
        return format(dateRange.startDate, "dd.MM.yy");
      }
      return format(dateRange.startDate, "MMM dd, yyyy");
    }
    return isMobile
      ? tTransactions("period")
      : tTransactions("selectDateRange");
  };

  const walletOptions = useMemo(
    () => [
      {
        value: "all",
        label: tTransactions("allWallets"),
        code: "ALL",
        icon: WalletIcon,
      },
      ...ALLCRYPTOCURRENCIES.map((crypto, index) => ({
        value: `wallet${index + 1}`,
        label: crypto.name,
        code: crypto.code,
        icon: crypto.icon,
      })),
    ],
    [tTransactions],
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        walletButtonRef.current &&
        !walletButtonRef.current.contains(event.target as Node)
      ) {
        handleWalletMenuClose();
      }
    };

    if (walletMenuAnchor) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [walletMenuAnchor]);

  const selectedWalletData = useMemo(
    () =>
      walletOptions.find((opt) => opt.value === selectedWallet) || {
        label: tTransactions("allWallets"),
      },
    [selectedWallet, walletOptions, tTransactions],
  );

  return (
    <TransactionsTopBarContainer sx={{ px: { xs: "16px", md: "0px" } }}>
      <SearchContainer>
        <InputField
          inputHeight={isMobile ? "32px" : "40px"}
          placeholder={tTransactions("search")}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={handleSearchKeyPress}
        />
        <SearchIconButton onClick={handleSearch}>
          <Image src={SearchIcon} alt="search" width={20} height={20} className="themed-icon-primary" />
        </SearchIconButton>
      </SearchContainer>

      <FiltersContainer>
        <DatePickerWrapper>
          <DatePickerTriggerButton
            ref={buttonRef}
            onClick={handleCalendarButtonClick}
          >
            <Image
              src={CalendarIcon}
              alt="calendar"
              width={14}
              height={14}
              className="themed-icon"
              style={{
                marginTop: "-3px",
              }}
            />
            <Typography className="date-text">{formatDateRange()}</Typography>
            <Box className="separator" />
            <KeyboardArrowDownIcon className="arrow-icon" />
          </DatePickerTriggerButton>

          <Box
            sx={{
              position: "absolute",
              width: 0,
              height: 0,
              overflow: "hidden",
              opacity: 0,
              pointerEvents: "none",
            }}
          >
            <CustomDatePicker
              ref={datePickerRef}
              value={dateRange}
              onChange={handleDateRangeChange}
              hideTrigger={true}
            />
          </Box>
        </DatePickerWrapper>

        <Box
          ref={walletButtonRef}
          sx={{
            position: "relative",
            width: isMobile ? "fit-content" : "220px",
            zIndex: 1,
          }}
        >
          <WalletSelectorButton onClick={handleWalletButtonClick}>
            <Image src={WalletIcon} alt="wallet" width={17} height={17} className="themed-icon" />
            <Typography className="wallet-text">
              {selectedWalletData.label}
            </Typography>

            <Box sx={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Box className="separator" />
              {walletMenuAnchor ? (
                <ExpandLessIcon className="arrow-icon" />
              ) : (
                <ExpandMoreIcon className="arrow-icon" />
              )}
            </Box>
          </WalletSelectorButton>

          {/* Dropdown Menu */}
          {walletMenuAnchor && (
            <WalletDropdownContainer isMobile={isMobile}>
              <Box className="dropdown-header" onClick={handleWalletMenuClose}>
                <Box sx={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Image src={WalletIcon} alt="wallet" width={17} height={17} className="themed-icon" />
                  <Typography className="header-text">
                    {selectedWalletData.label}
                  </Typography>
                </Box>
                <Box
                  sx={{ display: "flex", alignItems: "center", gap: "10px" }}
                >
                  <Box className="separator" />
                  <ExpandLessIcon className="arrow-icon" />
                </Box>
              </Box>

              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  overflowY: "auto",
                  height: "auto",
                  "@media (max-height: 640px)": { height: "260px" },
                }}
              >
                {walletOptions.map((option) => (
                  <WalletListItem
                    key={option.value}
                    selected={selectedWallet === option.value}
                    onClick={() => {
                      handleWalletChange(option.value);
                      handleWalletMenuClose();
                    }}
                  >
                    <CryptoIconChip
                      sx={{
                        background: theme.palette.secondary.light,
                        height: isMobile ? "24px" : "32px",
                      }}
                    >
                      <Image
                        src={option.icon}
                        alt={option.label}
                        draggable={false}
                      />
                      <Typography component="span" sx={{ fontWeight: 600 }}>
                        {option.code}
                      </Typography>
                    </CryptoIconChip>

                    <Typography className="option-label">
                      {option.label}
                    </Typography>

                    {selectedWallet === option.value && (
                      <CheckIcon sx={{ fontSize: "18px", ml: "auto" }} />
                    )}
                  </WalletListItem>
                ))}
              </Box>
            </WalletDropdownContainer>
          )}
        </Box>

        <ExportButtonWrapper>
          <CustomButton
            label={tTransactions("export")}
            startIcon={
              <Image
                src={ExportIcon}
                alt="export"
                width={isMobile ? 13 : 17}
                height={isMobile ? 13 : 17}
              />
            }
            hideLabel={isLgMobile}
            variant="secondary"
            onClick={onExport}
            sx={{
              padding: isMobile
                ? "15px 10px"
                : isLgMobile
                  ? "18px 16px"
                  : "10px 60px",
              minWidth: "auto",
              height: isLgMobile ? "32px" : "40px",
              fontSize: isLgMobile ? "13px" : "15px",
              fontFamily: "var(--font-sans)",
              fontWeight: 500,
            }}
          />
        </ExportButtonWrapper>
      </FiltersContainer>
    </TransactionsTopBarContainer>
  );
};

export default TransactionsTopBar;
