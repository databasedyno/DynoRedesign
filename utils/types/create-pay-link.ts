import { PaymentLink } from "./paymentLink";

export interface CreatePaymentLinkPageProps {
  paymentLinkData: PaymentLink | {};
  disabled: boolean;
  /** Optional: lets the create route keep the page/tab title in sync with the
   *  selected link kind (e.g. "Create Donation" vs "Create Payment Link"). */
  setPageName?: (name: string) => void;
  /** Create route: remounts the form so the merchant can create another link. */
  onCreateAnother?: () => void;
}

export interface SaveChangeModelProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
}

export interface ActionButtonsProps {
  isMobile: boolean;
  hasPaymentLinkData: boolean;
  disabled: boolean;
  tPaymentLink: (key: string, options?: Record<string, unknown>) => string;
  handleCreatePaymentLink: () => void;
  paymentSettingsErrors: any;
  paymentSettings: any;
  isCreating?: boolean;
  /** When false (donation links) the fixed amount field is not required */
  requireAmount?: boolean;
  /** Extra disable condition supplied by the caller (e.g. missing campaign title) */
  extraDisabled?: boolean;
  /** Selected link kind — switches the create button label (donation vs standard). */
  linkKind?: string;
  /**
   * Human-readable list of what is preventing submission. When non-empty the
   * primary button is disabled AND the reasons are shown inline so the merchant
   * is never left staring at a greyed-out button with no explanation
   * (support session df0936d9 — crowdfunding "Create" stayed disabled silently).
   */
  blockers?: string[];
}

export interface ICryptoItem {
  name: string;
  label: string;
  icon: any;
  fullOrder: number;
  shortOrder: number;
}

export interface CryptoSelectionProps {
  /** Section step badge; pass "" to hide (inside "More options"). */
  step?: string;
  isMobile: boolean;
  searchTerm: string;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  handleSearch: () => void;
  cryptoItems: ICryptoItem[];
  /** Full unsliced currency list — "Select all" must operate on this, not the visible (collapsed) slice */
  allCryptoItems: ICryptoItem[];
  filteredCryptoItems: ICryptoItem[];
  showFilteredCryptoItems: boolean;
  showAllCoins: boolean;
  setShowAllCoins: React.Dispatch<React.SetStateAction<boolean>>;
  hasPaymentLinkData: boolean;
  isLarge: boolean;
  isSmall: boolean;
  walletNotSetUp: string[];
  paymentSettings: any;
  setPaymentSettings: React.Dispatch<React.SetStateAction<any>>;
}

export interface DescriptionSectionProps {
  isMobile: boolean;
  tPaymentLink: (key: string, options?: Record<string, unknown>) => string;
  paymentSettings: any;
  paymentSettingsTouched: any;
  paymentSettingsErrors: any;
  handlePaymentSettingsChange: (field: string, value: string) => void;
  handlePaymentSettingsBlur: (field: string) => void;
}

export interface PaymentLinkHeaderProps {
  tPaymentLink: (key: string, options?: Record<string, unknown>) => string;
  paymentLinkData: PaymentLink;
  disabled: boolean;
  isMobile: boolean;
  count: number;
  truncateByWords: (text: string, maxLength: number) => string;
}

export interface DatePickerRef {
  open: (event: DatePickerOpenEvent) => void;
  close: () => void;
  isOpen: () => boolean;
}

export interface DatePickerOpenEvent {
  currentTarget: HTMLElement;
}

export interface PaymentSettingsBasicProps {
  isMobile: boolean;
  tPaymentLink: (key: string, options?: Record<string, unknown>) => string;
  paymentSettings: any;
  paymentSettingsTouched: any;
  paymentSettingsErrors: any;
  currencyOpen: boolean;
  currencies: string[];
  expireOpen: boolean;
  blockchainFees: string;
  disable: any;
  handlePaymentSettingsChange: (field: string, value: string) => void;
  handlePaymentSettingsBlur: (field: string) => void;
  handleCurrencyOpen: (e: React.MouseEvent<HTMLButtonElement>) => void;
  handleCurrencyClose: () => void;
  handleCurrencySelect: (currency: string) => void;
  handleExpireOpen: (e: React.MouseEvent<HTMLElement>) => void;
  handleExpireClose: () => void;
  handleExpireSelect: (value: string) => void;
  handleBlockchainFeesChange: (value: string) => void;
  currencyAnchorEl: React.MutableRefObject<HTMLButtonElement | null>;
  currencyTriggerRef: React.MutableRefObject<HTMLButtonElement | null>;
  expireAnchorEl: React.MutableRefObject<HTMLElement | null>;
  expireTriggerRef: React.MutableRefObject<HTMLDivElement | null>;
  /** Render only the amount block, only the details block, or both (default). */
  part?: "amount" | "details" | "both";
  amountStep?: string;
  detailsStep?: string;
}

export interface PostPaymentSettingsProps {
  hasPaymentLinkData: boolean;
  isMobile: boolean;
  tPaymentLink: (key: string, options?: Record<string, unknown>) => string;
  postPaymentSettings: any;
  handleChange: (field: string, value: string) => void;
  showHelpers?: boolean;
  showCreateButton?: boolean;
  onCreate?: () => void;
  createDisabled?: boolean;
}

export interface TabNavigationProps {
  activeTab: number;
  onChange: (tab: number) => void;
  tPaymentLink: (key: string, options?: Record<string, unknown>) => string;
  hasPaymentLinkData: boolean;
}

export interface TaxSectionProps {
  isMobile: boolean;
  tPaymentLink: (key: string, options?: Record<string, unknown>) => string;
  includeTax: boolean;
  setIncludeTax: React.Dispatch<React.SetStateAction<boolean>>;
  currentLng: string;
  taxInclusive?: boolean;
  setTaxInclusive?: React.Dispatch<React.SetStateAction<boolean>>;
}

export interface CryptoItemCardProps {
  item: ICryptoItem;
  isMobile: boolean;
  walletNotSetUp: string[];
  paymentSettings: any;
  setPaymentSettings: React.Dispatch<React.SetStateAction<any>>;
  tPaymentLink: (key: string, options?: Record<string, unknown>) => string;
  isLarge: boolean;
  isSmall: boolean;
}

export interface ExpireSelectorProps {
  tPaymentLink: (key: string, options?: Record<string, unknown>) => string;
  label?: string;
  // Preset expiry windows accepted by the backend: 'No' | '24h' | '7d' | '30d'
  // (legacy 'yes'/'no' values are normalised inside the component). Typed as
  // string since the value is a free-form preset key, not the old No/Yes flag.
  value?: string;
  onChange?: (value: string) => void;
  error?: boolean;
  helperText?: string;
  fullWidth?: boolean;
  required?: boolean;
}
