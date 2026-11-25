//COMPONENTS
import PageNotFound from "../../Components/shared/fallbacks/page-not-found/PageNotFound";
import AssignBundleToGroups from "../../pages/AssignBundleToGroups/AssignBundleToGroups";
import AuditLogPage from "../../pages/audit-log/AuditLogPage";
import SignInPage from "../../pages/authentication/SignInPage";
import BundlesList from "../../pages/bundles/BundlesList";
import ContactusPage from "../../pages/contact-us/ContactusPage";
import DevicesPage from "../../pages/devices/DevicesPage";
import GroupsHandle from "../../pages/groups/GroupsHandle";
import GroupsList from "../../pages/groups/GroupsList";
import OrdersPage from "../../pages/orders/OrdersPage";
import HandlePromotions from "../../pages/promotions/HandlePromotions";
import PromoAnalysis from "../../pages/promotions/PromoAnalysis";
import PromotionsList from "../../pages/promotions/PromotionsList";
import Referrals from "../../pages/referral/Referrals";
import RulesList from "../../pages/rules/RulesList";
import EditSettings from "../../pages/settings/EditSettings";
import Settings from "../../pages/settings/Settings";
import SettingsLogs from "../../pages/settings/SettingsLogs";
import UserDetail from "../../pages/users/UserDetail";
import UsersPage from "../../pages/users/UsersPage";
import VoucherPage from "../../pages/vouchers/VoucherPage";
import RouteWrapper from "./RouteWrapper";
import { PERMISSIONS } from "../vairables/Permissions";
import HandleBanners from "../../pages/banners/HandleBanners";
import BannersList from "../../pages/banners/BannersList";
import GroupsTagReorder from "../../pages/groups/GroupsTagReorder";
import ProfilePage from "../../pages/profile/ProfilePage";
import AdminsPage from "../../pages/admins/AdminsPage";
import ResetPasswordPage from "../../pages/authentication/ResetPasswordPage";
import ResetPasswordWrapper from "./ResetPasswordWrapper";

