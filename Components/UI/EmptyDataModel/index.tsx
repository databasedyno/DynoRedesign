import { Box, Typography, Link as MuiLink } from "@mui/material";
import Image from "next/image";
import CustomButton from "../Buttons";
import Transactions from "@/assets/Icons/Transactions.svg";
import wallet from "@/assets/Icons/wallet.svg";
import apiKey from "@/assets/Icons/api-key.svg";
import paymentLinks from "@/assets/Icons/paymnt-link.svg";
import useIsMobile from "@/hooks/useIsMobile";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { AddRounded, HelpOutlineRounded } from "@mui/icons-material";
import { useRouter } from "next/router";
import { useTheme } from "@mui/material/styles";
import AddWalletModal from "../AddWalletModal";
import CreateApiModel from "../ApiKeysModel/CreateApiModel";
import { brandFg } from "@/constants/theme";

type PageName = "transactions" | "wallet" | "apiKey" | "payment-links";

interface EmptyDataModelProps {
    pageName: PageName;
    onAddWallet?: () => void;
    /**
     * "empty"      → the merchant genuinely has no data yet (first-run nudge)
     * "no-results" → they DO have data, but the active filters/search match none.
     *                Telling them to "create their first link" here would be wrong.
     */
    variant?: "empty" | "no-results";
    onClearFilters?: () => void;
}

