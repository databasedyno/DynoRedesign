import InputField from "@/Components/UI/AuthLayout/InputFields";
import PopupModal from "@/Components/UI/PopupModal";
import useIsMobile from "@/hooks/useIsMobile";
import { theme } from "@/styles/theme";
import { Box, Typography } from "@mui/material";
import Image from "next/image";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { QRCodeSVG } from "qrcode.react";
import {
  CloseIconButton,
  LabelText,
  PaymentDetailsContainer,
  PaymentDetailsTitle,
  Row,
  ValueText,
} from "./styled";

import CloseIcon from "@/assets/Icons/close-icon.svg";
import CopyIcon from "@/assets/Icons/copy-icon.svg";
import HourglassIcon from "@/assets/Icons/hourglass-icon.svg";
import NoteIcon from "@/assets/Icons/note-icon.svg";
import PaymentIcon from "@/assets/Icons/payment-icon.svg";
import RoundedStackIcon from "@/assets/Icons/roundedStck-icon.svg";
import ShareIcon from "@/assets/Icons/ShareIcon.svg";
import TransactionIcon from "@/assets/Icons/transaction-icon.svg";
import PanelCard from "@/Components/UI/PanelCard";
import Toast from "@/Components/UI/Toast";
import { copyToClipboard } from "@/helpers/copyToClipboard";
import {
  PaymentDetailRowProps,
  PaymentLinkSuccessModalProps,
} from "@/utils/types/paymentLink";
import { ApiKeyCopyButton } from "../API/styled";

const PaymentDetailRow: React.FC<PaymentDetailRowProps> = ({
  icon,
  alt,
  label,
  value,
}) => {
  const isMobile = useIsMobile("md");

  return (
    <Row>
      <Image
        src={icon}
        alt={alt}
        width={isMobile ? 12 : 16}
        height={isMobile ? 12 : 16}
        draggable={false}
        style={{
          filter:
            "brightness(0) saturate(100%) invert(40%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(100%) contrast(100%)",
        }}
      />

      <LabelText>{label}:</LabelText>

      <ValueText>{value}</ValueText>
    </Row>
  );
};

