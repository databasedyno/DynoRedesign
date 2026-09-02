/**
 * Central map of backend API endpoint paths.
 *
 * Paths are relative to the axios base (`axiosBaseApi`, which already prefixes
 * `/api/`), so pass them straight to `axiosBaseApi.get/post/put`. For raw
 * `fetch()` callers, prefix with `/api` (e.g. `fetch("/api" + API_ENDPOINTS...)`).
 *
 * Dynamic endpoints are builder functions that interpolate their args VERBATIM
 * (any `encodeURIComponent(...)` etc. stays at the call site), so the produced
 * URL is byte-identical to the original inline template it replaced.
 *
 * Consolidates inline endpoint strings so a route rename is a one-line change.
 */
/** Path segment param — template literals coerce any of these to string. */
type PathId = string | number | string[];

export const API_ENDPOINTS = {
  creator: {
    /** Authenticated availability check (dashboard editor). */
    checkHandle: "/user/creator/check-handle",
    /** Public availability check (landing hero, unauthenticated). */
    checkHandlePublic: "/user/creator/check-handle-public",
    /** Public reservation (Redis TTL lock) claimed from the landing hero. */
    reserveHandle: "/user/creator/reserve-handle",
    /** Get/update the creator profile. */
    profile: "/user/creator/profile",
    /** Creator analytics (30-day tips + top supporters). */
    analytics: "/user/creator/analytics",
    /** Public creator stats. */
    stats: "/user/creator/stats",
    /** Cover-image upload. */
    uploadCover: "/user/creator/upload-cover",
    /** Authed availability check with query (handle + optional reservation token). */
    checkHandleQuery: (handleQuery: string, tokenSuffix: string) =>
      `/user/creator/check-handle?handle=${handleQuery}${tokenSuffix}`,
  },

  wallet: {
    addFunds: "/wallet/addFunds",
    authStep: "/wallet/authStep",
    copyWalletAddresses: "/wallet/copyWalletAddresses",
    reusableWallets: "/wallet/reusable-wallets",
    validateWalletAddress: "/wallet/validateWalletAddress",
    verifyCryptoPayment: "/wallet/verifyCryptoPayment",
    verifyPayment: "/wallet/verifyPayment",
    updateWallet: (walletId: PathId) => `/wallet/updateWallet/${walletId}`,
    updateWalletSendOtp: "/wallet/wallet/update/send-otp",
    updateWalletWithOtp: "/wallet/wallet/update",
  },

  pay: {
    addPayment: "/pay/addPayment",
    configuredCurrencies: "/pay/configured-currencies",
    getCurrencyRates: "/pay/getCurrencyRates",
    uploadCampaignImage: "/pay/uploadCampaignImage",
    verifyCryptoPayment: "/pay/verifyCryptoPayment",
    link: (slug: PathId) => `/pay/links/${slug}`,
    campaignTiers: (linkId: PathId) => `/pay/campaign/${linkId}/tiers`,
    campaignUpdates: (linkId: PathId) => `/pay/campaign/${linkId}/updates`,
    campaignWall: (linkId: PathId) => `/pay/campaign/${linkId}/wall?limit=100&sort=recent`,
    contributionReply: (contribId: PathId) => `/pay/contribution/${contribId}/reply`,
    tier: (tierId: PathId) => `/pay/tier/${tierId}`,
    update: (updateId: PathId) => `/pay/update/${updateId}`,
  },

  user: {
    addEmail: "/user/addEmail",
    addPhone: "/user/addPhone",
    checkEmail: "/user/checkEmail?email=",
    checkPhone: "/user/checkPhone?phone=",
    forgotPassword: "/user/forgot-password",
    forgotPasswordPhone: "/user/forgot-password-phone",
    forgotPasswordPhoneVerifyOtp: "/user/forgot-password-phone/verify-otp",
    forgotPasswordVerifyOtp: "/user/forgot-password/verify-otp",
    lastCompany: "/user/last-company",
    phoneTypeCheck: "/user/phone-type-check",
    registerEmail: "/user/registerEmail",
    registerEmailVerifyOtp: "/user/registerEmail/verify-otp",
    registerPhone: "/user/registerPhone",
    registerPhoneVerify: "/user/registerPhone/verify",
    resetPassword: "/user/reset-password",
    verifyAddEmail: "/user/verifyAddEmail",
    verifyAddPhone: "/user/verifyAddPhone",
  },

  company: {
    autoConvert: (companyId: PathId) => `/company/auto-convert/${companyId}`,
    upgradeToBusiness: (companyId: PathId) => `/company/upgrade-to-business/${companyId}`,
    webhookHistory: (companyId: PathId, q: string = "") =>
      `/company/webhook-history/${companyId}?page=1&limit=20${q}`,
    webhookHistoryDetail: (companyId: PathId, logId: PathId) =>
      `/company/webhook-history/${companyId}/detail/${logId}`,
    webhookSettings: (companyId: PathId) => `/company/webhook-settings/${companyId}`,
    webhookStats: (companyId: PathId) => `/company/webhook-stats/${companyId}?days=30`,
    webhookTest: (companyId: PathId) => `/company/webhook-test/${companyId}`,
    webhookReenable: (companyId: PathId) => `/company/webhook-reenable/${companyId}`,
    webhookDisable: (companyId: PathId) => `/company/webhook-disable/${companyId}`,
  },

  invoices: {
    list: "/invoices",
    taxReport: "/invoices/tax-report",
    taxReportCsv: "/invoices/tax-report/csv",
    pdf: (invoiceId: PathId) => `/invoices/${invoiceId}/pdf`,
  },

  referral: {
    discountStatus: "/referral/discount-status",
    earnings: "/referral/earnings",
    leaderboard: "/referral/leaderboard",
    leaderboardPublic: "/referral/leaderboard/public",
    list: "/referral/list",
    myCode: "/referral/my-code",
    payoutOverview: "/referral/payout/overview",
    payoutOtp: "/referral/payout/otp",
    payoutOptIn: "/referral/payout/opt-in",
    payoutRequest: "/referral/payout/request",
    payoutAuto: "/referral/payout/auto",
    payoutHistory: "/referral/payout/history",
    payoutHistoryExport: "/referral/payout/history/export",
  },

  status: {
    incidents: "/status/incidents",
    services: "/status/services",
    uptime: "/status/uptime",
  },

  kb: {
    articles: "/kb/articles?limit=20",
    article: (slug: PathId) => `/kb/articles/${slug}`,
    articleFeedback: (articleId: PathId) => `/kb/articles/${articleId}/feedback`,
    search: (q: string) => `/kb/search?q=${q}&limit=20`,
  },

  kyc: {
    submit: "/kyc/submit",
    resubmit: "/kyc/resubmit",
    status: "/kyc/status",
    requirements: "/kyc/requirements",
    history: "/kyc/history",
  },

  notifications: {
    list: "/notifications",
    readAll: "/notifications/read-all",
    markRead: (id: PathId) => `/notifications/${id}/read`,
  },

  products: {
    list: "/products",
    byId: (productId: PathId) => `/products/${productId}`,
  },

  transactions: {
    invoice: (transactionId: PathId) => `/transactions/${transactionId}/invoice`,
  },

  userApi: {
    customers: "/userApi/customers",
    customer: (customerId: PathId) => `/userApi/customer/${customerId}`,
    // Unified payments-derived customer directory (re-imagined Customers page)
    customersDirectory: "/userApi/customers/directory",
    customersDirectoryDetail: "/userApi/customers/directory/detail",
  },
} as const;

export default API_ENDPOINTS;
