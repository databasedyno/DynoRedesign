// Coinbase-style mega-menu content model for the public marketing header.
// Every href points at a REAL public route (verified against pages/ + the
// footer link map). i18n resolves through the "landing" namespace; English
// keys live in en/landing.json and fall back to English for other languages.
import type { SvgIconComponent } from "@mui/icons-material";
import ArticleRoundedIcon from "@mui/icons-material/ArticleRounded";
import BusinessRoundedIcon from "@mui/icons-material/BusinessRounded";
import CalculateRoundedIcon from "@mui/icons-material/CalculateRounded";
import CardGiftcardRoundedIcon from "@mui/icons-material/CardGiftcardRounded";
import CodeRoundedIcon from "@mui/icons-material/CodeRounded";
import GavelRoundedIcon from "@mui/icons-material/GavelRounded";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import MenuBookRoundedIcon from "@mui/icons-material/MenuBookRounded";
import MonitorHeartRoundedIcon from "@mui/icons-material/MonitorHeartRounded";
import NewspaperRoundedIcon from "@mui/icons-material/NewspaperRounded";
import RocketLaunchRoundedIcon from "@mui/icons-material/RocketLaunchRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import ShoppingCartCheckoutRoundedIcon from "@mui/icons-material/ShoppingCartCheckoutRounded";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import SupportAgentRoundedIcon from "@mui/icons-material/SupportAgentRounded";
import WebhookRoundedIcon from "@mui/icons-material/WebhookRounded";
import VolunteerActivismRoundedIcon from "@mui/icons-material/VolunteerActivismRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import ShoppingBagRoundedIcon from "@mui/icons-material/ShoppingBagRounded";
import CloudRoundedIcon from "@mui/icons-material/CloudRounded";
import WorkOutlineRoundedIcon from "@mui/icons-material/WorkOutlineRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import StoreMallDirectoryRoundedIcon from "@mui/icons-material/StoreMallDirectoryRounded";
import SellRoundedIcon from "@mui/icons-material/SellRounded";

export interface MegaItem {
  readonly titleKey: string;
  readonly descKey: string;
  readonly href: string;
  readonly Icon: SvgIconComponent;
}

// Highlighted promo card shown inside a mega-menu (Coinbase-style featured tile).
export interface MegaFeatured {
  readonly titleKey: string;
  readonly descKey: string;
  readonly ctaKey: string;
  readonly href: string;
  readonly Icon: SvgIconComponent;
}

export interface MegaSection {
  readonly key: string;
  readonly labelKey: string;
  readonly items: readonly MegaItem[];
  readonly featured?: MegaFeatured;
  /** Plain top-level link (no panel) when set — e.g. Pricing. */
  readonly href?: string;
  /** Hidden from the desktop bar on narrow laptops ≤1220 (still in footer, mobile menu and ⌘K). */
  readonly optional?: boolean;
  /** Never in the desktop bar (Stripe parity: 5 items) — footer, mobile menu and ⌘K only. */
  readonly desktopHidden?: boolean;
}

