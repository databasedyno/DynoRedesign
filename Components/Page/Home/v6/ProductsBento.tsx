import React, { memo } from "react";
import { Box } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Section, SectionHead } from "../v5/shared";
import { Stagger, StaggerItem } from "../motion/Stagger";
import { BentoCard } from "./BentoCard";
import PaymentLinkVignette from "./vignettes/PaymentLinkVignette";
import CheckoutVignette from "./vignettes/CheckoutVignette";
import StorefrontVignette from "./vignettes/StorefrontVignette";
import DonationsVignette from "./vignettes/DonationsVignette";
import InvoiceVignette from "./vignettes/InvoiceVignette";
import EmbedVignette from "./vignettes/EmbedVignette";
import ApiVignette from "./vignettes/ApiVignette";

/* Every card links to something that exists today (deep page or live demo). */
const CARDS = [
  { id: "links", span: 7, href: "/auth/register?ref=products_links", Vignette: PaymentLinkVignette },
  { id: "checkout", span: 5, href: "/pay/demo", Vignette: CheckoutVignette },
  { id: "storefront", span: 4, href: "/for/creators", Vignette: StorefrontVignette },
  { id: "donations", span: 4, href: "/pay/donation-demo", Vignette: DonationsVignette },
  { id: "invoices", span: 4, href: "/auth/register?ref=products_invoices", Vignette: InvoiceVignette },
  { id: "embeds", span: 5, href: "/documentation#buy-button", Vignette: EmbedVignette },
  { id: "api", span: 7, href: "/documentation", Vignette: ApiVignette },
] as const;

/** Products as a Stripe-style bento: seven surfaces, each shown as the product itself. */
const ProductsBento: React.FC = () => {
  const { t } = useTranslation("landing");
  return (
    <Section id="products" alt testId="products">
      <SectionHead eyebrow={t("v5.products.eyebrow")} headline={t("v5.products.headline")} body={t("v5.products.body")} />
      <Stagger step={0.06} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(12, 1fr)" }, gap: { xs: 2, md: 2.5 } }}>
        {CARDS.map((c, i) => (
          <Box key={c.id} sx={{ gridColumn: { xs: "1 / -1", md: `span ${c.span}` }, display: "grid" }}>
            <StaggerItem i={i} y={22}>
              <BentoCard
                testId={`bento-${c.id}`}
                eyebrow={t(`v5.products.${c.id}.tab`)}
                title={t(`v5.products.${c.id}.title`)}
                body={t(`v5.products.${c.id}.desc`)}
                cta={t(`v5.products.${c.id}.cta`)}
                href={c.href}
                span={12}
              >
                <c.Vignette />
              </BentoCard>
            </StaggerItem>
          </Box>
        ))}
      </Stagger>
    </Section>
  );
};

export default memo(ProductsBento);
