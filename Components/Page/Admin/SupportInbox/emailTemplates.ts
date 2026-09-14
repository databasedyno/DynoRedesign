// Saved email reply templates for the admin Support Inbox. A handful of
// sensible built-ins ship by default; agents can save their own on top of
// them. User templates are persisted per-browser in localStorage (id prefixed
// "user-") so nothing here touches the LIVE production database.
export interface EmailTemplate {
  id: string;
  label: string;
  subject?: string;
  body: string;
  builtin?: boolean;
}

const STORAGE_KEY = "dynopay_admin_email_templates";

export const DEFAULT_EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: "builtin-followup",
    label: "Follow-up",
    subject: "Re: your Dynopay support request",
    body:
      "Hi,\n\nThanks for reaching out to Dynopay support. I've looked into your request and wanted to follow up with you directly.\n\nPlease let me know if you have any other questions — I'm happy to help.\n\nBest regards,\nThe Dynopay Support Team",
    builtin: true,
  },
  {
    id: "builtin-no-deposit",
    label: "No deposit detected",
    subject: "About your Dynopay payment",
    body:
      "Hi,\n\nI checked our records and we haven't detected an on-chain deposit for this payment yet, so nothing has been sent to your wallet. Dynopay is non-custodial — funds settle directly to your connected address once the customer's payment is confirmed on-chain.\n\nIf you believe funds were sent, please reply with the blockchain transaction hash (TxID) and the exact address they were sent to, and we'll trace it right away.\n\nBest regards,\nThe Dynopay Support Team",
    builtin: true,
  },
  {
    id: "builtin-kyc",
    label: "KYC in review",
    subject: "Your Dynopay verification",
    body:
      "Hi,\n\nThanks for your patience — your identity verification is currently being reviewed by our team. We'll email you as soon as it's approved, and you can keep testing payments in the meantime.\n\nBest regards,\nThe Dynopay Support Team",
    builtin: true,
  },
];

const readUserTemplates = (): EmailTemplate[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as EmailTemplate[]) : [];
  } catch {
    return [];
  }
};

const writeUserTemplates = (list: EmailTemplate[]): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* ignore quota / serialization errors */
  }
};

// Built-ins first, then the agent's own saved templates.
export const loadEmailTemplates = (): EmailTemplate[] => [
  ...DEFAULT_EMAIL_TEMPLATES,
  ...readUserTemplates(),
];

export const saveEmailTemplate = (input: {
  label: string;
  subject?: string;
  body: string;
}): EmailTemplate[] => {
  const list = readUserTemplates();
  const template: EmailTemplate = {
    id: `user-${Date.now()}`,
    label: input.label.trim().slice(0, 40) || "Untitled",
    subject: input.subject?.trim() || undefined,
    body: input.body,
  };
  const next = [...list, template];
  writeUserTemplates(next);
  return loadEmailTemplates();
};

export const deleteEmailTemplate = (id: string): EmailTemplate[] => {
  writeUserTemplates(readUserTemplates().filter((t) => t.id !== id));
  return loadEmailTemplates();
};
