import { brandFg } from "@/constants/theme";
import { useCompanyStore } from "@/contexts/CompanyDataContext";
import LinkIcon from "@/assets/Icons/link-icon.svg";
import RoundedStackIcon from "@/assets/Icons/roundedStck-icon.svg";
import AddWalletModal from "@/Components/UI/AddWalletModal";
import DeleteWalletModal from "@/Components/UI/DeleteWalletModal";
import CustomButton from "@/Components/UI/Buttons";
import EmptyDataModel from "@/Components/UI/EmptyDataModel";
import PanelCard from "@/Components/UI/PanelCard";
import { formatNumberWithComma, getCurrencySymbol } from "@/helpers";
import useIsMobile from "@/hooks/useIsMobile";
import { useWalletData } from "@/hooks/useWalletData";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { useWalletStore } from "@/contexts/WalletDataContext";
import { WalletDataType } from "@/utils/types/wallet";
import { getNetworkLabel, isTokenOnOtherChain } from "@/utils/networkLabels";
import { buildSharedAddressMap, normalizeAddress, sharedNetworksFor } from "@/utils/sharedAddresses";
import SharedAddressTag from "@/Components/UI/SharedAddressTag";
import SharedHighlightBar from "./SharedHighlightBar";
import { Icon, MONO } from "@/styles/uiKit";
import { getAssetColor } from "@/helpers/assetColor";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";
import { Box, Grid, Skeleton, Tooltip, Typography, useTheme } from "@mui/material";
import Image from "next/image";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import WalletTotalHero from "./WalletTotalHero";
import WalletReuseNudge from "./WalletReuseNudge";
import CopyInline from "@/Components/UX/CopyInline";
import { maskAddress } from "@/helpers/maskAddress";
import {
  HeaderIcon,
  WalletCardBody,
  WalletCardBodyRow,
  WalletEditButton,
  WalletHeaderAction,
  WalletLabel,
} from "./styled";

