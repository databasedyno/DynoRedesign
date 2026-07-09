import FalseIcon from "@/assets/Icons/False.svg";
import InfoIcon from "@/assets/Icons/info-icon.svg";
import TransactionIcon from "@/assets/Icons/transaction-icon.svg";
import TrueIcon from "@/assets/Icons/True.svg";
import { theme } from "@/styles/theme";
import { HourGlassIcon } from "@/utils/customIcons";
import { PaymentLinkHeaderProps } from "@/utils/types/create-pay-link";
import { Box } from "@mui/material";
import Image from "next/image";
import React from "react";
import { Text } from "../../Page/CreatePaymentLink/styled";
import { StatusChip } from "../../Page/Payment-link/styled";

const DisabledNotice: React.FC<{
  isMobile: boolean;
  tPaymentLink: (key: string) => string;
}> = ({ isMobile, tPaymentLink }) => (
  <Box
    sx={{
      border: `1px solid ${theme.palette.border.main}`,
      borderRadius: "7px",
      display: "flex",
      alignItems: "center",
      gap: isMobile ? "8px" : "12px",
      padding: "12px 14px 12px 18px",
      backgroundColor: theme.palette.primary.light,
    }}
  >
    <Image
      src={InfoIcon}
      alt="info icon"
      width={16}
      height={16}
      draggable={false}
      className="themed-icon"
    />
    <Text
      sx={{
        fontSize: isMobile ? "10px" : "13px",
        fontWeight: 600,
        fontFamily: "var(--font-sans)",
        color: theme.palette.text.primary,
        whiteSpace: "wrap",
      }}
    >
      {tPaymentLink("paidWarning")}
    </Text>
  </Box>
);

const PaymentLinkHeader: React.FC<PaymentLinkHeaderProps> = React.memo(
  ({
    tPaymentLink,
    paymentLinkData,
    disabled,
    isMobile,
    count,
    truncateByWords,
  }) => (
    <>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Image
            src={TransactionIcon}
            alt="Transaction Icon"
            height={isMobile ? 14 : 13}
            width={isMobile ? 18 : 17}
            className="themed-icon"
            draggable={false}
          />

          <Box sx={{ display: "flex", gap: "4px", alignItems: "center" }}>
            <Text
              sx={{
                fontSize: isMobile ? "15px" : "20px",
                fontWeight: 700,
                fontFamily: "var(--font-sans)",
              }}
            >
              {tPaymentLink("linkId")}:
            </Text>
            <Text
              sx={{
                fontSize: isMobile ? "15px" : "20px",
                fontFamily: "var(--font-sans)",
              }}
            >
              #{truncateByWords(paymentLinkData.link_id, count)}
            </Text>
          </Box>
        </Box>
        <StatusChip status={paymentLinkData.status}>
          {paymentLinkData.status === "active" ? (
            <Image
              src={TrueIcon}
              alt="True Icon"
              width={isMobile ? 12 : 14}
              height={isMobile ? 12 : 14}
              draggable={false}
            />
          ) : paymentLinkData.status === "expired" ? (
            <Image
              src={FalseIcon}
              alt="False Icon"
              width={isMobile ? 12 : 14}
              height={isMobile ? 12 : 14}
              draggable={false}
            />
          ) : paymentLinkData.status === "paid" ? (
            <Image
              src={TrueIcon}
              alt="True Icon"
              width={isMobile ? 12 : 14}
              height={isMobile ? 12 : 14}
              draggable={false}
              style={{
                filter:
                  "brightness(0) saturate(100%) invert(29%) sepia(88%) saturate(2646%) hue-rotate(189deg) brightness(95%) contrast(101%)",
              }}
            />
          ) : (
            <HourGlassIcon fill="#F57C00" size={isMobile ? 12 : 14} />
          )}
          {paymentLinkData.status === "active"
            ? "Active"
            : paymentLinkData.status === "expired"
              ? "Expired"
              : paymentLinkData.status === "paid"
                ? "Paid"
                : "Pending"}
        </StatusChip>
      </Box>
      {disabled && (
        <DisabledNotice isMobile={isMobile} tPaymentLink={tPaymentLink} />
      )}
      <Box
        sx={{
          height: "1px",
          backgroundColor: theme.palette.border.main,
        }}
      />
    </>
  ),
);
PaymentLinkHeader.displayName = "PaymentLinkHeader";

export default PaymentLinkHeader;
