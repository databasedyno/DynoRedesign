import InputField from "@/Components/UI/AuthLayout/InputFields";
import CustomDatePicker, { DatePickerRef } from "@/Components/UI/DatePicker";
import SearchIcon from "@/assets/Icons/search-icon.svg";
import WalletIcon from "@/assets/Icons/wallet-icon.svg";
import useIsMobile from "@/hooks/useIsMobile";
import useEdgeFade from "@/hooks/useEdgeFade";
import useTableCardView from "@/hooks/useTableCardView";
import { ALLCRYPTOCURRENCIES } from "@/hooks/useWalletData";
import { Icon, MONO } from "@/styles/uiKit";
import { DateRange } from "@/utils/types/dashboard";
import {
  TransactionSourceType,
  TransactionsTopBarProps,
} from "@/utils/types/transaction";
import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import CheckIcon from "@mui/icons-material/Check";
import CodeRounded from "@mui/icons-material/CodeRounded";
import DonutSmallRounded from "@mui/icons-material/DonutSmallRounded";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FavoriteRounded from "@mui/icons-material/FavoriteRounded";
import Inventory2Rounded from "@mui/icons-material/Inventory2Rounded";
import LinkRounded from "@mui/icons-material/LinkRounded";
import PublicRounded from "@mui/icons-material/PublicRounded";
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
  DatePickerWrapper,
  FiltersContainer,
  SearchContainer,
  SearchIconButton,
  SourceChip,
  SourceChipsRow,
  TransactionsTopBarContainer,
  WalletDropdownContainer,
  WalletListItem,
  WalletSelectorButton,
} from "./styled";
import TxRangePresets from "./TxRangePresets";