export const privateRoutes = [
  {
    path: "/",
    element: <RouteWrapper shouldbeLoggedIn={true} />,
    key: "/users",
    name: "Users",
    regex: "^/users/?$",
    children: [
      {
        index: true,
        element: <UsersPage />,
        key: "/users",
        name: "Users",
        regex: "^/users/?$",
        permission: PERMISSIONS.USERS_READ,
      },
      {
        path: "/users",
        element: <UsersPage />,
        key: "/users",
        name: "Users",
        regex: "^/users/?$",
        permission: PERMISSIONS.USERS_READ,
      },
      {
        path: "/devices",
        element: <DevicesPage />,
        key: "/users",
        name: "Devices",
        regex: "^/devices/?$",
        permission: PERMISSIONS.DEVICES_READ,
      },
      {
        path: "/orders",
        element: <OrdersPage />,
        key: "/orders",
        name: "Orders",
        regex: "^/orders/?$",
        permission: PERMISSIONS.ORDERS_READ,
      },
      {
        path: "/users/:id",
        element: <UserDetail />,
        key: "/users/:id",
        name: "User Detail",
        regex: "^/users/([0-9a-fA-F-]+)$",
        permission: PERMISSIONS.USERS_READ,
      },
      {
        path: "/contact-us",
        element: <ContactusPage />,
        key: "/contact-us",
        name: "Contact Us",
        regex: "^/contact-us/?$",
        permission: PERMISSIONS.CONTACT_US_READ,
      },
      {
        path: "/bundles",
        element: <BundlesList />,
        key: "/bundles",
        name: "Bundles",
        regex: "^/bundles/?$",
        permission: PERMISSIONS.BUNDLES_READ,
      },
      {
        path: "/bundles/:bundleId/assign",
        element: <AssignBundleToGroups />,
        key: "/bundles/:bundleId/assign",
        name: "Assign Bundle To Groups",
        regex: "^/bundles/([0-9a-fA-F-]+)/assign?$",
        permission: PERMISSIONS.BUNDLES_READ,
      },
      {
        path: "/groups",
        element: <GroupsList />,
        key: "/groups",
        name: "Groups",
        regex: "^/groups/?$",
        permission: PERMISSIONS.GROUPS_READ,
      },
      {
        path: "/groups/add",
        element: <GroupsHandle />,
        key: "/groups/add",
        name: "Add Group",
        regex: "^/groups/add?$",
        permission: PERMISSIONS.GROUPS_READ,
      },
      {
        path: "/groups/:id",
        element: <GroupsHandle />,
        key: "/groups/:id",
        name: "Edit Group",
        regex: "^/groups/([0-9a-fA-F-]+)$",
        permission: PERMISSIONS.GROUPS_READ,
      },
      ...(import.meta.env.VITE_GROUP_TAG_ORDERING == "true"
        ? [
            {
              path: "/groups/:id/reorder",
              element: <GroupsTagReorder />,
              key: "/groups/:id/reorder",
              name: "Reorder Group's Tag",
              regex: "^/groups/([0-9a-fA-F-]+)/reorder$",
              permission: PERMISSIONS.GROUPS_READ,
            },
          ]
        : []),
      {
        path: "/rules",
        element: <RulesList />,
        key: "/rules",
        name: "Rules",
        regex: "^/rules/?$",
        permission: PERMISSIONS.RULES_READ,
      },
      ...(import.meta.env.VITE_APP_VOUCHER_CODE == "true"
        ? [
            {
              path: "/vouchers",
              element: <VoucherPage />,
              key: "/vouchers",
              name: "Vouchers",
              regex: "^/vouchers/?$",
              permission: PERMISSIONS.VOUCHERS_READ,
            },
          ]
        : []),
      {
        path: "/settings",
        element: <Settings />,
        key: "/settings",
        name: "Settings",
        regex: "^/settings/?$",
        permission: PERMISSIONS.SETTINGS_READ,
      },
      {
        path: "/settings/edit",
        element: <EditSettings />,
        key: "/settings/edit",
        name: "Edit Settings",
        regex: "^/settings/edit/?$",
        permission: PERMISSIONS.SETTINGS_WRITE,
      },
      {
        path: "/settings/logs",
        element: <SettingsLogs />,
        key: "/settings/logs",
        name: "Settings Logs",
        regex: "^/settings/logs/?$",
        permission: PERMISSIONS.SETTINGS_READ,
      },
      {
        path: "/audit-log",
        element: <AuditLogPage />,
        key: "/audit-log",
        name: "Audit Log",
        regex: "^/audit-log/?$",
        permission: PERMISSIONS.AUDIT_READ,
      },
      // TEOS-307: every admin's own profile (email, role, change password)
      {
        path: "/profile",
        element: <ProfilePage />,
        key: "/profile",
        name: "Profile",
        regex: "^/profile/?$",
      },
      // TEOS-307: admin accounts, super admin only
      {
        path: "/admins",
        element: <AdminsPage />,
        key: "/admins",
        name: "Admins",
        regex: "^/admins/?$",
        permission: PERMISSIONS.SECURITY_MANAGE,
      },

      ...(import.meta.env.VITE_SUPPORT_PROMO == "true"
        ? [
            {
              path: "/promotions",
              element: <PromotionsList />,
              key: "/promotions",
              name: "Promotions",
              regex: "^/promotions/?$",
              permission: PERMISSIONS.PROMOTIONS_READ,
            },
            {
              path: "/promotions/add",
              element: <HandlePromotions />,
              key: "/promotions/add",
              name: "Add Promotion",
              regex: "^/promotions/add?$",
              // MS-5053 case 16: without write permission the add page shows the permission page.
              permission: PERMISSIONS.PROMOTIONS_WRITE,
            },
            {
              path: "/promotions/:id",
              element: <HandlePromotions />,
              key: "/promotions/:id",
              name: "Edit Promotion",
              regex: "^/promotions/([0-9a-fA-F-]+)?$",
              permission: PERMISSIONS.PROMOTIONS_READ,
            },
            {
              path: "/promo-analysis",
              element: <PromoAnalysis />,
              key: "/promo-analysis",
              name: "Promo Analysis",
              regex: "^/promo-analysis/?$",
              permission: PERMISSIONS.PROMOTIONS_READ,
            },
          ]
        : []),
      ...(import.meta.env.VITE_APP_REFER_AND_EARN == "true"
        ? [
            {
              path: "/referrals",
              element: <Referrals />,
              key: "/referrals",
              name: "Referrals",
              regex: "^/referrals/?$",
              permission: PERMISSIONS.REFERRALS_READ,
            },
          ]
        : []),
      {
        path: "/banners",
        element: <BannersList />,
        key: "/banners",
        name: "Banners",
        regex: "^/banners/?$",
        permission: PERMISSIONS.BANNERS_READ,
      },
      {
        path: "/banners/add",
        element: <HandleBanners />,
        key: "/banners/add",
        name: "Add Banners",
        regex: "^/banners/add?$",
        permission: PERMISSIONS.BANNERS_WRITE,
      },
      {
        path: "/banners/:id",
        element: <HandleBanners />,
        key: "/banners/:id",
        name: "Edit Banners",
        regex: "^/banners/([0-9a-fA-F-]+)?$",
        permission: PERMISSIONS.BANNERS_WRITE,
      },
      {
        path: "*",
        element: <PageNotFound />,
        key: "/bundles",
        name: "Bundles",
        regex: "^/bundles/?$",
      },
    ],
  },
];

export const publicRoutes = [
  /*
    TEOS-307: the page of the password reset email link. Reachable signed in or
    not (RouteWrapper would send a signed-in admin away and lose the link's token).
  */
  {
    path: "/reset-password",
    element: <ResetPasswordWrapper />,
    key: "/reset-password",
    name: "Reset Password",
    regex: "^/reset-password/?$",
    children: [
      {
        index: true,
        element: <ResetPasswordPage />,
      },
    ],
  },
  {
    path: "/",
    element: <RouteWrapper shouldbeLoggedIn={false} />,
    key: "/",
    name: "Signin",
    regex: "^/signin/?$",
    children: [
      {
        index: true,
        element: <SignInPage />,
      },
      {
        path: "/signin",
        element: <SignInPage />,
        regex: "^/signin/?$",
      },
      {
        path: "*",
        element: <PageNotFound />,
      },
    ],
  },
];
