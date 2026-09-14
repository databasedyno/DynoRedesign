export interface ApiKeyCardProps {
  title: string;
  apiRow?: any;
  /** Plaintext key returned once by create/regenerate in this session; undefined otherwise. */
  revealedKey?: string;
  onCopy: (value: string) => void;
  onDelete: (apiId: number) => void;
}

export interface ApiKeysPageProps {
  openCreate?: boolean;
  setOpenCreate?: (open: boolean) => void;
  /**
   * Batch B (N4): which slice of the developer surface to render.
   * "all" (default) keeps the original single-page behavior; the Developers
   * tabs pass "keys" | "webhooks" | "events" | "docs".
   */
  view?: "all" | "keys" | "webhooks" | "events" | "docs";
}
