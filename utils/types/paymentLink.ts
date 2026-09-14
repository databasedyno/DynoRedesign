export interface PaymentLinkDonation {
  title: string | null;
  goal_amount: number | null;
  raised_amount: number;
  supporters_count: number;
  progress_percent: number | null;
  min_amount: number;
  preset_amounts: number[];
  allow_custom_amount: boolean;
  show_progress: boolean;
  show_supporters: boolean;
  auto_close_at_goal: boolean;
  campaign_image: string | null;
  contributions?: Array<{
    link_id: number | string;
    amount: number;
    currency: string;
    donor_name: string | null;
    donor_message: string | null;
    is_anonymous: boolean;
    status: string;
    created_at: string;
  }>;
}

export interface PaymentLink {
  link_id: string;
  amount: number;
  currency: string;
  description: string;
  status: PaymentLinkStatus;
  clientName: string;
  expire: string;
  blockchainFees: string;
  acceptedCryptoCurrency: string[];
  payment_url: string;
  redirect_url: string;
  webhook_url: string;
  link_type?: "standard" | "donation";
  donation?: PaymentLinkDonation | null;
  metadata: {
    order_id: string;
    customer_email: string;
  };
  created_at: string;
  paid_at: string;
  transaction: {
    transaction_id: string;
    crypto_currency: string;
    crypto_amount: number;
    confirmations: number;
    tx_hash: string;
  };
}

export interface PaymentLinksProps {
  setPageName?: (v: string) => void;
  setPageDescription?: (v: string) => void;
  setPageAction?: (v: React.ReactNode | null) => void;
}

export type PaymentLinkStatus = "active" | "expired" | "paid" | "pending" | "completed";

export interface PaymentLinkData {
  id: string;
  description: string;
  usdValue: string;
  cryptoValue?: string;
  createdAt: string;
  expiresAt: string;
  status: PaymentLinkStatus;
  timesUsed: number;
  paymentUrl: string;
  linkType?: "standard" | "donation";
  donation?: {
    title: string | null;
    goalAmount: number | null;
    raisedAmount: number;
    supportersCount: number;
    progressPercent: number | null;
  } | null;
}

export interface PaymentLinksTableProps {
  paymentLinks: PaymentLinkData[];
  rowsPerPage?: number;
}

export interface PaymentLinkSuccessModalProps {
  open: boolean;
  onClose: () => void;
  /** Resets the create form for a fresh link (create route only). */
  onCreateAnother?: () => void;
  paymentLink: string;
  paymentSettings: {
    value: string;
    currency?: string;
    cryptoValue: string;
    expire: string;
    description: string;
    blockchainFees: string;
    linkId: string;
    acceptedCryptoCurrency?: string[];
  };
  onCopyLink: () => void;
  walletList?: Array<{
    wallet_type: string;
    wallet_address: string;
    [key: string]: any;
  }>;
  directPayAddress?: string | null;
  directPayQrCode?: string | null;
  /** Selected link kind — switches the success copy (donation vs standard). */
  linkKind?: string;
}

export interface PaymentDetailRowProps {
  icon: string;
  alt: string;
  label: string;
  value: React.ReactNode;
  iconStyle?: React.CSSProperties;
  alignTop?: boolean;
}
