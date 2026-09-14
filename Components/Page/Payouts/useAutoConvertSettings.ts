import { useCallback, useEffect, useMemo, useState } from "react";
import axiosBaseApi from "@/axiosConfig";
import useApiSWR from "@/hooks/useApiSWR";
import API_ENDPOINTS from "@/api/endpoints";
import { SettlementOption } from "./payoutsHelpers";

/** Settlement settings (GET/PUT /company/auto-convert) + optimistic toggle state. */
export const useAutoConvertSettings = (selectedCompanyId: number | null) => {
  const {
    data: settlement,
    isLoading: settlementLoading,
    mutate: mutateSettlement,
  } = useApiSWR<any>(
    selectedCompanyId ? API_ENDPOINTS.company.autoConvert(selectedCompanyId) : null,
    { select: (raw) => raw?.data ?? raw },
  );

  // API options carry settlement_currency / settlement_chain (+ wallet_type "USDT-TRC20"); normalise to currency / chain.
  const settlementOptions: SettlementOption[] = useMemo(() => {
    const raw = settlement?.available_settlement_options;
    if (!Array.isArray(raw)) return [];
    return raw.map((o: SettlementOption & { settlement_currency?: string; settlement_chain?: string }) => {
      const [wtCur, ...wtChain] = String(o.wallet_type || "").split("-");
      return { ...o, currency: o.currency || o.settlement_currency || wtCur, chain: o.chain || o.settlement_chain || wtChain.join("-") };
    });
  }, [settlement?.available_settlement_options]);

  const [enabled, setEnabled] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState("");
  const [toggling, setToggling] = useState(false);

  // Seed local toggle/selection state from the fetched settings.
  useEffect(() => {
    if (!settlement) return;
    setEnabled(settlement.auto_convert_enabled === true);
    const cur = settlement.settlement_currency;
    const ch = settlement.settlement_chain;
    const opts = settlementOptions;
    if (cur && ch) {
      const match = opts.find((o) => o.currency === cur && o.chain === ch);
      setSelectedWallet(match?.wallet_type || `${cur}-${ch}`);
    } else if (opts.length > 0) {
      setSelectedWallet(opts[0].wallet_type || "");
    }
  }, [settlement, settlementOptions]);

  const hasStablecoinWallet = settlementOptions.length > 0;

  const activeOption = settlementOptions.find((o) => o.wallet_type === selectedWallet);
  const settlementTarget = activeOption
    ? `${activeOption.currency} \u00b7 ${activeOption.chain}`
    : settlement?.settlement_currency && settlement?.settlement_chain
      ? `${settlement.settlement_currency} \u00b7 ${settlement.settlement_chain}`
      : settlementOptions[0]
        ? `${settlementOptions[0].currency} \u00b7 ${settlementOptions[0].chain}`
        : "\u2014";

  const putAutoConvert = useCallback(
    async (payload: Record<string, unknown>) => {
      if (!selectedCompanyId) return;
      await axiosBaseApi.put(API_ENDPOINTS.company.autoConvert(selectedCompanyId), payload);
    },
    [selectedCompanyId],
  );

  const enableAutoConvert = useCallback(
    async (walletType: string) => {
      if (!walletType) return;
      const opt = settlementOptions.find((o) => o.wallet_type === walletType);
      const currency = opt?.currency || walletType.split("-")[0];
      const chain = opt?.chain || walletType.split("-")[1];
      setToggling(true);
      setEnabled(true);
      setSelectedWallet(walletType);
      try {
        await putAutoConvert({
          auto_convert_enabled: true,
          settlement_currency: currency,
          settlement_chain: chain,
        });
        await mutateSettlement();
      } catch {
        setEnabled(false);
      } finally {
        setToggling(false);
      }
    },
    [settlementOptions, putAutoConvert, mutateSettlement],
  );

  const disableAutoConvert = useCallback(async () => {
    setToggling(true);
    setEnabled(false);
    try {
      await putAutoConvert({ auto_convert_enabled: false });
      await mutateSettlement();
    } catch {
      setEnabled(true);
    } finally {
      setToggling(false);
    }
  }, [putAutoConvert, mutateSettlement]);

  const handleToggle = () => {
    if (!selectedCompanyId || toggling) return;
    if (enabled) {
      disableAutoConvert();
      return;
    }
    if (!hasStablecoinWallet) return;
    enableAutoConvert(selectedWallet || settlementOptions[0]?.wallet_type || "");
  };

  const handleCoinChange = (walletType: string) => {
    setSelectedWallet(walletType);
    if (enabled) enableAutoConvert(walletType);
  };

  const toggleDisabled = toggling || (!hasStablecoinWallet && !enabled);

  return {
    settlement,
    settlementLoading,
    settlementOptions,
    enabled,
    selectedWallet,
    hasStablecoinWallet,
    settlementTarget,
    handleToggle,
    handleCoinChange,
    toggleDisabled,
  };
};

export type AutoConvertSettings = ReturnType<typeof useAutoConvertSettings>;
