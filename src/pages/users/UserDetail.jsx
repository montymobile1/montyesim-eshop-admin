import { TabContext, TabList, TabPanel } from "@mui/lab";
import { Button, Card, Chip, Grid2, Skeleton, Tab, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import CountUp from "react-countup";
import { Link, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import NoDataFound from "../../Components/shared/fallbacks/no-data-found/NoDataFound";
import { getUserById } from "../../core/apis/usersAPI";
import DevicesTab from "./tabs/DevicesTab";
import WalletTransactionsTab from "./tabs/WalletTransactionsTab";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const HeaderField = ({ label, testId, children }) => (
  <Typography
    variant="body2"
    component="div"
    className="flex flex-row items-center gap-1"
    data-testid={testId}
  >
    <span className="font-semibold">{label}:</span> {children}
  </Typography>
);

/*
  User detail (MS-5080): a header from GET /users/{id} (name, ban state, email,
  phone, creation date and the wallet balance) above the server-paged tabs.
*/
const UserDetail = () => {
  const { id } = useParams();
  const [selectedTab, setSelectedTab] = useState("1");
  // TEOS-153: a tab request answered 404 user_not_found (the user was deleted
  // after the profile loaded) turns the page into "User not found" as well.
  const [tabNotFound, setTabNotFound] = useState(false);
  const handleTabNotFound = () => setTabNotFound(true);
  // Read per render (not at import time) so tests can stub it.
  const supportPromo = import.meta.env.VITE_SUPPORT_PROMO == "true";

  // A malformed id is never sent to the API.
  const validId = UUID_PATTERN.test(id || "");

  const { data: user, isPending, isError, error } = useQuery({
    queryKey: ["users", "detail", id],
    queryFn: () => getUserById(id).then((res) => res?.data?.data),
    enabled: validId,
  });

  // TEOS-161: an unknown (404) or malformed (422) id is a "User not found" page,
  // with no tabs and no tab requests.
  const notFound =
    !validId || [404, 422].includes(error?.response?.status) || tabNotFound;

  useEffect(() => {
    if (isError && ![404, 422].includes(error?.response?.status) && !error?.isForbidden) {
      toast.error(error?.message || "Failed to load the user");
    }
  }, [isError, error]);

  const handleChangeSelectedTab = (event, newValue) => {
    setSelectedTab(newValue);
  };

  const fullName =
    user?.first_name || user?.last_name
      ? `${user?.first_name || ""} ${user?.last_name || ""}`.trim()
      : null;

  if (notFound) {
    return (
      <Card className="page-card" data-testid="user-not-found">
        <NoDataFound
          text="User not found"
          action={
            <Button component={Link} to="/users" variant="contained">
              Back to Users
            </Button>
          }
        />
      </Card>
    );
  }

  // The tabs load only once the user is known to exist.
  if (isPending) {
    return (
      <Card className="page-card" aria-busy="true">
        <Skeleton variant="text" width={240} height={40} />
        <Skeleton variant="rectangular" height={200} className="mt-4" />
      </Card>
    );
  }

  return (
    <Card className="page-card">
      <Grid2 container>
        {user && (
          <Grid2
            size={{ xs: 12 }}
            className="flex flex-col gap-2 mb-4"
            data-testid="user-detail-header"
          >
            {/* Only a real name is a title: the email (or a phone-only user) is a field below. */}
            {fullName && <Typography variant="h6">{fullName}</Typography>}
            {/* TEOS-160: every header value has its label; a null value is N/A. */}
            <div className="flex flex-row flex-wrap items-center gap-x-8 gap-y-2">
              <HeaderField label="Email" testId="user-email">
                {user?.email || "N/A"}
              </HeaderField>
              <HeaderField label="Phone" testId="user-phone">
                {user?.msisdn || "N/A"}
              </HeaderField>
              <HeaderField label="Created At" testId="user-created-at">
                {user?.created_at
                  ? dayjs(user?.created_at).format("DD-MM-YYYY HH:mm")
                  : "N/A"}
              </HeaderField>
              {supportPromo && (
                <HeaderField label="Wallet" testId="user-wallet">
                  {user?.wallet ? (
                    <>
                      {user?.wallet?.currency}{" "}
                      <CountUp
                        start={0}
                        end={Number(user?.wallet?.amount) || 0}
                        duration={1.5}
                        separator=","
                        decimals={2}
                      />
                    </>
                  ) : (
                    "N/A"
                  )}
                </HeaderField>
              )}
              <HeaderField label="Status" testId="user-status">
                <Chip
                  size="small"
                  label={user?.is_banned ? "Banned" : "Active"}
                  color={user?.is_banned ? "error" : "success"}
                />
                {user?.is_banned && user?.banned_until && (
                  <span className="text-xs whitespace-nowrap">
                    {`until ${dayjs(user?.banned_until).format("DD-MM-YYYY HH:mm")}`}
                  </span>
                )}
              </HeaderField>
            </div>
          </Grid2>
        )}
        <TabContext value={selectedTab}>
          <Grid2 size={{ xs: 12 }}>
            <TabList
              onChange={handleChangeSelectedTab}
              aria-label="User detail tabs"
            >
              <Tab label="Devices" value="1" />

              {supportPromo && <Tab label="Wallet Transactions" value="2" />}
            </TabList>
          </Grid2>
          <Grid2 size={{ xs: 12 }}>
            <TabPanel value="1">
              <DevicesTab onNotFound={handleTabNotFound} />
            </TabPanel>
            {supportPromo && (
              <TabPanel value="2">
                <WalletTransactionsTab onNotFound={handleTabNotFound} />
              </TabPanel>
            )}
          </Grid2>
        </TabContext>
      </Grid2>
    </Card>
  );
};

export default UserDetail;
