import { Card, Chip, Tab, Tabs, Typography } from "@mui/material";
import { useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";
import ChangePasswordTab from "../../Components/page-component/profile/ChangePasswordTab";
import MyDevicesTab from "../../Components/page-component/trusted-devices/MyDevicesTab";
import { ROLE_LABELS } from "../../core/vairables/Permissions";

/*
  TEOS-307: the signed-in admin's profile, full width, one tab per section.
  The open tab is kept in the URL (?tab=...).
  TEOS-256: "Trusted devices" (?tab=devices), the admin's own devices.
*/
const PROFILE_TABS = [
  { value: "password", label: "Change password", component: ChangePasswordTab },
  { value: "devices", label: "Trusted devices", component: MyDevicesTab },
];

const ProfilePage = () => {
  const userInfo = useSelector((state) => state.authentication?.user_info);
  const [searchParams, setSearchParams] = useSearchParams();
  const active =
    PROFILE_TABS.find((tab) => tab.value === searchParams.get("tab")) || PROFILE_TABS[0];
  const ActiveTab = active.component;

  return (
    <Card className="page-card flex flex-col gap-6 w-full">
      <div className="flex flex-col gap-3">
        <Typography variant="h6" component="h1" fontWeight={700}>
          Profile
        </Typography>
        <div className="flex flex-col gap-1">
          <Typography variant="body2" color="text.secondary">
            Signed in as
          </Typography>
          <div className="flex flex-row flex-wrap items-center gap-2">
            <Typography data-testid="profile-email" className="break-all">
              {userInfo?.email || "N/A"}
            </Typography>
            {userInfo?.role && (
              <Chip
                size="small"
                color={userInfo.role === "super_admin" ? "primary" : "default"}
                label={ROLE_LABELS[userInfo.role] || userInfo.role}
              />
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <Tabs
          value={active.value}
          onChange={(_, tab) => setSearchParams({ tab }, { replace: true })}
          aria-label="Profile sections"
          sx={{ borderBottom: 1, borderColor: "divider" }}
        >
          {PROFILE_TABS.map((tab) => (
            <Tab key={tab.value} value={tab.value} label={tab.label} />
          ))}
        </Tabs>
        <ActiveTab />
      </div>
    </Card>
  );
};

export default ProfilePage;
