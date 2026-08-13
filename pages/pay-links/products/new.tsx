/**
 * Create a new product (merchant).
 * Route: /pay-links/products/new
 */
import React, { useEffect } from "react";
import { useRouter } from "next/router";
import { Box, IconButton } from "@mui/material";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import ProductEditor from "@/Components/Page/ProductEditor";
import OnboardingBanner from "@/Components/UI/OnboardingBanner";
import { pageProps } from "@/utils/types";

const NewProductPage = ({ setPageName, setPageDescription, setPageAction }: pageProps) => {
  const router = useRouter();

  useEffect(() => {
    if (!setPageName || !setPageDescription) return;
    setPageName("New product");
    setPageDescription("Digital-only — buyers pay in crypto, delivery is automatic.");
    return () => { setPageName(""); setPageDescription(""); };
  }, [setPageName, setPageDescription]);

  useEffect(() => {
    if (!setPageAction) return;
    setPageAction(
      <IconButton onClick={() => router.push("/storefront?tab=products")} data-testid="products-new-back">
        <ArrowBackRounded />
      </IconButton>
    );
    return () => setPageAction(null);
  }, [setPageAction, router]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", flex: 1, gap: 2 }}>
      <OnboardingBanner vertical="merchants" />
      <ProductEditor mode="new" />
    </Box>
  );
};

export default NewProductPage;
