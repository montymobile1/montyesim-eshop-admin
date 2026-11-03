/*
  Permission strings sent by the admin API in user.permissions
  (POST /auth/login, POST /auth/refresh, GET /auth/me).
  Keep in sync with the backend list (app/config/admin_permissions.py).
*/
export const PERMISSIONS = {
  // read (admin + super_admin)
  USERS_READ: "admin.users.read",
  ORDERS_READ: "admin.orders.read",
  BUNDLES_READ: "admin.bundles.read",
  GROUPS_READ: "admin.groups.read",
  TAGS_READ: "admin.tags.read",
  RULES_READ: "admin.rules.read",
  PROMOTIONS_READ: "admin.promotions.read",
  VOUCHERS_READ: "admin.vouchers.read",
  BANNERS_READ: "admin.banners.read",
  DEVICES_READ: "admin.devices.read",
  CONTACT_US_READ: "admin.contact_us.read",
  REFERRALS_READ: "admin.referrals.read",

  // write (admin + super_admin)
  BUNDLES_WRITE: "admin.bundles.write",
  GROUPS_WRITE: "admin.groups.write",
  TAGS_WRITE: "admin.tags.write",
  RULES_WRITE: "admin.rules.write",
  PROMOTIONS_WRITE: "admin.promotions.write",
  VOUCHERS_WRITE: "admin.vouchers.write",
  BANNERS_WRITE: "admin.banners.write",

  // super_admin only
  SETTINGS_READ: "admin.settings.read",
  SETTINGS_WRITE: "admin.settings.write",
  AUDIT_READ: "admin.audit.read",
  USERS_BAN: "admin.users.ban",
  BUNDLES_BULK: "admin.bundles.bulk",
  REFERRALS_EXPORT: "admin.referrals.export",
};

export const ADMIN_ROLES = {
  admin: "admin",
  super_admin: "super_admin",
};