const PaymentLinkSuccessModal: React.FC<PaymentLinkSuccessModalProps> = ({
  open,
  onClose,
  paymentLink,
  paymentSettings,
  walletList,
  directPayAddress,
  directPayQrCode,
}) => {
  const isMobile = useIsMobile("md");
  const { t } = useTranslation("createPaymentLinkScreen");
  const tPaymentLink = useCallback(
    (key: string): string => {
      const result = t(key, { ns: "createPaymentLinkScreen" });
      return typeof result === "string" ? result : String(result);
    },
    [t],
  );
  const tCommon = useCallback((key: string) => t(key, { ns: "common" }), [t]);
  const [openToast, setOpenToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastSeverity, setToastSeverity] = useState<"success" | "error">("success");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Determine if single crypto is selected and find its wallet address
  // Only use the pool address from backend (directPayAddress) — no fallback to merchant wallet
  const singleCryptoWallet = useMemo(() => {
    const accepted = paymentSettings.acceptedCryptoCurrency;
    if (!accepted || accepted.length !== 1) {
      return null;
    }
    const selectedCrypto = accepted[0];
    
    // Only show the pool address from backend (prevents flashing merchant wallet)
    if (directPayAddress) {
      return {
        cryptoType: selectedCrypto,
        address: directPayAddress,
      };
    }
    
    // No pool address yet — don't show anything (modal waits for API response)
    return null;
  }, [paymentSettings.acceptedCryptoCurrency, directPayAddress]);

  const getExpireText = () => {
    if (paymentSettings.expire === "no") return tPaymentLink("noExpiration");
    return tPaymentLink(paymentSettings.expire);
  };

  const getBlockchainFeesText = () => {
    return paymentSettings.blockchainFees === "customer"
      ? tPaymentLink("paidByCustomer")
      : tPaymentLink("paidByClient");
  };

  const showToast = (message: string, severity: "success" | "error" = "success") => {
    setOpenToast(false);
    setToastMessage(message);
    setToastSeverity(severity);
    setTimeout(() => setOpenToast(true), 0);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setOpenToast(false), 2000);
  };

  const handleCopyPaymentLink = async () => {
    if (!paymentLink) {
      showToast(String(tCommon("copyFailed")), "error");
      return;
    }
    const ok = await copyToClipboard(paymentLink);
    showToast(
      ok ? String(tCommon("copiedToClipboard")) : String(tCommon("copyFailed")),
      ok ? "success" : "error",
    );
  };

  const handleSharePaymentLink = async () => {
    if (!paymentLink) {
      showToast(String(tCommon("copyFailed")), "error");
      return;
    }
    // Prefer the native share sheet on mobile; fall back to copying the link.
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({
          title: tPaymentLink("paymentLink"),
          url: paymentLink,
        });
        return;
      }
    } catch {
      // user cancelled or share failed — fall through to copy
      return;
    }
    await handleCopyPaymentLink();
  };

  const handleCopyWalletAddress = async () => {
    if (!singleCryptoWallet?.address) {
      showToast(String(tCommon("copyFailed")), "error");
      return;
    }
    const ok = await copyToClipboard(singleCryptoWallet.address);
    showToast(
      ok ? String(tCommon("copiedToClipboard")) : String(tCommon("copyFailed")),
      ok ? "success" : "error",
    );
  };

  return (
    <>
      <PopupModal
        open={open}
        handleClose={onClose}
        showHeader={false}
        transparent
        hasFooter={false}
        sx={{
          "& .MuiDialog-paper": {
            width: "100%",
            maxWidth: singleCryptoWallet ? "520px" : "481px",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            p: 2,
          },
        }}
      >
        <PanelCard
          title={tPaymentLink("paymentLinkSuccessfullyCreated")}
          subTitle={tPaymentLink("shareLinkToReceivePayment")}
          showHeaderBorder={false}
          bodyPadding={
            isMobile
              ? theme.spacing(1.5, 2, 2, 2)
              : theme.spacing(2, 3.75, 3.75, 3.75)
          }
          headerPadding={
            isMobile
              ? theme.spacing(2, 2, 0, 2)
              : theme.spacing(3.75, 3.75, 0, 3.75)
          }
          headerActionLayout="inline"
          headerAction={
            <CloseIconButton onClick={onClose}>
              <Image
                src={CloseIcon.src}
                alt="close icon"
                width={16}
                height={16}
                draggable={false}
              />
            </CloseIconButton>
          }
        >
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <Box sx={{ display: "flex", gap: 1, alignItems: "flex-end" }}>
              <InputField
                value={paymentLink}
                readOnly
                label={tPaymentLink("paymentLink")}
                inputHeight={isMobile ? "32px" : "40px"}
              />
              <ApiKeyCopyButton
                onClick={handleSharePaymentLink}
                sx={{ display: { xs: "flex", lg: "none" } }}
              >
                <Image
                  src={ShareIcon.src}
                  alt="share"
                  width={14}
                  height={14}
                  draggable={false}
                />
              </ApiKeyCopyButton>
              <ApiKeyCopyButton onClick={handleCopyPaymentLink}>
                <Image
                  src={CopyIcon.src}
                  alt="copy"
                  width={14}
                  height={14}
                  draggable={false}
                />
              </ApiKeyCopyButton>
            </Box>

            {/* Direct Pay QR Code — shown only when a single cryptocurrency is selected */}
            {singleCryptoWallet && (
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 1.5,
                  p: isMobile ? 2 : 2.5,
                  borderRadius: "12px",
                  border: "1px solid",
                  borderColor: "divider",
                  backgroundColor: "background.paper",
                }}
              >
                <Typography
                  sx={{
                    fontSize: isMobile ? "13px" : "14px",
                    fontWeight: 600,
                    fontFamily: "OutfitMedium",
                    color: "text.primary",
                    textAlign: "center",
                  }}
                >
                  Direct Pay — {singleCryptoWallet.cryptoType}
                </Typography>

                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: "10px",
                    backgroundColor: theme.palette.background.paper,
                    display: "inline-flex",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                  }}
                >
                {directPayQrCode ? (
                  <img
                    src={directPayQrCode}
                    alt="Direct Pay QR Code"
                    style={{
                      width: isMobile ? 140 : 170,
                      height: isMobile ? 140 : 170,
                    }}
                  />
                ) : (
                  <QRCodeSVG
                    value={singleCryptoWallet.address}
                    size={isMobile ? 140 : 170}
                    level="M"
                    includeMargin={false}
                  />
                )}
                </Box>

                <Typography
                  sx={{
                    fontSize: "11px",
                    color: "text.secondary",
                    textAlign: "center",
                    lineHeight: 1.4,
                  }}
                >
                  {t("common:scanQrPayWallet")}
                </Typography>

                <Box
                  sx={{
                    display: "flex",
                    gap: 1,
                    alignItems: "center",
                    width: "100%",
                    maxWidth: "100%",
                  }}
                >
                  <Box
                    sx={{
                      flex: 1,
                      overflow: "hidden",
                      borderRadius: "8px",
                      border: "1px solid",
                      borderColor: "divider",
                      px: 1.5,
                      py: 1,
                      backgroundColor: "action.hover",
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: isMobile ? "10px" : "12px",
                        fontFamily: "monospace",
                        color: "text.primary",
                        wordBreak: "break-all",
                        lineHeight: 1.4,
                      }}
                    >
                      {singleCryptoWallet.address}
                    </Typography>
                  </Box>
                  <ApiKeyCopyButton
                    onClick={handleCopyWalletAddress}
                    sx={{ flexShrink: 0 }}
                  >
                    <Image
                      src={CopyIcon.src}
                      alt="copy address"
                      width={14}
                      height={14}
                      draggable={false}
                    />
                  </ApiKeyCopyButton>
                </Box>
              </Box>
            )}

            <PaymentDetailsContainer>
              <PaymentDetailsTitle>
                {tPaymentLink("paymentDetails")}
              </PaymentDetailsTitle>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <PaymentDetailRow
                  icon={RoundedStackIcon.src}
                  alt="value"
                  label={tPaymentLink("value").replace(" ($)", "")}
                  value={`$${paymentSettings.value || "0.00"}`}
                />

                <PaymentDetailRow
                  icon={HourglassIcon.src}
                  alt="expire"
                  label={tPaymentLink("expiresOn")}
                  value={getExpireText()}
                />

                <PaymentDetailRow
                  icon={PaymentIcon.src}
                  alt="blockchain fees"
                  label={tPaymentLink("blockchainFees")}
                  value={getBlockchainFeesText()}
                />

                {paymentSettings.description && (
                  <PaymentDetailRow
                    icon={NoteIcon.src}
                    alt="description"
                    label={tPaymentLink("description")}
                    value={paymentSettings.description}
                  />
                )}

                <PaymentDetailRow
                  icon={TransactionIcon.src}
                  alt="Link Id"
                  label={tPaymentLink("linkId")}
                  value={paymentSettings.linkId || tPaymentLink("nA")}
                />
              </Box>
            </PaymentDetailsContainer>
          </Box>
        </PanelCard>
      </PopupModal>
      <Toast
        open={openToast}
        message={toastMessage}
        severity={toastSeverity}
      />
    </>
  );
};

export default PaymentLinkSuccessModal;
