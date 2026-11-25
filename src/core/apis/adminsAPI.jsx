import { api } from "./axios";

export { getApiErrorCode } from "./axios";

// TEOS-307: the Admins page (permission admin.security.manage, super admin only)
export const ADMIN_ROLE_FILTER = {
  all: "all",
  super_admin: "super_admin",
  admin: "admin",
};

// params: { page, page_size, role, search }
export const getAdmins = async (params) => {
  return await api.get(`admins`, { params });
};

// Emails the admin a single-use reset link; nothing changes until they use it.
export const sendPasswordReset = async (id) => {
  return await api.post(`admins/${id}/reset-password`);
};

// Removes the admin role (the account is kept) and signs the account out of the admin portal (the user portal stays signed in).
export const revokeAdminAccess = async ({ id, reason }) => {
  return await api.post(`admins/${id}/revoke-access`, { reason });
};
