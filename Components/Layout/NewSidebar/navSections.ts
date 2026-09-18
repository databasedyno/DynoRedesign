import type { TFunction } from "i18next";
import type { NavRevealFlags } from "@/hooks/useNavReveal";

export interface SidebarItem {
  label: string;
  icon: string;
  path: string;
  isNew?: boolean;
  permission?: string;
}

export type SectionKey = "dashboard" | "sell" | "money" | "grow" | "settings";

export interface SidebarSection {
  /** Stable key — used for the persisted collapsed-state and test ids. */
  key: SectionKey;
  /** Empty label = pinned rows with no header (Dashboard). */
  label: string;
  items: SidebarItem[];
}

interface BuildInput {
  t: TFunction;
  isIndividual: boolean;
  hasClaimedCreator: boolean;
  reveal: NavRevealFlags;
  /** Number of brands the account can access — the "Brands" overview row only
   *  appears for multi-brand accounts (2+). */
  brandCount: number;
}

/**
 * Sell / Money / Grow / Settings — the four jobs a merchant comes here to do.
 * Dashboard stays pinned above the groups. Reveal-on-relevance rows
 * (receipts, customers, developers) only appear once they mean something.
 * Creators lead Sell with their page; businesses lead with payment links.
 */
export const buildNavSections = ({ t, isIndividual, hasClaimedCreator, reveal, brandCount }: BuildInput): SidebarSection[] => {
  const dashboard: SidebarItem = { label: t("dashboard"), icon: "dashboard", path: "/dashboard", permission: "view_dashboard" };
  const brands: SidebarItem = { label: t("brands", { defaultValue: "Brands" }), icon: "brands", path: "/brands" };
  const payLinks: SidebarItem = { label: t("payLinks"), icon: "payment-links", path: "/pay-links", permission: "manage_payment_links" };
  const escrow: SidebarItem = { label: t("escrow", { defaultValue: "Escrow" }), icon: "escrow", path: "/escrow", permission: "manage_payment_links", isNew: true };
  const publicPage: SidebarItem = {
    label: t("storefront", { defaultValue: "Your page" }),
    icon: "creator",
    path: "/storefront",
    isNew: !hasClaimedCreator,
    permission: "manage_products",
  };
  const balances: SidebarItem = { label: t("balancesPayouts", { defaultValue: "Balances" }), icon: "balances", path: "/payouts", permission: "view_wallets" };
  const transactions: SidebarItem = { label: t("transactions"), icon: "transactions", path: "/transactions", permission: "view_transactions" };
  const receipts: SidebarItem = { label: t("receiptsTax", { defaultValue: "Receipts & Tax" }), icon: "invoices", path: "/invoices", permission: "manage_invoices" };
  const wallets: SidebarItem = { label: t("payoutWallets", { defaultValue: "Payout addresses" }), icon: "wallets", path: "/wallet", permission: "view_wallets" };
  const customers: SidebarItem = { label: t("customers"), icon: "customers", path: "/customers", permission: "manage_customers" };
  const referrals: SidebarItem = { label: t("common:referAndEarn", { defaultValue: "Refer & earn" }), icon: "referrals", path: "/referrals" };
  const settings: SidebarItem = { label: t("settings"), icon: "settings", path: "/settings", permission: "manage_company_settings" };
  const developers: SidebarItem = { label: t("developers", { defaultValue: "Developers" }), icon: "api", path: "/developer-keys", permission: "manage_api_keys" };
  const help: SidebarItem = { label: t("common:helpSupport", { defaultValue: "Help & Support" }), icon: "help", path: "/help-support" };

  return [
    { key: "dashboard", label: "", items: brandCount >= 2 ? [dashboard, brands] : [dashboard] },
    {
      key: "sell",
      label: t("sidebarSectionSell", { defaultValue: "Sell" }),
      items: isIndividual ? [publicPage, payLinks, escrow] : [payLinks, escrow, publicPage],
    },
    {
      key: "money",
      label: t("sidebarSectionMoney", { defaultValue: "Money" }),
      items: [balances, transactions, ...(reveal.receipts ? [receipts] : []), wallets],
    },
    {
      key: "grow",
      label: t("sidebarSectionGrow", { defaultValue: "Grow" }),
      items: [...(reveal.customers ? [customers] : []), referrals],
    },
    {
      key: "settings",
      label: t("settings"),
      items: [settings, ...(reveal.developers ? [developers] : []), help],
    },
  ];
};
