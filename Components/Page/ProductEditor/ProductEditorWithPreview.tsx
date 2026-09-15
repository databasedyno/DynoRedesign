import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, Button, Collapse } from "@mui/material";
import { Icon } from "@iconify/react";
import { useCompanyStore } from "@/contexts/CompanyDataContext";
import ProductEditor, { ProductEditorProps } from "./index";
import ProductLivePreview, { ProductDraft } from "./ProductLivePreview";

const EMPTY: ProductDraft = { title: "", subtitle: "", description: "", priceDollars: "", currency: "USD", coverUrl: "", hideQuantity: false, isActive: true, variantCount: 0 };

/** Editor + live product-page preview: sticky column on desktop, collapsible "Preview" toggle on phones. */
const ProductEditorWithPreview = (props: ProductEditorProps) => {
  const { t } = useTranslation("common");
  const [draft, setDraft] = useState<ProductDraft>(EMPTY);
  const [open, setOpen] = useState(false);
  const { companyList, selectedCompanyId } = useCompanyStore();
  const brandName = (companyList.find((c: any) => c.company_id === selectedCompanyId) as any)?.company_name || null;

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) 320px" }, gap: { xs: 2, lg: 4 }, alignItems: "start" }} data-testid="product-editor-layout">
      <Box sx={{ display: { xs: "block", lg: "none" } }}>
        <Button
          size="small"
          variant="outlined"
          onClick={() => setOpen((v) => !v)}
          startIcon={<Icon icon={open ? "mdi:eye-off-outline" : "mdi:cellphone"} width={16} />}
          data-testid="product-preview-toggle"
          sx={{ textTransform: "none", borderRadius: "999px", fontWeight: 700 }}
        >
          {open ? t("productEditor.preview.hide", { defaultValue: "Hide preview" }) : t("productEditor.preview.show", { defaultValue: "Preview" })}
        </Button>
        <Collapse in={open} unmountOnExit>
          <Box sx={{ pt: 2 }}>
            <ProductLivePreview draft={draft} brandName={brandName} />
          </Box>
        </Collapse>
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <ProductEditor {...props} onDraftChange={setDraft} />
      </Box>
      <Box sx={{ display: { xs: "none", lg: "block" } }} data-testid="product-preview-desktop">
        <ProductLivePreview draft={draft} brandName={brandName} />
      </Box>
    </Box>
  );
};

export default ProductEditorWithPreview;
