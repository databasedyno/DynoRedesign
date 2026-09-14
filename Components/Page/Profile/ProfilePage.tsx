import { Grid } from "@mui/material";

import { TokenData } from "@/utils/types";
import AccountSetting from "./AccountSetting";
import UpdatePassword from "./UpdatePassword";
import AddContactInfo from "./AddContactInfo";
import LoginActivity from "./LoginActivity";
import ActiveSessions from "./ActiveSessions";
import TrustedDevices from "./TrustedDevices";
import TwoFactorAuth from "./TwoFactorAuth";
import WalletSecurityLink from "./WalletSecurityLink";

const ProfilePage = ({ tokenData }: { tokenData: TokenData }) => {
  return (
    <Grid container columnSpacing={2.5} sx={{ rowGap: "14px" }}>
      <Grid item md={6.89} xs={12}>
        <AccountSetting tokenData={tokenData} />
      </Grid>
      <Grid item md={5.11} xs={12}>
        <UpdatePassword />
      </Grid>
      <Grid item xs={12}>
        <TwoFactorAuth />
      </Grid>
      <Grid item xs={12}>
        <WalletSecurityLink />
      </Grid>
      <Grid item xs={12}>
        <AddContactInfo tokenData={tokenData} />
      </Grid>
      <Grid item xs={12}>
        <ActiveSessions />
      </Grid>
      <Grid item xs={12}>
        <TrustedDevices />
      </Grid>
      <Grid item xs={12}>
        <LoginActivity />
      </Grid>
    </Grid>
  );
};

export default ProfilePage;
