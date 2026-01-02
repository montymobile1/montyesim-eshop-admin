import { TabContext, TabList, TabPanel } from "@mui/lab";
import { Card, Grid2, Tab } from "@mui/material";
import { useState } from "react";
import DevicesTab from "./tabs/DevicesTab";
import WalletTransactionsTab from "./tabs/WalletTransactionsTab";

const UserDetail = () => {
  const [selectedTab, setSelectedTab] = useState("1");

  const handleChangeSelectedTab = (event, newValue) => {
    setSelectedTab(newValue);
  };

  return (
    <Card className="page-card">
      <Grid2 container>
        <TabContext value={selectedTab}>
          <Grid2 size={{ xs: 12 }}>
            <TabList
              onChange={handleChangeSelectedTab}
              aria-label="lab API tabs example"
            >
              <Tab label="Devices" value="1" />

              {import.meta.env.VITE_SUPPORT_PROMO == "true" && (
                <Tab label="Wallet Transactions" value="2" />
              )}
            </TabList>
          </Grid2>
          <Grid2 size={{ xs: 12 }}>
            <TabPanel value="1">
              <DevicesTab />
            </TabPanel>
            <TabPanel value="2">
              <WalletTransactionsTab />
            </TabPanel>
          </Grid2>
        </TabContext>
      </Grid2>
    </Card>
  );
};

export default UserDetail;
