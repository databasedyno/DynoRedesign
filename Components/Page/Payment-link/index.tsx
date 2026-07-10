import EmptyDataModel from "@/Components/UI/EmptyDataModel";
import useIsMobile from "@/hooks/useIsMobile";
import { PaymentLinkData, PaymentLinksProps } from "@/utils/types/paymentLink";
import { Box, CircularProgress } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { PaymentLinkAction } from "@/Redux/Actions";
import { PAYLINK_FETCH } from "@/Redux/Actions/PaymentLinkAction";
import { rootReducer } from "@/utils/types";
import PaymentLinksTable from "./PaymentLinksTable";
import PaymentLinksTopBar, { PaymentLinkStatusFilter } from "./PaymentLinksTopBar";

const PaymentLinksPage = ({
  setPageName,
  setPageDescription,
  setPageAction,
}: PaymentLinksProps) => {
  const dispatch = useDispatch();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<PaymentLinkStatusFilter>("all");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");

  const selectedCompanyId = useSelector(
    (state: rootReducer) => (state as any).companyReducer?.selectedCompanyId
  );

  useEffect(() => {
    setPageName?.("");
    setPageDescription?.("");
    setPageAction?.(null);
  }, []);

  useEffect(() => {
    const payload = selectedCompanyId ? { company_id: selectedCompanyId } : undefined;
    dispatch(PaymentLinkAction(PAYLINK_FETCH, payload));
  }, [dispatch, selectedCompanyId]);

  const isMobile = useIsMobile("md");

  const paymentLinkState = useSelector(
    (state: rootReducer) => state.paymentLinkReducer
  );

  // Map API data to PaymentLinkData format
  const paymentLinks: PaymentLinkData[] = useMemo(() => {
    return paymentLinkState.paymentLinks.map((link: any) => {
      const isDonation = link.link_type === "donation";
      return {
      id: link._id || link.link_id || link.id,
      // Donation campaigns: the campaign title is the meaningful label
      description: (isDonation ? link.donation?.title : null) || link.description || "",
      // Donation campaigns: show the RAISED amount in the value column
      usdValue: isDonation
        ? `${Number(link.donation?.raised_amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${link.base_currency || "USD"}`
        : link.display_value
          ? String(link.display_value)
          : link.base_amount
            ? `${Number(link.base_amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${link.base_currency || ""}`
            : "0",
      cryptoValue: link.crypto_currencies
        ? String(link.crypto_currencies)
        : "",
      createdAt: link.created || link.created_at || link.createdAt || "",
      expiresAt: link.expires || link.expires_at || link.expiresAt || "",
      status: (link.status || "pending").toLowerCase(),
      timesUsed: link.times_used || link.timesUsed || 0,
      paymentUrl: link.payment_link || link.paymentUrl || link.payment_url || "",
      linkType: isDonation ? ("donation" as const) : ("standard" as const),
      donation: link.donation
        ? {
            title: link.donation.title || null,
            goalAmount: link.donation.goal_amount ?? null,
            raisedAmount: link.donation.raised_amount || 0,
            supportersCount: link.donation.supporters_count || 0,
            progressPercent: link.donation.progress_percent ?? null,
          }
        : null,
      };
    });
  }, [paymentLinkState.paymentLinks]);

  // Filter by search, status, and date range
  const filteredLinks = useMemo(() => {
    let result = paymentLinks;

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (link) =>
          link.description.toLowerCase().includes(q) ||
          link.id.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter(
        (link) => link.status === statusFilter
      );
    }

    // Date range filter
    if (dateStart) {
      const start = new Date(dateStart);
      start.setHours(0, 0, 0, 0);
      result = result.filter((link) => {
        if (!link.createdAt) return true;
        return new Date(link.createdAt) >= start;
      });
    }
    if (dateEnd) {
      const end = new Date(dateEnd);
      end.setHours(23, 59, 59, 999);
      result = result.filter((link) => {
        if (!link.createdAt) return true;
        return new Date(link.createdAt) <= end;
      });
    }

    return result;
  }, [paymentLinks, searchQuery, statusFilter, dateStart, dateEnd]);

  const handleSearch = (value: string) => {
    setSearchQuery(value);
  };

  const handleStatusFilter = (status: PaymentLinkStatusFilter) => {
    setStatusFilter(status);
  };

  const handleDateFilter = (start: string, end: string) => {
    setDateStart(start);
    setDateEnd(end);
  };

  // NB: no full-page spinner while loading — the Table now renders skeleton
  // rows internally (see PaymentLinksTable.tsx, M4). This keeps the top-bar
  // filters interactive during the initial fetch.
  const isLoading = !!paymentLinkState.loading;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
        "> :not(:last-child)": {
          marginBottom: isMobile ? "10px" : "20px",
        },
      }}
    >
      <PaymentLinksTopBar
        onSearch={handleSearch}
        onStatusFilter={handleStatusFilter}
        onDateFilter={handleDateFilter}
        statusFilter={statusFilter}
      />

      {!isLoading && filteredLinks?.length === 0 ? (
        <EmptyDataModel pageName="payment-links" />
      ) : (
        <PaymentLinksTable
          paymentLinks={filteredLinks}
          rowsPerPage={10}
          loading={isLoading}
        />
      )}
    </Box>
  );
};

export default PaymentLinksPage;
