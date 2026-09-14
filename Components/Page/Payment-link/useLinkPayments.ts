import { useMemo } from "react";
import useSWR from "swr";
import axios from "@/axiosConfig";
import { toTxStatusBucket } from "@/helpers/txStatus";

export interface LinkPayment {
  id: string;
  transactionId: string | number;
  reference: string | null;
  cryptoAmount: number;
  cryptoCurrency: string;
  usdValue: number | null;
  status: string;
  createdAt: string;
  customer: string | null;
}

export interface LinkDetail {
  transaction_reference: string | null;
  paid_amount: number | null;
  paid_currency: string | null;
  accepted_currencies: string[] | string | null;
  redirect_url: string | null;
  expires_at: string | null;
}

const detailFetcher = async (key: string) => {
  const id = key.split(":")[1];
  const res = await axios.get(`/pay/links/${id}`);
  return (res?.data?.data ?? null) as LinkDetail | null;
};

// One transactions fetch per brand (latest 100) shared by every panel opening;
// rows are matched to a link client-side via source.link_id / parent_link_id /
// the settlement reference — no backend change (frontend-only guardrail).
const txFetcher = async (key: [string, number]) => {
  const res = await axios.post("wallet/getAllTransactions", {
    company_id: key[1],
    rowsPerPage: 100,
    page: 1,
  });
  return (res?.data?.data?.customers_transactions ?? []) as any[];
};

const COLLECTED_BUCKETS = new Set(["settled", "confirmed"]);

export const useLinkPayments = (linkId: string | null, companyId: number | null | undefined, enabled: boolean) => {
  const { data: detail, isLoading: detailLoading } = useSWR(
    enabled && linkId ? `paylink-detail:${linkId}` : null,
    detailFetcher,
    { revalidateOnFocus: false, dedupingInterval: 30_000 },
  );
  const { data: transactions, isLoading: txLoading } = useSWR(
    enabled && companyId ? (["paylink-payments", companyId] as [string, number]) : null,
    txFetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );

  const payments = useMemo<LinkPayment[]>(() => {
    if (!linkId || !transactions) return [];
    const ref = detail?.transaction_reference || null;
    return transactions
      .filter((tx) => {
        const src = tx?.source || {};
        return (
          String(src.link_id ?? "") === String(linkId) ||
          String(src.parent_link_id ?? "") === String(linkId) ||
          (ref && tx?.transaction_reference === ref)
        );
      })
      .map((tx) => ({
        id: String(tx.id ?? tx.transaction_id),
        transactionId: tx.transaction_id_display ?? tx.id ?? tx.transaction_id,
        reference: tx.transaction_reference ?? null,
        cryptoAmount: Number(tx.crypto_amount ?? tx.amount ?? 0),
        cryptoCurrency: String(tx.crypto_currency ?? tx.crypto ?? tx.base_currency ?? ""),
        usdValue: tx.usd_value == null ? null : Number(tx.usd_value),
        status: String(tx.status ?? ""),
        createdAt: String(tx.createdAt ?? tx.date_time ?? ""),
        customer: tx.customer_name && !/legacy api customer/i.test(tx.customer_name) ? String(tx.customer_name) : null,
      }));
  }, [transactions, linkId, detail?.transaction_reference]);

  const collectedUsd = useMemo(
    () =>
      payments.reduce(
        (sum, p) => (COLLECTED_BUCKETS.has(toTxStatusBucket(p.status)) && p.usdValue ? sum + p.usdValue : sum),
        0,
      ),
    [payments],
  );
  const lastPaymentAt = payments[0]?.createdAt ?? null;

  return { detail: detail ?? null, payments, collectedUsd, lastPaymentAt, loading: detailLoading || txLoading };
};

export default useLinkPayments;
