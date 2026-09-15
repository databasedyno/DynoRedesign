/**
 * Edit an existing product (merchant).
 * Route: /pay-links/products/[productId]/edit
 */
import React, { useEffect } from "react";
import { useRouter } from "next/router";
import { Box, IconButton } from "@mui/material";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import ProductEditorWithPreview from "@/Components/Page/ProductEditor/ProductEditorWithPreview";
import { pageProps } from "@/utils/types";

const EditProductPage = ({ setPageName, setPageDescription, setPageAction }: pageProps) => {
  const router = useRouter();
  const productId = Number(router.query.productId);

  useEffect(() => {
    if (!setPageName || !setPageDescription) return;
    setPageName("Edit product");
    setPageDescription("Update details or publish to your shop.");
    return () => { setPageName(""); setPageDescription(""); };
  }, [setPageName, setPageDescription]);

  useEffect(() => {
    if (!setPageAction) return;
    setPageAction(
      <IconButton onClick={() => router.push("/storefront?tab=products")} data-testid="products-edit-back" aria-label="Back to products">
        <ArrowBackRounded />
      </IconButton>
    );
    return () => setPageAction(null);
  }, [setPageAction, router]);

  if (!Number.isFinite(productId)) return null;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", flex: 1, gap: 2 }}>
      <ProductEditorWithPreview mode="edit" productId={productId} />
    </Box>
  );
};

export default EditProductPage;