export const MENU_SECTIONS: readonly MegaSection[] = [
  {
    key: "products",
    labelKey: "v7.nav.product",
    items: [
      {
        titleKey: "nav.mega.paymentLinks.title",
        descKey: "nav.mega.paymentLinks.desc",
        href: "/products",
        Icon: LinkRoundedIcon,
      },
      {
        titleKey: "nav.mega.checkout.title",
        descKey: "nav.mega.checkout.desc",
        href: "/pay/demo",
        Icon: ShoppingCartCheckoutRoundedIcon,
      },
      {
        titleKey: "nav.mega.creatorPages.title",
        descKey: "nav.mega.creatorPages.desc",
        href: "/for/creators",
        Icon: StorefrontRoundedIcon,
      },
      {
        titleKey: "v5.products.donations.tab",
        descKey: "v6.nav.donationsDesc",
        href: "/pay/donation-demo",
        Icon: VolunteerActivismRoundedIcon,
      },
      {
        titleKey: "v5.products.invoices.tab",
        descKey: "v6.nav.invoicesDesc",
        href: "/products",
        Icon: ReceiptLongRoundedIcon,
      },
      {
        titleKey: "nav.mega.payouts.title",
        descKey: "nav.mega.payouts.desc",
        href: "/#how-it-works",
        Icon: SendRoundedIcon,
      },
    ],
    featured: {
      titleKey: "nav.mega.featured.title",
      descKey: "nav.mega.featured.desc",
      ctaKey: "nav.mega.featured.cta",
      href: "/auth/register",
      Icon: RocketLaunchRoundedIcon,
    },
  },
  {
    key: "solutions",
    labelKey: "v6.nav.solutions",
    desktopHidden: true,
    items: [
      { titleKey: "footerNav.verticals.ecommerce", descKey: "v6.nav.vert.ecommerce", href: "/for/ecommerce", Icon: ShoppingBagRoundedIcon },
      { titleKey: "footerNav.verticals.saas", descKey: "v6.nav.vert.saas", href: "/for/saas", Icon: CloudRoundedIcon },
      { titleKey: "footerNav.verticals.freelancers", descKey: "v6.nav.vert.freelancers", href: "/for/freelancers", Icon: WorkOutlineRoundedIcon },
      { titleKey: "footerNav.verticals.digitalDownloads", descKey: "v6.nav.vert.digitalDownloads", href: "/for/digital-downloads", Icon: DownloadRoundedIcon },
      { titleKey: "footerNav.verticals.marketplaces", descKey: "v6.nav.vert.marketplaces", href: "/for/marketplaces", Icon: StoreMallDirectoryRoundedIcon },
      { titleKey: "footerNav.verticals.nonprofits", descKey: "v6.nav.vert.nonprofits", href: "/for/nonprofits", Icon: VolunteerActivismRoundedIcon },
    ],
    featured: {
      titleKey: "v6.nav.creatorsFeatured.title",
      descKey: "v6.nav.creatorsFeatured.desc",
      ctaKey: "v6.nav.creatorsFeatured.cta",
      href: "/for/creators",
      Icon: StorefrontRoundedIcon,
    },
  },
  {
    key: "developers",
    labelKey: "nav.developers",
    items: [
      {
        titleKey: "nav.mega.docs.title",
        descKey: "nav.mega.docs.desc",
        href: "/documentation",
        Icon: MenuBookRoundedIcon,
      },
      {
        titleKey: "nav.mega.api.title",
        descKey: "nav.mega.api.desc",
        href: "/documentation#authentication",
        Icon: CodeRoundedIcon,
      },
      {
        titleKey: "nav.mega.webhooks.title",
        descKey: "nav.mega.webhooks.desc",
        href: "/documentation#webhooks",
        Icon: WebhookRoundedIcon,
      },
    ],
  },
  {
    key: "resources",
    labelKey: "nav.resources",
    optional: true,
    items: [
      {
        titleKey: "nav.mega.blog.title",
        descKey: "nav.mega.blog.desc",
        href: "/blog",
        Icon: ArticleRoundedIcon,
      },
      {
        titleKey: "nav.mega.fees.title",
        descKey: "nav.mega.fees.desc",
        href: "/fees",
        Icon: CalculateRoundedIcon,
      },
      {
        titleKey: "nav.mega.status.title",
        descKey: "nav.mega.status.desc",
        href: "/system-status",
        Icon: MonitorHeartRoundedIcon,
      },
      {
        titleKey: "nav.mega.referral.title",
        descKey: "nav.mega.referral.desc",
        href: "/referral-program",
        Icon: CardGiftcardRoundedIcon,
      },
    ],
  },
  {
    key: "company",
    labelKey: "nav.company",
    desktopHidden: true,
    items: [
      {
        titleKey: "nav.mega.about.title",
        descKey: "nav.mega.about.desc",
        href: "/about",
        Icon: BusinessRoundedIcon,
      },
      {
        titleKey: "nav.mega.press.title",
        descKey: "nav.mega.press.desc",
        href: "/press",
        Icon: NewspaperRoundedIcon,
      },
      {
        titleKey: "nav.mega.support.title",
        descKey: "nav.mega.support.desc",
        href: "/help-support",
        Icon: SupportAgentRoundedIcon,
      },
      {
        titleKey: "nav.mega.terms.title",
        descKey: "nav.mega.terms.desc",
        href: "/terms-conditions",
        Icon: GavelRoundedIcon,
      },
      {
        titleKey: "nav.mega.privacy.title",
        descKey: "nav.mega.privacy.desc",
        href: "/privacy-policy",
        Icon: ShieldRoundedIcon,
      },
    ],
  },
  {
    key: "pricing",
    labelKey: "v6.nav.pricing",
    href: "/fees",
    items: [{ titleKey: "v6.nav.pricing", descKey: "nav.mega.fees.desc", href: "/fees", Icon: SellRoundedIcon }],
  },
] as const;

// Flat, searchable index for the command menu (⌘K). Combines every mega-menu
// item plus a couple of top-level destinations, tagged with their group label.
export interface SearchEntry {
  readonly titleKey: string;
  readonly groupKey: string;
  readonly href: string;
  readonly Icon: SvgIconComponent;
}

export const SEARCH_ENTRIES: readonly SearchEntry[] = MENU_SECTIONS.flatMap((section) =>
  section.items.map((item) => ({
    titleKey: item.titleKey,
    groupKey: section.labelKey,
    href: item.href,
    Icon: item.Icon,
  })),
);