const EmptyDataModel = ({
    pageName,
    onAddWallet,
    variant = "empty",
    onClearFilters,
}: EmptyDataModelProps) => {
    const isMobile = useIsMobile("md");
    const router = useRouter();
    const theme = useTheme();
    const { t } = useTranslation("common");

    const [openCreate, setOpenCreate] = useState(false);

    const pageData: Record<
        PageName,
        {
            title: string;
            description: string;
            icon: any;
            buttonLabel: string;
            buttonLink?: string;
            buttonClick?: () => void;
        }
    > = {
        transactions: {
            title: t("EmptyTransactionTitle"),
            description: t("EmptyTransactionDescription"),
            icon: Transactions,
            buttonLabel: t("createPaymentLink"),
            buttonLink: "/create-pay-link",
        },
        wallet: {
            title: t("EmptyWalletTitle"),
            description: t("EmptyWalletDescription"),
            icon: wallet,
            buttonLabel: t("addWallet"),
            buttonClick: onAddWallet || (() => setOpenCreate(true)),
        },
        apiKey: {
            title: t("EmptyApiKeyTitle"),
            description: t("EmptyApiKeyDescription"),
            icon: apiKey,
            buttonLabel: t("createNewKey"),
            buttonClick: () => setOpenCreate(true),
        },
        "payment-links": {
            title: t("EmptyPaymentLinkTitle"),
            description: t("EmptyPaymentLinkDescription"),
            icon: paymentLinks,
            buttonLabel: t("createPaymentLink"),
            buttonLink: "/create-pay-link",
        },
    };

    const data = pageData[pageName];
    const isNoResults = variant === "no-results";

    const title = isNoResults
        ? t("EmptyNoResultsTitle", { defaultValue: "Nothing matches those filters" })
        : data.title;
    const description = isNoResults
        ? t("EmptyNoResultsDescription", {
              defaultValue: "Try a different search term, status or date range.",
          })
        : data.description;
    const buttonLabel = isNoResults
        ? t("EmptyNoResultsCta", { defaultValue: "Clear filters" })
        : data.buttonLabel;

    const handleButtonClick = () => {
        if (isNoResults) {
            onClearFilters?.();
            return;
        }
        if (data.buttonLink) {
            router.push(data.buttonLink);
            return;
        }
        data.buttonClick?.();
    };

    return (
        <>
            <Box
                data-testid={
                    isNoResults ? `no-results-${pageName}` : `empty-state-${pageName}`
                }
                sx={{
                    display: "flex",
                    flex: 1,
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: "25px",
                    backgroundColor: theme.palette.background.paper,
                    borderRadius: "14px",
                }}
            >
                <Image
                    src={data.icon}
                    alt={title}
                    width={63}
                    height={49}
                />

                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        alignItems: "center",
                        gap: "7px",
                    }}
                >
                    <Typography
                        component="h2"
                        sx={{
                            fontFamily: "var(--font-sans)",
                            fontWeight: 500,
                            fontSize: isMobile ? "16px" : "20px",
                            lineHeight: "100%",
                            letterSpacing: 0,
                            color: theme.palette.text.primary,
                        }}
                    >
                        {title}
                    </Typography>

                    <Typography
                        component="p"
                        sx={{
                            fontFamily: "var(--font-sans)",
                            fontWeight: 500,
                            fontSize: isMobile ? "12px" : "15px",
                            lineHeight: "100%",
                            letterSpacing: 0,
                            color: theme.palette.text.secondary,
                        }}
                    >
                        {description}
                    </Typography>
                </Box>

                <CustomButton
                    label={buttonLabel}
                    data-testid={
                        isNoResults
                            ? "empty-state-clear-filters"
                            : `empty-state-cta-${pageName}`
                    }
                    variant="primary"
                    size="medium"
                    endIcon={
                        isNoResults ? undefined : (
                            <AddRounded sx={{ fontSize: isMobile ? 18 : 20 }} />
                        )
                    }
                    onClick={handleButtonClick}
                    sx={{
                        height: isMobile ? 34 : 40,
                        px: isMobile ? 1.5 : 2.5,
                        fontSize: isMobile ? 13 : 15,
                        color: "#FFFFFF",
                    }}
                />

                {/* UX-2026-07-08: Use-case chips on the payment-links empty state
                    so first-time merchants understand *what* a payment link is
                    good for and get a starting template.  */}
                {pageName === "payment-links" && !isNoResults && (
                    <Box
                        sx={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 1.25,
                            mt: -0.5,
                            maxWidth: 460,
                            width: "100%",
                            px: 2,
                        }}
                    >
                        <Typography
                            sx={{
                                fontFamily: "var(--font-sans)",
                                fontSize: isMobile ? "12px" : "13px",
                                color: theme.palette.text.secondary,
                                mb: 0.5,
                            }}
                        >
                            {t("EmptyPaymentLinkQuickstart", { defaultValue: "Try a template" })}
                        </Typography>
                        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", justifyContent: "center" }}>
                            {[
                                { key: "invoice", label: t("EmptyPLChipInvoice", { defaultValue: "Invoice a client" }), amount: 500 },
                                { key: "product", label: t("EmptyPLChipProduct", { defaultValue: "Sell a product" }), amount: 99 },
                                { key: "donation", label: t("EmptyPLChipDonation", { defaultValue: "Accept a donation" }), amount: 10 },
                                { key: "tips", label: t("EmptyPLChipTip", { defaultValue: "Tip jar" }), amount: 5 },
                            ].map((chip) => (
                                <Box
                                    key={chip.key}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => router.push(`/create-pay-link?template=${chip.key}&amount=${chip.amount}`)}
                                    onKeyDown={(e: React.KeyboardEvent) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                            e.preventDefault();
                                            router.push(`/create-pay-link?template=${chip.key}&amount=${chip.amount}`);
                                        }
                                    }}
                                    sx={{
                                        cursor: "pointer",
                                        border: `1px solid ${theme.palette.border.main}`,
                                        borderRadius: 999,
                                        padding: isMobile ? "6px 12px" : "8px 14px",
                                        fontFamily: "var(--font-sans)",
                                        fontSize: isMobile ? 12 : 13,
                                        color: theme.palette.text.primary,
                                        backgroundColor: theme.palette.background.paper,
                                        transition: "border-color 120ms ease, background-color 120ms ease, transform 120ms ease",
                                        userSelect: "none",
                                        "&:hover": {
                                            borderColor: theme.palette.primary.main,
                                            backgroundColor: theme.palette.action.hover,
                                        },
                                        "&:focus-visible": {
                                            outline: `2px solid ${theme.palette.primary.main}`,
                                            outlineOffset: 2,
                                        },
                                    }}
                                >
                                    {chip.label}
                                </Box>
                            ))}
                        </Box>
                    </Box>
                )}

                {/* Session 48: Transactions empty state now surfaces the 3
                    revenue streams a merchant can enable — Creator page,
                    Products, Crowdfunding — so an empty ledger becomes an
                    invitation to activate a stream instead of a dead end. */}
                {pageName === "transactions" && (
                    <Box
                        sx={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 1.25,
                            mt: -0.5,
                            maxWidth: 520,
                            width: "100%",
                            px: 2,
                        }}
                    >
                        <Typography
                            sx={{
                                fontFamily: "var(--font-sans)",
                                fontSize: isMobile ? "12px" : "13px",
                                color: theme.palette.text.secondary,
                                mb: 0.5,
                            }}
                        >
                            {t("EmptyTransactionsExplore", {
                                defaultValue: "Explore other ways to earn",
                            })}
                        </Typography>
                        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", justifyContent: "center" }}>
                            {[
                                {
                                    key: "creator",
                                    label: t("EmptyTxChipCreator", { defaultValue: "Creator page" }),
                                    href: "/creator",
                                },
                                {
                                    key: "products",
                                    label: t("EmptyTxChipProducts", { defaultValue: "Sell products" }),
                                    href: "/storefront?tab=products",
                                },
                                {
                                    key: "crowdfund",
                                    label: t("EmptyTxChipCrowdfund", { defaultValue: "Crowdfund a cause" }),
                                    href: "/create-pay-link?template=donation&amount=10",
                                },
                            ].map((chip) => (
                                <Box
                                    key={chip.key}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => router.push(chip.href)}
                                    onKeyDown={(e: React.KeyboardEvent) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                            e.preventDefault();
                                            router.push(chip.href);
                                        }
                                    }}
                                    sx={{
                                        cursor: "pointer",
                                        border: `1px solid ${theme.palette.border.main}`,
                                        borderRadius: 999,
                                        padding: isMobile ? "6px 12px" : "8px 14px",
                                        fontFamily: "var(--font-sans)",
                                        fontSize: isMobile ? 12 : 13,
                                        color: theme.palette.text.primary,
                                        backgroundColor: theme.palette.background.paper,
                                        transition:
                                            "border-color 120ms ease, background-color 120ms ease, transform 120ms ease",
                                        userSelect: "none",
                                        "&:hover": {
                                            borderColor: theme.palette.primary.main,
                                            backgroundColor: theme.palette.action.hover,
                                        },
                                        "&:focus-visible": {
                                            outline: `2px solid ${theme.palette.primary.main}`,
                                            outlineOffset: 2,
                                        },
                                    }}
                                >
                                    {chip.label}
                                </Box>
                            ))}
                        </Box>
                    </Box>
                )}

                {pageName === "wallet" && (
                    <MuiLink
                        href="https://www.dynopay.com/help-support/what-is-a-payout-wallet"
                        target="_blank"
                        rel="noopener noreferrer"
                        underline="hover"
                        sx={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 0.5,
                            mt: -1.25,
                            fontFamily: "var(--font-sans)",
                            fontSize: isMobile ? "12px" : "13px",
                            color: brandFg(theme.palette.mode === "dark"),
                        }}
                    >
                        <HelpOutlineRounded sx={{ fontSize: isMobile ? 14 : 16 }} />
                        {t("whatIsPayoutWallet")}
                    </MuiLink>
                )}
            </Box>

            {pageName === "wallet" && openCreate && (
                <AddWalletModal
                    open
                    onClose={() => setOpenCreate(false)}
                />
            )}

            {pageName === "apiKey" && (
                <CreateApiModel open={openCreate} onClose={() => setOpenCreate(false)} />
            )}
        </>
    );
};

export default EmptyDataModel;