const Wallet = ({ onAddWallet }: { onAddWallet?: () => void }) => {
  const isMobile = useIsMobile("md");
  const dispatch = useDispatch();
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const { t } = useTranslation("walletScreen");
  const tWallet = useCallback(
    (key: string, options?: any): string => {
      const result = t(key, { ns: "walletScreen", ...options });
      return typeof result === "string" ? result : String(result);
    },
    [t],
  );

  const router = useRouter();
  const [openEditModal, setOpenEditModal] = useState(false);
  const [editWalletCrypto, setEditWalletCrypto] = useState("");
  const [editWalletId, setEditWalletId] = useState<string | number | undefined>(undefined);
  const [editWalletName, setEditWalletName] = useState("");
  const [editWalletAddress, setEditWalletAddress] = useState("");
  const [editDestinationTag, setEditDestinationTag] = useState("");
  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string | number; type: string; address: string } | null>(null);
  // Addresses are masked by default (first 8 + last 6); reveal is per card, per visit.
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());
  const isRevealed = (id: string | number) => revealed.has(String(id));
  const toggleReveal = (id: string | number) =>
    setRevealed((prev) => {
      const next = new Set(prev);
      const key = String(id);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const selectedCompanyId = useCompanyStore().selectedCompanyId;
  const { refetchWallets } = useWalletStore();

  const { walletLoading, walletData } = useWalletData();
  // Shared-address tags: one address saved under several networks (plan backlog P2).
  const sharedMap = useMemo(() => buildSharedAddressMap(walletData), [walletData]);
  // Tap a tag → highlight every sibling card sharing that address, dim the rest.
  const [highlightAddr, setHighlightAddr] = useState<string | null>(null);
  const toggleHighlight = (w: WalletDataType) =>
    setHighlightAddr((prev) => {
      const key = normalizeAddress(w.walletAddress);
      return prev === key ? null : key;
    });
  const isHighlighted = (w: WalletDataType) => !!highlightAddr && normalizeAddress(w.walletAddress) === highlightAddr;
  const highlighted = useMemo(
    () => (highlightAddr ? walletData.filter((w) => normalizeAddress(w.walletAddress) === highlightAddr) : []),
    [walletData, highlightAddr],
  );
  useEffect(() => {
    if (highlightAddr && highlighted.length < 2) setHighlightAddr(null);
  }, [highlightAddr, highlighted.length]);
  useEffect(() => {
    if (!highlightAddr) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setHighlightAddr(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [highlightAddr]);
  const jumpToCard = (id: string | number) =>
    document.getElementById(`wallet-card-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });

  const handleEdit = (wallet: WalletDataType) => {
    setEditWalletCrypto(wallet.walletTitle);
    setEditWalletId(wallet.id);
    setEditWalletName(wallet.walletName || wallet.name);
    setEditWalletAddress(wallet.walletAddress);
    setEditDestinationTag(wallet.destinationTag || "");
    setOpenEditModal(true);
  };

  const handleDelete = (wallet: WalletDataType) => {
    setDeleteTarget({ id: wallet.id, type: wallet.walletTitle, address: wallet.walletAddress });
    setOpenDeleteModal(true);
  };

  const handleWalletDeleted = () => {
    dispatch({
      type: TOAST_SHOW,
      payload: { message: "Wallet deleted successfully", severity: "success" },
    });
    // Re-fetch wallets
    refetchWallets();
  };

  if (walletLoading && walletData.length === 0) {
    // Skeleton grid mirroring the wallet-card layout — shown on first load AND
    // the instant a merchant switches company (SWR key changes → cache miss),
    // so the refresh feels immediate instead of a blank spinner.
    return (
      <Box
        data-testid="wallet-list-skeleton"
        sx={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          mt: isMobile ? 1 : 0,
          pb: { xs: "70px", lg: "0" },
        }}
      >
        <Skeleton
          variant="rounded"
          height={isMobile ? 110 : 132}
          sx={{ borderRadius: "16px" }}
        />
        <Grid container spacing={isMobile ? "12px" : 2.7}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Grid item xs={12} md={6} key={i}>
              <Skeleton
                variant="rounded"
                height={isMobile ? 190 : 220}
                sx={{ borderRadius: "16px" }}
              />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  if (walletData.length === 0 && !walletLoading) {
    return (
      <>
        {/* Wallets are per-account: if another account already has addresses,
            offer them here instead of making the merchant retype anything. */}
        <WalletReuseNudge onAddWallet={onAddWallet} />
        <EmptyDataModel pageName="wallet" onAddWallet={onAddWallet} />
      </>
    );
  }

  return (
    <Box
      sx={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        mt: isMobile ? 1 : 0,
        pb: { xs: "70px", lg: "0" },
      }}
    >
      {/* Aurora total-processed hero — 2026-08-05 design audit Phase 3.
          Only render when the user actually has wallets configured, so first-
          time visitors see the empty-state warning banner (already surfaced
          via setPageWarning) instead of an unhelpful "$0.00" hero. */}
      {walletData.length > 0 && <WalletTotalHero />}
      <SharedHighlightBar wallets={highlighted} onJump={jumpToCard} onClear={() => setHighlightAddr(null)} />
      <Grid container spacing={isMobile ? "12px" : 2.7}>
        {walletData.map((wallet, index) => {
          const accent = getAssetColor(wallet.walletTitle);
          const lit = isHighlighted(wallet);
          const dimmed = !!highlightAddr && !lit;
          const ring = dark ? "#818CF8" : "#4338CA";
          return (
          <Grid
            item
            xs={12}
            md={6}
            xl={4}
            key={index}
            id={`wallet-card-${wallet.id}`}
            data-testid={`wallet-card-${wallet.id}`}
            data-highlight={lit ? "true" : dimmed ? "dimmed" : "none"}
            sx={{
              opacity: 0,
              transform: "translateY(20px)",
              animation: "cardFadeUp 320ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
              animationDelay: `${index * 0.12}s`,

              "@keyframes cardFadeUp": {
                "0%": {
                  opacity: 0,
                  transform: "translateY(20px)",
                },
                "100%": {
                  opacity: 1,
                  transform: "translateY(0)",
                },
              },
            }}
          >
            <PanelCard
              sx={{
                position: "relative",
                overflow: "hidden",
                backgroundColor: dark ? CB_TOKENS.surface.dark : CB_TOKENS.surface.light,
                border: `1px solid ${lit ? ring : dark ? CB_TOKENS.border.dark : CB_TOKENS.border.light}`,
                // Shared-address highlight: siblings get an accent ring, the rest fade back.
                boxShadow: lit ? `0 0 0 2px ${ring}, 0 10px 28px ${dark ? "rgba(129,140,248,0.28)" : "rgba(67,56,202,0.22)"}` : "none",
                opacity: dimmed ? 0.38 : 1,
                transition: "opacity 220ms ease, box-shadow 220ms ease, border-color 220ms ease",
                // Coin brand-colour top accent — identifies each chain at a glance.
                "&::before": {
                  content: '""',
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: "3px",
                  background: `linear-gradient(90deg, ${accent}, ${accent}66)`,
                  zIndex: 2,
                },
              }}
              title={wallet.name}
              headerIcon={
                <HeaderIcon
                  sx={{
                    backgroundColor: `${accent}1F`,
                    borderColor: `${accent}3D`,
                    "&:hover": { backgroundColor: `${accent}2E` },
                  }}
                >
                  <Image
                    src={wallet.icon}
                    alt={wallet.name}
                    draggable={false}
                  />
                </HeaderIcon>
              }
              showHeaderBorder={false}
              // H3 — tighter mobile padding so 13 wallet cards don't require a mile of scroll.
              headerPadding={
                isMobile
                  ? theme.spacing(1.25, 1.75, 0, 1.75)
                  : theme.spacing(2.5, 2.5, 0, 2.5)
              }
              bodyPadding={
                isMobile
                  ? theme.spacing(1, 1.75, 1.5, 1.75)
                  : theme.spacing(3, 2.5, 2.5, 2.5)
              }
              headerAction={
                <WalletHeaderAction>
                  <Image
                    src={wallet.icon}
                    alt={wallet.name}
                    draggable={false}
                  />
                  <span>
                    {(() => {
                      // Show the BASE asset ticker here; the network chip beside
                      // it already conveys the chain. Long variant codes like
                      // "USDT-POLYGON" used to overflow the (absolutely-positioned)
                      // header badge and overlap the card title.
                      const n = wallet.name || "";
                      if (n.startsWith("USDT")) return "USDT";
                      if (n.startsWith("USDC")) return "USDC";
                      if (n.startsWith("RLUSD")) return "RLUSD";
                      if (wallet.walletTitle === "POLYGON") return "POL";
                      return wallet.walletTitle;
                    })()}
                  </span>
                  {/* Network chip — prevents wrong-chain send mistakes. */}
                  {(() => {
                    const netLabel = getNetworkLabel(wallet.name);
                    if (!netLabel) return null;
                    const tokenOnOther = isTokenOnOtherChain(wallet.name);
                    return (
                      <Tooltip
                        placement="top"
                        arrow
                        title={
                          tokenOnOther
                            ? tWallet("networkTokenChipTooltip", "Token on this network — only send on the matching chain.")
                            : tWallet("networkChipTooltip", "Network / chain this address belongs to.")
                        }
                      >
                        <Box
                          component="span"
                          data-testid={`wallet-network-chip-${wallet.name}`}
                          sx={{
                            ml: 0.75,
                            fontFamily: "var(--font-sans), sans-serif",
                            fontWeight: 600,
                            fontSize: isMobile ? 10 : 11,
                            lineHeight: 1,
                            letterSpacing: "0.2px",
                            padding: isMobile ? "3px 6px" : "3px 8px",
                            borderRadius: 999,
                            display: "inline-flex",
                            alignItems: "center",
                            border: `1px solid ${tokenOnOther ? theme.palette.warning?.main || "#F59E0B" : theme.palette.border?.main || theme.palette.divider}`,
                            color: tokenOnOther
                              ? theme.palette.warning?.main || "#F59E0B"
                              : theme.palette.text.secondary,
                            backgroundColor: tokenOnOther
                              ? (theme.palette.mode === "dark" ? "rgba(245,158,11,0.10)" : "rgba(245,158,11,0.08)")
                              : (theme.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)"),
                            textTransform: "none",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {netLabel}
                        </Box>
                      </Tooltip>
                    );
                  })()}
                </WalletHeaderAction>
              }
            >
              <WalletCardBody>
                <WalletCardBodyRow>
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      gap: isMobile ? 0.5 : 1.25,
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    <WalletLabel>
                      <Image src={LinkIcon} alt="Address" draggable={false} className="themed-icon" />
                      <span>{tWallet("address")}</span>
                      <SharedAddressTag
                        networks={sharedNetworksFor(sharedMap, wallet)}
                        size={isMobile ? "sm" : "md"}
                        testId={`wallet-shared-tag-${wallet.id}`}
                        active={lit}
                        onClick={() => toggleHighlight(wallet)}
                      />
                    </WalletLabel>
                    <Typography
                      data-testid={`wallet-address-${wallet.id}`}
                      data-revealed={isRevealed(wallet.id) ? "true" : "false"}
                      title={isRevealed(wallet.id) ? wallet.walletAddress : undefined}
                      sx={{
                        fontFamily: MONO,
                        fontSize: isMobile ? "13px" : "14px",
                        color: theme.palette.text.primary,
                        letterSpacing: "0.2px",
                        lineHeight: "18px",
                        padding: isMobile ? "10px 12px" : "11px 14px",
                        borderRadius: "10px",
                        border: `1px solid ${theme.palette.border.main}`,
                        backgroundColor: theme.palette.background.paper,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        userSelect: isRevealed(wallet.id) ? "text" : "none",
                      }}
                    >
                      {isRevealed(wallet.id) ? wallet.walletAddress : maskAddress(wallet.walletAddress)}
                    </Typography>
                  </Box>
                  <Tooltip
                    title={
                      isRevealed(wallet.id)
                        ? tWallet("hideAddress", { defaultValue: "Hide address" })
                        : tWallet("revealAddress", { defaultValue: "Show full address" })
                    }
                  >
                    <WalletEditButton
                      onClick={() => toggleReveal(wallet.id)}
                      aria-pressed={isRevealed(wallet.id)}
                      aria-label={
                        isRevealed(wallet.id)
                          ? tWallet("hideAddress", { defaultValue: "Hide address" })
                          : tWallet("revealAddress", { defaultValue: "Show full address" })
                      }
                      data-testid={`wallet-address-reveal-${wallet.id}`}
                    >
                      <Icon name={isRevealed(wallet.id) ? "eye-off" : "eye"} size={isMobile ? 15 : 17} />
                    </WalletEditButton>
                  </Tooltip>
                  <CopyInline
                    variant="boxed"
                    value={wallet.walletAddress}
                    size={isMobile ? 15 : 17}
                    testId={`wallet-address-copy-${wallet.id}`}
                    copyLabel={tWallet("copyAddress", { defaultValue: "Copy address" })}
                    copiedLabel={tWallet("addressCopied")}
                    onCopied={(ok) => {
                      if (!ok) {
                        dispatch({
                          type: TOAST_SHOW,
                          payload: {
                            message: tWallet("copyFailed", { defaultValue: "Couldn't copy — try again" }),
                            severity: "error",
                          },
                        });
                      }
                    }}
                    sx={{ borderRadius: "6px", [theme.breakpoints.down("md")]: { width: 44, height: 44 } }}
                  />
                </WalletCardBodyRow>
                <WalletCardBodyRow>
                  {isMobile ? (
                    /* H3 — MOBILE: inline "Total processed" label + value on one row
                       instead of stacked, saving ~30px per card. Was
                       ~205px tall, now ~150px. */
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        width: "100%",
                        gap: 1,
                      }}
                    >
                      <WalletLabel sx={{ margin: 0 }}>
                        <Image
                          src={RoundedStackIcon}
                          alt="Total processed"
                          draggable={false}
                        />
                        <span>{tWallet("totalProcessed")}</span>
                      </WalletLabel>
                      <Typography
                        sx={{
                          fontSize: "15px",
                          fontWeight: 600,
                          color: theme.palette.text.primary,
                          lineHeight: "18px",
                          fontFamily: MONO,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {getCurrencySymbol(
                          "USD",
                          formatNumberWithComma(wallet.totalProcessed),
                        )}
                      </Typography>
                    </Box>
                  ) : (
                    <Box
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 1.25,
                      }}
                    >
                      <WalletLabel>
                        <Image
                          src={RoundedStackIcon}
                          alt="Total processed"
                          draggable={false}
                        />
                        <span>{tWallet("totalProcessed")}</span>
                      </WalletLabel>
                      <Typography
                        sx={{
                          fontSize: "20px",
                          fontWeight: 500,
                          color: theme.palette.text.primary,
                          lineHeight: "24px",
                          fontFamily: MONO,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {getCurrencySymbol(
                          "USD",
                          formatNumberWithComma(wallet.totalProcessed),
                        )}
                      </Typography>
                    </Box>
                  )}
                </WalletCardBodyRow>

                <Box sx={{ marginTop: isMobile ? "0px" : "4px" }}>
                  <WalletCardBodyRow>
                    <CustomButton
                      onClick={() => {
                        router.push(`/transactions?wallet=${encodeURIComponent(wallet.walletTitle)}`);
                      }}
                      label={tWallet("viewTransactions")}
                      variant="outlined"
                      endIcon={<Icon name="arrow-up-right" size={isMobile ? 13 : 16} />}
                      sx={{
                        backgroundColor: theme.palette.background.paper,
                        color: brandFg(theme.palette.mode === "dark"),
                        border: `1px solid ${theme.palette.primary.main}`,
                        borderRadius: "6px",
                        fontSize: isMobile ? "13px" : "15px",
                        fontWeight: 500,
                        fontFamily: "var(--font-sans)",
                        lineHeight: "18px",
                        px: isMobile ? "12px" : "24px",
                        py: isMobile ? "5px" : "11px",
                        height: isMobile ? "28px" : "40px",
                        gap: isMobile ? "6px" : "10px",
                        "&:hover": {
                          backgroundColor: theme.palette.background.paper,
                          color: brandFg(theme.palette.mode === "dark"),
                          border: `1px solid ${theme.palette.primary.main}`,
                        },
                      }}
                    />

                    <WalletEditButton
                      onClick={() => handleEdit(wallet)}
                      aria-label={tWallet("editWalletTitle")}
                      data-testid="wallet-edit-btn"
                    >
                      <Icon
                        name="pencil"
                        size={isMobile ? 14 : 16}
                        color={theme.palette.text.primary}
                      />
                    </WalletEditButton>

                    <WalletEditButton
                      onClick={() => handleDelete(wallet)}
                      aria-label={tWallet("deleteWallet", { defaultValue: "Delete wallet" })}
                      data-testid="wallet-delete-btn"
                      sx={{
                        "&:hover": {
                          backgroundColor: "#FEE2E2",
                          borderColor: "#FECACA",
                        },
                      }}
                    >
                      <Icon
                        name="trash-2"
                        size={isMobile ? 15 : 18}
                        color="#DC2626"
                      />
                    </WalletEditButton>
                  </WalletCardBodyRow>
                </Box>
              </WalletCardBody>
            </PanelCard>
          </Grid>
          );
        })}
      </Grid>

      {/* <Dialog
        open={true}
        fullWidth
        maxWidth="xs"
        PaperProps={{
          sx: { borderRadius: "12px" }
        }}
      >
        <DialogContent sx={{ px: "30px", pt: "30px" }}>
          <Box sx={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <Image src={WalletIcon} alt="wallet" width={14} height={14} className="themed-icon" />
            <Typography
              sx={{
                fontFamily: "var(--font-sans)",
                fontWeight: 500,
                fontSize: "20px",
                lineHeight: "100%"
              }}
            >
              {t("noActiveWalletsTitle")}
            </Typography>
          </Box>

          <Typography
            sx={{
              fontFamily: "var(--font-sans)",
              fontWeight: 500,
              fontSize: "15px",
              lineHeight: "140%",
              mt: "12px",
              color: theme.palette.text.secondary
            }}
          >
            {t("noActiveWalletsBody")}
          </Typography>
        </DialogContent>

        <DialogActions  
          sx={{
            px: "30px",
            pb: "30px",
            display: "flex",
            gap: "20px"
          }}
        >
          <Button
            fullWidth
            sx={{
              fontFamily: "var(--font-sans)",
              fontWeight: 500,
              fontSize: "15px",
              color: theme.palette.text.secondary,
              border: `1px solid ${theme.palette.divider}`,
              py: "11px",
              borderRadius: "6px"
            }}
          >
            {t("cancel")}
          </Button>

          <Button
            fullWidth
            sx={{
              fontFamily: "var(--font-sans)",
              fontWeight: 500,
              fontSize: "15px",
              color: "primary.contrastText",
              backgroundColor: "primary.main",
              py: "11px",
              borderRadius: "6px",
              "&:hover": {
                backgroundColor: "primary.dark"
              }
            }}
          >
            {t("goToWallets")}
          </Button>
        </DialogActions>
      </Dialog> */}

      <AddWalletModal
        open={openEditModal}
        currentCryptocurrency={editWalletCrypto}
        editMode={true}
        editWalletId={editWalletId != null ? Number(editWalletId) : undefined}
        editWalletName={editWalletName}
        editWalletAddress={editWalletAddress}
        editDestinationTag={editDestinationTag}
        onClose={() => {
          setOpenEditModal(false);
          setEditWalletCrypto("");
          setEditWalletId(undefined);
          setEditWalletName("");
          setEditWalletAddress("");
          setEditDestinationTag("");
        }}
      />

      <DeleteWalletModal
        open={openDeleteModal}
        onClose={() => {
          setOpenDeleteModal(false);
          setDeleteTarget(null);
        }}
        walletId={deleteTarget?.id != null ? Number(deleteTarget.id) : null}
        walletType={deleteTarget?.type ?? ""}
        walletAddress={deleteTarget?.address ?? ""}
        companyId={selectedCompanyId ?? undefined}
        onDeleted={handleWalletDeleted}
      />

      {/* Session 74 P1-4: mobile-only bottom spacer so the last wallet's
          action row and the "Add wallet" button clear the ~80px bottom-nav
          + 68px chat-FAB gutter. Desktop is 0-height (no impact). */}
      <Box
        data-testid="wallet-mobile-spacer"
        sx={{ height: { xs: 180, md: 0 }, flexShrink: 0 }}
      />
    </Box>
  );
};

export default Wallet;
