import { TabNavigationProps } from "@/utils/types/create-pay-link";
import { Box } from "@mui/material";
import React from "react";
import { TabContainer, TabItem } from "../../Page/CreatePaymentLink/styled";

const TabNavigation: React.FC<TabNavigationProps> = React.memo(
  ({ activeTab, onChange, tPaymentLink, hasPaymentLinkData }) => {
    if (hasPaymentLinkData) return null;
    return (
      <Box>
        <TabContainer>
          <TabItem onClick={() => onChange(0)} active={activeTab === 0}>
            <p>{tPaymentLink("paymentSettings")}</p>
          </TabItem>
          <TabItem onClick={() => onChange(1)} active={activeTab === 1}>
            <p>{tPaymentLink("postPaymentSettings")} <span style={{ fontWeight: 400, opacity: 0.6, fontSize: "0.85em" }}>({tPaymentLink("optional") || "Optional"})</span></p>
          </TabItem>
        </TabContainer>
      </Box>
    );
  },
);
TabNavigation.displayName = "TabNavigation";

export default TabNavigation;