const TransactionsTopBar: React.FC<TransactionsTopBarProps & { initialWallet?: string; initialSearch?: string; initialDateRange?: DateRange }> = ({
  onSearch,
  onDateRangeChange,
  onWalletChange,
  onSourceChange,
  onOpenFilters,
  activeFilterCount = 0,
  initialWallet,
  initialSource,
  initialSearch,
  initialDateRange,
  range = "30d",
  onRangeChange,
}) => {
  const theme = useTheme();
  const isMobile = useIsMobile("md");
  // < 768px: source / date / wallet live in the bottom-sheet (TransactionsFilterSheet); only search + "Filters" stay inline.
  const cardView = useTableCardView();
  const { t } = useTranslation("transactions");
  const tTransactions = useCallback(
    (key: string, options?: any): string =>
      t(key, { ns: "transactions", ...options }) as unknown as string,
    [t],
  );
  const datePickerRef = useRef<DatePickerRef>(null);
  const walletButtonRef = useRef<HTMLButtonElement>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: null,
    endDate: null,
  });
  const [selectedWallet, setSelectedWallet] = useState(initialWallet || "all");
  const [selectedSource, setSelectedSource] = useState<TransactionSourceType | "all">(
    initialSource || "all",
  );
  const [walletMenuAnchor, setWalletMenuAnchor] = useState<null | HTMLElement>(
    null,
  );

  // Sync with external wallet selection (e.g., from URL query param)
  useEffect(() => {
    if (initialWallet && initialWallet !== selectedWallet) {
      setSelectedWallet(initialWallet);
    }
  }, [initialWallet]);

  useEffect(() => {
    if (initialSource && initialSource !== selectedSource) {
      setSelectedSource(initialSource);
    }
  }, [initialSource]);

  // Move 4 (⌘K palette): show a `?search=` deep-link query in the input.
  useEffect(() => {
    if (initialSearch && initialSearch !== searchTerm) {
      setSearchTerm(initialSearch);
    }
  }, [initialSearch]);

  // Dates applied from the phone filter sheet — keep the desktop trigger label in sync.
  useEffect(() => {
    if (initialDateRange) setDateRange(initialDateRange);
  }, [initialDateRange?.startDate, initialDateRange?.endDate]);

  const handleSourceChange = (value: TransactionSourceType | "all") => {
    setSelectedSource(value);
    onSourceChange?.(value);
  };

  // Source filter chips — the 5 revenue streams Dynopay now supports.
  // Icons chosen to match the sidebar / feature entrypoints so the mental
  // model transfers ("Tips" = ✨, "Products" = 📦, etc.).
  const sourceChips: Array<{
    value: TransactionSourceType | "all";
    label: string;
    icon: React.ReactNode;
  }> = useMemo(() => {
    const iconSize = 15;
    return [
      {
        value: "all",
        label: tTransactions("sourceAll", { defaultValue: "All" }),
        icon: <PublicRounded sx={{ fontSize: iconSize }} />,
      },
      {
        value: "payment_link",
        label: tTransactions("sourcePaymentLinks", { defaultValue: "Payment links" }),
        icon: <LinkRounded sx={{ fontSize: iconSize }} />,
      },
      {
        value: "api",
        label: tTransactions("sourceApi", { defaultValue: "API" }),
        icon: <CodeRounded sx={{ fontSize: iconSize }} />,
      },
      {
        value: "contribution",
        label: tTransactions("sourceContributions", { defaultValue: "Donations" }),
        icon: <FavoriteRounded sx={{ fontSize: iconSize }} />,
      },
      {
        value: "tip",
        label: tTransactions("sourceTips", { defaultValue: "Tips" }),
        icon: <AutoAwesomeRounded sx={{ fontSize: iconSize }} />,
      },
      {
        value: "product",
        label: tTransactions("sourceProducts", { defaultValue: "Store" }),
        icon: <Inventory2Rounded sx={{ fontSize: iconSize }} />,
      },
      {
        value: "direct",
        label: tTransactions("sourceDirect", { defaultValue: "Direct" }),
        icon: <DonutSmallRounded sx={{ fontSize: iconSize }} />,
      },
    ];
  }, [tTransactions]);


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

  const customRangeLabel = (): string => {
    if (dateRange.startDate && dateRange.endDate) {
      return `${format(dateRange.startDate, "MMM d")} – ${format(dateRange.endDate, "MMM d")}`;
    }
    return tTransactions("customShort", { defaultValue: "Custom" });
  };

  const rangePresets = (
    <TxRangePresets
      range={range}
      customLabel={customRangeLabel()}
      onChange={(preset) => onRangeChange?.(preset)}
      onOpenCustom={(anchor) => {
        if (cardView) onOpenFilters?.();
        else datePickerRef.current?.open({ currentTarget: anchor });
      }}
    />
  );

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

  // Swipe affordance for the horizontally-scrolling source filter chips —
  // softly fades whichever edge still has chips off-screen (§ Scroll Hints).
  const chipsFade = useEdgeFade<HTMLDivElement>();

  return (
    <TransactionsTopBarContainer sx={{ px: { xs: "16px", md: "0px" } }}>
      {/* Source filter chips — added Session 48 UX. Lets the merchant slice
          transactions by revenue source (payment link / contribution / tip /
          product order / direct). Moves into the bottom sheet below 768px. */}
      {!cardView && (
      <SourceChipsRow
        ref={chipsFade.ref}
        role="tablist"
        aria-label={tTransactions("sourceFilterLabel", {
          defaultValue: "Filter by transaction source",
        }) as string}
        data-testid="transactions-source-chips"
        sx={{ WebkitMaskImage: chipsFade.WebkitMaskImage, maskImage: chipsFade.maskImage }}
      >
        {sourceChips.map((chip) => {
          const isSelected = selectedSource === chip.value;
          return (
            <SourceChip
              key={chip.value}
              role="tab"
              aria-selected={isSelected}
              data-testid={`transactions-source-chip-${chip.value}`}
              selected={isSelected}
              onClick={() => handleSourceChange(chip.value)}
            >
              {chip.icon}
              <span className="chip-label">{chip.label}</span>
            </SourceChip>
          );
        })}
      </SourceChipsRow>
      )}

      <SearchContainer sx={cardView ? { flex: "1 1 0 !important", minWidth: 0 } : undefined}>
        <InputField
          inputHeight={cardView ? "40px" : isMobile ? "32px" : "40px"}
          placeholder={tTransactions("search")}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={handleSearchKeyPress}
        />
        <SearchIconButton onClick={handleSearch} aria-label={tTransactions("search")}>
          <Image src={SearchIcon} alt="" width={20} height={20} className="themed-icon-primary" />
        </SearchIconButton>
      </SearchContainer>

      {cardView && (
        <Box
          component="button"
          type="button"
          data-testid="transactions-filters-btn"
          data-active-count={activeFilterCount}
          aria-label={tTransactions("filters", { defaultValue: "Filters" })}
          onClick={onOpenFilters}
          sx={{
            flexShrink: 0,
            display: "inline-flex",
            alignItems: "center",
            gap: 0.75,
            height: 40,
            px: 1.5,
            borderRadius: "12px",
            border: `1px solid ${activeFilterCount ? theme.palette.primary.main : theme.palette.border.main}`,
            backgroundColor: activeFilterCount ? theme.palette.primary.light : theme.palette.background.paper,
            color: theme.palette.text.primary,
            fontFamily: "var(--font-sans)",
            fontSize: 13.5,
            fontWeight: 600,
            cursor: "pointer",
            transition: "background-color 150ms ease, border-color 150ms ease",
          }}
        >
          <Icon name="sliders-horizontal" size={16} />
          {tTransactions("filters", { defaultValue: "Filters" })}
          {activeFilterCount > 0 && (
            <Box
              component="span"
              data-testid="transactions-filters-count"
              sx={{ minWidth: 20, height: 20, px: 0.5, borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center", backgroundColor: theme.palette.primary.main, color: theme.palette.primary.contrastText, fontFamily: MONO, fontSize: 11.5, fontWeight: 700, lineHeight: 1 }}
            >
              {activeFilterCount}
            </Box>
          )}
        </Box>
      )}

      {cardView && (
        <Box data-testid="transactions-range-row-phone" sx={{ flexBasis: "100%", minWidth: 0, display: "flex" }}>
          {rangePresets}
        </Box>
      )}

      {!cardView && (
      <FiltersContainer>
        <DatePickerWrapper>
          {rangePresets}

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
      </FiltersContainer>
      )}
    </TransactionsTopBarContainer>
  );
};

export default TransactionsTopBar;
