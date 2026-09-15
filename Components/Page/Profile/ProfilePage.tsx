import { Grid } from "@mui/material";

import { TokenData } from "@/utils/types";
import AccountSetting from "./AccountSetting";
import AddContactInfo from "./AddContactInfo";

/** Settings → Profile. Password, 2FA, wallet protection and devices live in Settings → Security. */
const ProfilePage = ({ tokenData }: { tokenData: TokenData }) => {
  return (
    <Grid container columnSpacing={2.5} sx={{ rowGap: "14px" }}>
      <Grid item xs={12}>
        <AccountSetting tokenData={tokenData} />
      </Grid>
      <Grid item xs={12}>
        <AddContactInfo tokenData={tokenData} />
      </Grid>
    </Grid>
  );
};

export default ProfilePage;
