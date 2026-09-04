import { HelpArticle } from "@/pages/help-support/index";
import { Box, Typography, useTheme } from "@mui/material";
import BackArrow from "@/assets/Icons/BackArrow.svg";
import Image from "next/image";
import Dashboard_svg from "@/assets/Images/home/Dashboard.png";
import { SearchIconButton, TextDecoration } from "../styled";
import { theme as staticTheme } from "@/styles/theme";
import { useRouter } from "next/router";
import ArrowOutwardIcon from "@mui/icons-material/ArrowOutward";
import useIsMobile from "@/hooks/useIsMobile";
import { useTranslation } from "react-i18next";

const GettingStartedWithDynopay = ({ data }: { data: HelpArticle }) => {
  const theme = useTheme();

    const router = useRouter();
    const isMobile = useIsMobile("md");
    const { t } = useTranslation("helpAndSupport");

    const helpData = [
        {
            title: t("gettingStarted.step1.title", { defaultValue: "Step 1. Create Your Dynopay Account" }),
            description: t("gettingStarted.step1.desc", { defaultValue: "Sign up using your business email and complete the initial account setup. Once registered, you’ll get access to the Dynopay dashboard where all payments, wallets, and settings are managed." })
        },
        {
            title: t("gettingStarted.step2.title", { defaultValue: "Step 2. Complete Basic Business Setup" }),
            description: t("gettingStarted.step2.desc", { defaultValue: "Add your business details, such as company name and operating country. Depending on your use case and volume, Dynopay may request additional verification later, but you can start testing payments right away." })
        },
        {
            title: t("gettingStarted.step3.title", { defaultValue: "Step 3. Choose Supported Cryptocurrencies" }),
            description: t("gettingStarted.step3.desc", { defaultValue: "Select which cryptocurrencies and networks you want to accept. Dynopay supports multiple assets and chains, allowing you to choose options that best fit your customers and transaction fees." })
        },
        {
            title: t("gettingStarted.step4.title", { defaultValue: "Step 4. Set Up Your First Payment" }),
            bulletPoints: {
                heading: t("gettingStarted.step4.heading", { defaultValue: "You can accept payments in several ways:" }),
                points: [
                    t("gettingStarted.step4.point1", { defaultValue: "Create a payment link" }),
                    t("gettingStarted.step4.point2", { defaultValue: "Generate an invoice" }),
                    t("gettingStarted.step4.point3", { defaultValue: "Use a hosted checkout page" }),
                    t("gettingStarted.step4.point4", { defaultValue: "Integrate Dynopay via API" }),
                ]
            },
            footer: t("gettingStarted.step4.footer", { defaultValue: "For most businesses, payment links or invoices are the fastest way to get started." })
        },
        {
            title: t("gettingStarted.step5.title", { defaultValue: "Step 5. Receive and Track Payments" }),
            description: t("gettingStarted.step5.desc", { defaultValue: "Once a customer completes a payment, the transaction appears in your dashboard with real-time status updates. You can track confirmations, amounts, and network details in one place." }),
        },
        {
            title: t("gettingStarted.step6.title", { defaultValue: "Step 6. Configure Payouts" }),
            bulletPoints: {
                heading: t("gettingStarted.step6.heading", { defaultValue: "Decide where your funds should go:" }),
                points: [
                    t("gettingStarted.step6.point1", { defaultValue: "Keep funds in your connected crypto wallet" }),
                    t("gettingStarted.step6.point2", { defaultValue: "Set up automatic or manual payouts" }),
                ]
            },
            footer: t("gettingStarted.step6.footer", { defaultValue: "Payout availability depends on the selected currency and network." })
        },
        {
            title: t("gettingStarted.step7.title", { defaultValue: "Step 7. Test Before Going Live" }),
            description: t("gettingStarted.step7.desc", { defaultValue: "We recommend running a small test transaction to make sure everything works as expected before sharing payment links with customers." }),
        },
        {
            title: t("gettingStarted.next.title", { defaultValue: "What’s Next" }),
            description: t("gettingStarted.next.desc", { defaultValue: "After your first payment is completed, you can:" }),
            bulletPoints: {
                points: [
                    t("gettingStarted.next.point1", { defaultValue: "Customize checkout experience" }),
                    t("gettingStarted.next.point2", { defaultValue: "Add team members" }),
                    t("gettingStarted.next.point3", { defaultValue: "Enable API integrations" }),
                    t("gettingStarted.next.point4", { defaultValue: "Review fees and settlement options" }),
                ]
            },
            footer: t("gettingStarted.next.footer", { defaultValue: "If you need help at any step, Dynopay support is always available through the dashboard." })
        }
    ]

    const articleData = [
        {
            title: t("gettingStarted.related.supported.title", { defaultValue: "Supported Cryptocurrencies & Networks" }),
            description: t("gettingStarted.related.supported.desc", { defaultValue: "See which cryptocurrencies and blockchain networks Dynopay supports and how to choose the right one." }),
            slug: "supported-cryptocurrencies-and-networks"
        },
        {
            title: t("gettingStarted.related.howItWorks.title", { defaultValue: "How Crypto Payments Work for Merchants" }),
            description: t("gettingStarted.related.howItWorks.desc", { defaultValue: "A clear explanation of what happens from the moment a customer pays to when funds are settled." }),
            slug: "how-crypto-payments-work-for-merchants"
        },
        {
            title: t("gettingStarted.related.fees.title", { defaultValue: "Fees, Rates & Conversion Logic" }),
            description: t("gettingStarted.related.fees.desc", { defaultValue: "Understand transaction fees, exchange rates, and how payout amounts are calculated." }),
            slug: "fees-rates-and-conversion-logic"
        }
    ]

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: { xs: "column", xl: "row" },
                gap: 4,
                flex: 1,
                height: "100%",
                minHeight: 0,
                overflowY: "auto",
            }}
        >
            <Box
                sx={{
                    width: "100%",
                    maxWidth: { xs: "100%", md: "728px" },
                    height: "fit-content",
                    overflow: "visible",
                    p: "20px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "20px",
                    border: `1px solid ${theme.palette.border.main}`,
                    backgroundColor: theme.palette.background.paper,
                    borderRadius: "14px",
                    flexShrink: 0,
                }}
            >
                <Image src={BackArrow} alt="Back Arrow" style={{ width: "16px", height: "16px", color: theme.palette.text.primary, cursor: "pointer" }} onClick={() => router.push("/help-support")} />
                <TextDecoration style={{ fontSize: isMobile ? "16px" : "24px", color: theme.palette.text.primary }}>
                    {t("gettingStarted.pageTitle", { defaultValue: "Getting Started with Dynopay" })}
                </TextDecoration>
                <Box sx={{ width: "100%", height: { xs: "200px", sm: "303px" }, position: "relative", flexShrink: 0 }}>
                    <Image
                        src={Dashboard_svg}
                        alt="Dashboard"
                        fill
                        style={{ objectFit: "contain" }}
                    />
                </Box>
                <Box sx={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                    <TextDecoration style={{ fontSize: isMobile ? "13px" : "16px", color: theme.palette.text.primary }}>
                        {t("gettingStarted.intro", { defaultValue: "Dynopay helps businesses accept crypto payments without dealing with complex blockchain mechanics. This guide walks you through the basic steps to get up and running." })}
                    </TextDecoration>
                    {helpData.map((item) => (
                        <Box key={item.title} sx={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                            <TextDecoration style={{ fontSize: isMobile ? "15px" : "20px", fontWeight: 600, fontFamily: "var(--font-sans)", color: theme.palette.text.primary }}>{item.title}</TextDecoration>
                            {item.description && (
                                <TextDecoration style={{ fontSize: isMobile ? "13px" : "15px", color: theme.palette.text.primary }}>{item.description}</TextDecoration>
                            )}

                            <Box>
                                {item.bulletPoints && (
                                    <>
                                        {item.bulletPoints.heading && (
                                            <TextDecoration style={{ fontSize: isMobile ? "13px" : "15px", color: theme.palette.text.primary }}>{item.bulletPoints.heading}</TextDecoration>
                                        )}

                                        <ul style={{ paddingLeft: "25px", }}>
                                            {item.bulletPoints.points.map((point, index) => (
                                                <li key={index} style={{ fontSize: isMobile ? "13px" : "15px", fontWeight: 500, lineHeight: "100%", letterSpacing: 0, fontFamily: "var(--font-sans)", color: theme.palette.text.primary }}>{point}</li>
                                            ))}
                                        </ul>
                                    </>
                                )}
                            </Box>
                            {item.footer && (
                                <TextDecoration style={{ fontSize: isMobile ? "13px" : "15px", color: theme.palette.text.primary }}>{item.footer}</TextDecoration>
                            )}
                        </Box>
                    ))}
                </Box>
            </Box>

            <Box
                sx={{
                    width: "100%",
                    display: "flex",
                    flexDirection: "column",
                    gap: "20px",
                }}
            >
                <TextDecoration style={{ fontSize: isMobile ? "16px" : "24px", color: theme.palette.text.primary }}>
                    {t("gettingStarted.relatedArticles", { defaultValue: "Related articles" })}
                </TextDecoration>

                <Box
                    sx={{
                        display: "grid",
                        width: "100%",
                        gridTemplateColumns: "repeat(auto-fill, 355px)",
                        justifyContent: "start",
                        columnGap: "20px",
                        rowGap: "20px",
                    }}
                >
                    {articleData.map((item) => (
                        <Box
                            key={item.title}
                            sx={{
                                width: "355px",
                                border: `1px solid ${theme.palette.border.main}`,
                                backgroundColor: theme.palette.background.paper,
                                borderRadius: "14px",
                                padding: "20px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "10px",
                            }}
                        >
                            <TextDecoration style={{ fontSize: isMobile ? "15px" : "20px", color: theme.palette.text.primary }}>
                                {item.title}
                            </TextDecoration>

                            <TextDecoration style={{ fontSize: isMobile ? "13px" : "15px", color: theme.palette.text.secondary }}>
                                {item.description}
                            </TextDecoration>

                            <SearchIconButton
                                style={{
                                    marginLeft: "auto",
                                    borderColor: theme.palette.text.secondary,
                                }}
                                onClick={() => router.push(`/help-support/${item.slug}`)}
                            >
                                <ArrowOutwardIcon sx={{ color: theme.palette.text.secondary, fontSize: 18.5 }} />
                            </SearchIconButton>
                        </Box>
                    ))}
                </Box>
            </Box>
        </Box>
    );
};

export default GettingStartedWithDynopay;