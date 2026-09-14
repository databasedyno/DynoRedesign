/**
 * CommandPalette — Move 4 of the usability restructuring (⌘K global search).
 *
 * One search field that finds:
 *  - PAGES    ("settings", "webhooks", "wallet"…) — static index, i18n labels
 *  - ACTIONS  ("create payment link", "add wallet"…)
 *  - RECORDS  — customers (server search, read-only GET) and payment links
 *               (fetched once per palette open, filtered client-side); long
 *               alphanumeric queries also offer a transaction-ID search that
 *               deep-links into /transactions?search=<q>.
 *
 * Open with ⌘K / Ctrl+K anywhere in the app, or the magnifier in the header.
 * Keyboard: ↑ ↓ to move, Enter to go, Esc to close.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  CircularProgress,
  Dialog,
  IconButton,
  InputBase,
  Typography,
  useTheme,
} from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import NorthEastRoundedIcon from "@mui/icons-material/NorthEastRounded";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";

import axiosBaseApi from "@/axiosConfig";
import { API_ENDPOINTS } from "@/api/endpoints";

/** Fired by the palette's "Create payment link" action; CreateNewButton listens. */
export const QUICK_CREATE_LINK_EVENT = "dynopay:quick-create-link";

type Item = {
  id: string;
  group: "pages" | "actions" | "customers" | "links" | "transactions";
  label: string;
  sub?: string;
  keywords?: string;
  run: () => void;
};

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const CommandPaletteDialog = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const router = useRouter();
  const { t } = useTranslation("dashboardLayout");

  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [customers, setCustomers] = useState<Array<{ key: string; name: string; email: string | null }>>([]);
  const [links, setLinks] = useState<Array<{ id: string | number; description: string | null }>>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const linksLoaded = useRef(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  const go = useCallback(
    (path: string) => {
      onClose();
      router.push(path);
    },
    [onClose, router],
  );

  // Reset on every open.
  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      setCustomers([]);
      linksLoaded.current = false;
      setLinks([]);
    }
  }, [open]);

  // ── Static index: pages + actions ──
  const pages = useMemo<Item[]>(
    () => [
      { id: "p-dashboard", label: t("dashboard", { defaultValue: "Dashboard" }), keywords: "home overview kpi", path: "/dashboard" },
      { id: "p-transactions", label: t("transactions", { defaultValue: "Transactions" }), keywords: "payments history sales orders", path: "/transactions" },
      { id: "p-paylinks", label: t("payLinks", { defaultValue: "Payment links" }), keywords: "links checkout request", path: "/pay-links" },
      { id: "p-invoices", label: t("receiptsTax", { defaultValue: "Receipts & Tax" }), keywords: "invoices receipts tax vat", path: "/invoices" },
      { id: "p-customers", label: t("customers", { defaultValue: "Customers" }), keywords: "buyers payers crm", path: "/customers" },
      { id: "p-wallet", label: t("payoutWallets", { defaultValue: "Payout wallets" }), keywords: "wallet crypto address", path: "/wallet" },
      { id: "p-payouts", label: t("balancesPayouts", { defaultValue: "Balances" }), keywords: "payouts settlement", path: "/payouts" },
      { id: "p-storefront", label: t("storefront", { defaultValue: "Your page" }), keywords: "your page creator shop products storefront checkout", path: "/storefront" },
      { id: "p-settings", label: t("settings", { defaultValue: "Settings" }), keywords: "account company profile preferences", path: "/settings" },
      { id: "p-developers", label: t("developers", { defaultValue: "Developers" }), keywords: "api keys webhooks integration", path: "/developer-keys" },
      { id: "p-notifications", label: t("notifications", { defaultValue: "Notifications" }), keywords: "inbox alerts", path: "/notifications" },
      { id: "p-referrals", label: t("referrals", { defaultValue: "Referrals" }), keywords: "invite reward 50%", path: "/referrals" },
      { id: "p-help", label: t("helpSupport", { defaultValue: "Help & support" }), keywords: "faq docs contact chat", path: "/help-support" },
    ].map((p) => ({
      id: p.id,
      group: "pages" as const,
      label: p.label,
      keywords: p.keywords,
      run: () => go(p.path),
    })),
    [t, go],
  );

  const actions = useMemo<Item[]>(
    () => [
      {
        id: "a-create-link",
        group: "actions",
        label: t("search.actionCreateLink", { defaultValue: "Create payment link" }),
        keywords: "new pay link request money",
        run: () => {
          onClose();
          if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(QUICK_CREATE_LINK_EVENT));
        },
      },
      {
        id: "a-create-product",
        group: "actions",
        label: t("search.actionCreateProduct", { defaultValue: "Create product" }),
        keywords: "new product catalog sell",
        run: () => go("/pay-links/products/new"),
      },
      {
        id: "a-add-wallet",
        group: "actions",
        label: t("search.actionAddWallet", { defaultValue: "Add payout wallet" }),
        keywords: "new wallet address crypto",
        run: () => go("/wallet"),
      },
    ],
    [t, go, onClose],
  );

  // ── Records: customers (server) + pay-links (fetch once, filter locally) ──
  useEffect(() => {
    if (!open) return;
    const query = q.trim();
    if (query.length < 2) {
      setCustomers([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoadingRecords(true);
      try {
        const [custRes] = await Promise.all([
          axiosBaseApi
            .get(API_ENDPOINTS.userApi.customersDirectory, { params: { search: query, limit: 5 } })
            .catch(() => null),
          (async () => {
            if (!linksLoaded.current) {
              const r = await axiosBaseApi.get("/pay/getPaymentLinks").catch(() => null);
              const arr = r?.data?.data;
              const list = Array.isArray(arr) ? arr : arr?.paymentLinks || [];
              if (!cancelled) {
                setLinks(
                  list.map((l: any) => ({ id: l.link_id ?? l.id, description: l.description || l.title || null })),
                );
                linksLoaded.current = true;
              }
            }
          })(),
        ]);
        if (!cancelled) {
          const rows = custRes?.data?.data?.customers || [];
          setCustomers(
            rows
              .filter((r: any) => r.kind === "person")
              .slice(0, 5)
              .map((r: any) => ({ key: r.key, name: r.name || r.email || r.key, email: r.email })),
          );
        }
      } finally {
        if (!cancelled) setLoadingRecords(false);
      }
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q, open]);

  const items = useMemo<Item[]>(() => {
    const query = norm(q.trim());
    // Rank so LABEL matches beat keyword-only matches (e.g. "sett" must put
    // "Settings" above "Balances", which merely has the keyword "settlement").
    const score = (it: { label: string; keywords?: string; sub?: string }): number => {
      if (!query) return 1;
      const l = norm(it.label);
      if (l.startsWith(query)) return 4;
      if (l.includes(query)) return 3;
      if (it.sub && norm(it.sub).includes(query)) return 2;
      if (it.keywords && norm(it.keywords).includes(query)) return 1;
      return 0;
    };
    const rank = (list: Item[]) =>
      list
        .map((it) => ({ it, s: score(it) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .map((x) => x.it);

    const rankedActions = rank(actions);
    const rankedPages = rank(pages);
    const out: Item[] = [];
    // Whichever group holds the single best match leads the list.
    const bestAction = rankedActions.length ? score(rankedActions[0]) : 0;
    const bestPage = rankedPages.length ? score(rankedPages[0]) : 0;
    if (bestPage > bestAction) out.push(...rankedPages, ...rankedActions);
    else out.push(...rankedActions, ...rankedPages);

    if (query.length >= 2) {
      out.push(
        ...customers.map((c) => ({
          id: `c-${c.key}`,
          group: "customers" as const,
          label: c.name,
          sub: c.email || undefined,
          run: () => go(`/customers?search=${encodeURIComponent(c.email || c.name)}`),
        })),
      );
      const matchedLinks = links
        .filter((l) => score({ label: String(l.description || ""), keywords: String(l.id) }) > 0)
        .slice(0, 5);
      out.push(
        ...matchedLinks.map((l) => ({
          id: `l-${l.id}`,
          group: "links" as const,
          label: l.description || `#${l.id}`,
          sub: `#${l.id}`,
          run: () => go("/pay-links"),
        })),
      );
      // Long alphanumeric query → offer a transaction-ID deep search.
      if (/^[a-z0-9-]{6,}$/i.test(q.trim())) {
        out.push({
          id: "tx-search",
          group: "transactions",
          label: t("search.searchTransactions", {
            defaultValue: 'Search transactions for "{{q}}"',
            q: q.trim(),
          }),
          run: () => go(`/transactions?search=${encodeURIComponent(q.trim())}`),
        });
      }
    }
    return out;
  }, [q, pages, actions, customers, links, go, t]);

  useEffect(() => setActive(0), [q, items.length]);

  const groupTitle: Record<Item["group"], string> = {
    actions: t("search.groupActions", { defaultValue: "Actions" }),
    pages: t("search.groupPages", { defaultValue: "Pages" }),
    customers: t("search.groupCustomers", { defaultValue: "Customers" }),
    links: t("search.groupLinks", { defaultValue: "Payment links" }),
    transactions: t("search.groupTransactions", { defaultValue: "Transactions" }),
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      items[active]?.run();
    }
  };

  // Keep the active row in view.
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${active}"]`);
    (el as HTMLElement | null)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const border = isDark ? "rgba(255,255,255,0.10)" : "#E9ECF2";
  let lastGroup: string | null = null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      data-testid="command-palette"
      PaperProps={{
        sx: {
          borderRadius: { xs: "14px", sm: "16px" },
          mt: { xs: 2, sm: "10vh" },
          alignSelf: "flex-start",
          mx: { xs: 1.5, sm: "auto" },
          width: { xs: "calc(100% - 24px)", sm: "100%" },
          backgroundImage: "none",
          border: `1px solid ${border}`,
        },
      }}
      sx={{ "& .MuiDialog-container": { alignItems: "flex-start" } }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, px: 2, py: 1.5, borderBottom: `1px solid ${border}` }}>
        <SearchRoundedIcon sx={{ fontSize: 20, color: theme.palette.text.secondary }} />
        <InputBase
          autoFocus
          fullWidth
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t("search.placeholder", { defaultValue: "Search pages, actions, customers, links…" })}
          inputProps={{ "data-testid": "command-palette-input", "aria-label": "Global search" }}
          sx={{ fontFamily: "var(--font-sans)", fontSize: 15 }}
        />
        {loadingRecords && <CircularProgress size={16} sx={{ color: theme.palette.text.secondary }} />}
        <Box
          component="kbd"
          sx={{
            display: { xs: "none", sm: "inline-block" },
            fontFamily: "var(--font-tech), monospace",
            fontSize: 10.5,
            px: 0.75,
            py: 0.25,
            borderRadius: "6px",
            border: `1px solid ${border}`,
            color: theme.palette.text.secondary,
          }}
        >
          esc
        </Box>
      </Box>

      <Box ref={listRef} sx={{ maxHeight: "52vh", overflowY: "auto", py: 0.75 }}>
        {items.length === 0 ? (
          <Typography sx={{ px: 2.5, py: 3, textAlign: "center", fontFamily: "var(--font-sans)", fontSize: 13.5, color: theme.palette.text.secondary }}>
            {t("search.noResults", { defaultValue: "No matches — try a page name, customer email or link name." })}
          </Typography>
        ) : (
          items.map((it, idx) => {
            const showGroup = it.group !== lastGroup;
            lastGroup = it.group;
            return (
              <React.Fragment key={it.id}>
                {showGroup && (
                  <Typography
                    sx={{
                      px: 2.5,
                      pt: idx === 0 ? 0.75 : 1.5,
                      pb: 0.5,
                      fontFamily: "var(--font-tech), monospace",
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.22em",
                      textTransform: "uppercase",
                      color: theme.palette.text.secondary,
                    }}
                  >
                    {groupTitle[it.group]}
                  </Typography>
                )}
                <Box
                  data-idx={idx}
                  data-testid={`palette-item-${it.id}`}
                  onClick={() => it.run()}
                  onMouseEnter={() => setActive(idx)}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.25,
                    mx: 1,
                    px: 1.5,
                    py: 1.1,
                    minHeight: 44,
                    borderRadius: "10px",
                    cursor: "pointer",
                    backgroundColor:
                      idx === active ? (isDark ? "rgba(129,140,248,0.14)" : "rgba(79,70,229,0.08)") : "transparent",
                  }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography noWrap sx={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600, color: theme.palette.text.primary }}>
                      {it.label}
                    </Typography>
                    {it.sub && (
                      <Typography noWrap sx={{ fontFamily: "var(--font-sans)", fontSize: 12, color: theme.palette.text.secondary }}>
                        {it.sub}
                      </Typography>
                    )}
                  </Box>
                  <NorthEastRoundedIcon sx={{ fontSize: 14, color: theme.palette.text.secondary, opacity: idx === active ? 1 : 0.35 }} />
                </Box>
              </React.Fragment>
            );
          })
        )}
      </Box>
    </Dialog>
  );
};

/** Header trigger: magnifier button (≥44px) + the global ⌘K / Ctrl+K shortcut. */
const GlobalSearchButton = () => {
  const theme = useTheme();
  const { t } = useTranslation("dashboardLayout");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <IconButton
        onClick={() => setOpen(true)}
        data-testid="header-global-search"
        aria-label={t("search.open", { defaultValue: "Search" })}
        sx={{ minWidth: { xs: 40, sm: 44 }, minHeight: 44, px: { xs: 0.75, sm: 1 }, color: theme.palette.text.primary }}
      >
        <SearchRoundedIcon sx={{ fontSize: 21 }} />
      </IconButton>
      <CommandPaletteDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
};

export default GlobalSearchButton;
