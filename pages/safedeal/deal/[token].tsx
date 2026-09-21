import React from "react";
import { useRouter } from "next/router";
import type { NextPageWithLayout } from "@/pages/_app";
import SafeDealShell from "@/Components/SafeDeal/SafeDealShell";
import DealPage from "@/Components/SafeDeal/DealPage";

const Page: NextPageWithLayout = () => {
  const { token } = useRouter().query;
  return (
    <SafeDealShell title="Deal" noindex>
      {token ? <DealPage token={String(token)} /> : null}
    </SafeDealShell>
  );
};
Page.layout = "none";
export default Page;
