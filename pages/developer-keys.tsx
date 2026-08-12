import ApiKeysPage from "@/Components/Page/API/ApiKeysPage";
import CustomButton from "@/Components/UI/Buttons";
import OnboardingBanner from "@/Components/UI/OnboardingBanner";
import useIsMobile from "@/hooks/useIsMobile";
import { pageProps } from "@/utils/types";
import { AddRounded } from "@mui/icons-material";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

const APIs = ({
  setPageName,
  setPageDescription,
  setPageAction,
}: pageProps) => {
  const namespaces = ["apiScreen", "common"];
  const isMobile = useIsMobile("md");
  const { t } = useTranslation(namespaces);
  const tApi = useCallback(
    (key: string, defaultValue?: string) =>
      t(key, { ns: "apiScreen", defaultValue }),
    [t],
  );

  const [openCreate, setOpenCreate] = useState(false);
  const apiState = useSelector((state: any) => state?.apiReducer);
  const apiList: any[] = Array.isArray(apiState?.apiList) ? apiState.apiList : [];
  // Per-environment slots. Auto-provisioning gives every company a test key at
  // signup and a live key on first wallet — but if the user revokes one of them,
  // they should be able to mint that environment's key back manually.
  const hasActiveProd = apiList.some(
    (k) => k?.environment === "production" && k?.status === "active",
  );
  const hasActiveDev = apiList.some(
    (k) => k?.environment === "development" && k?.status === "active",
  );
  const canCreateAnother = !hasActiveProd || !hasActiveDev;

  useEffect(() => {
    if (setPageName && setPageDescription) {
      setPageName(tApi("apiKeysTitle", "API Keys"));
      setPageDescription(
        tApi(
          "apiKeysDescription",
          "Manage API keys for integrating Dynopay into your applications",
        ),
      );
    }
  }, [setPageName, setPageDescription, tApi]);

  useEffect(() => {
    if (!setPageAction) return;
    // Show "Create" only when at least one environment slot (prod/dev) is empty.
    // Both slots filled → hide (per-environment dedupe enforced by backend anyway).
    if (!canCreateAnother) {
      setPageAction(null);
    } else {
      setPageAction(
        <CustomButton
          label={isMobile ? tApi("createKeyMobile") : tApi("createNewKey")}
          variant="primary"
          size="medium"
          endIcon={<AddRounded sx={{ fontSize: isMobile ? 18 : 20 }} />}
          onClick={() => setOpenCreate(true)}
          sx={{
            height: isMobile ? 34 : 40,
            px: isMobile ? 1.5 : 2.5,
            fontSize: isMobile ? 13 : 15,
          }}
        />,
      );
    }
    return () => setPageAction(null);
  }, [setPageAction, tApi, isMobile, canCreateAnother]);

  return (
    <div style={{ "--font-sans": "var(--font-inter)", fontFamily: "var(--font-inter)" } as any}>
      <OnboardingBanner vertical="developers" />
      <ApiKeysPage openCreate={openCreate} setOpenCreate={setOpenCreate} />
    </div>
  );
};

export default APIs;
