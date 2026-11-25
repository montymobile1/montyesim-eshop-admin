import { api } from "./axios";

/*
  TEOS-256: trusted devices (contract: adminDocs TEOS-255-256-api-contract.md).
  Not the customer "Devices" page (devicesAPI.jsx).

  A device row: { id, name, browser, browser_version, os, os_version, timezone,
  screen, language, first_ip, last_ip, created_at, last_used_at, trusted,
  trusted_until, signed_in, current }
  Lists: res.data.data = { data: [rows], total_count }
*/

// ---- My devices (every admin) ----

export const getMyDevices = async () => {
  return await api.get(`me/devices`);
};

export const renameMyDevice = async ({ id, name }) => {
  return await api.patch(`me/devices/${id}`, { name });
};

// Revoking the current device ends this browser's session too.
export const revokeMyDevice = async (id) => {
  return await api.delete(`me/devices/${id}`);
};

// "Sign out all other devices" -> res.data.data = { revoked: n }
export const revokeMyOtherDevices = async () => {
  return await api.delete(`me/devices`, { params: { except: "current" } });
};

// ---- Another admin's devices (super admin, admin.security.manage) ----

export const getAdminDevices = async (adminId) => {
  return await api.get(`admins/${adminId}/devices`);
};

export const revokeAdminDevice = async ({ adminId, deviceId }) => {
  return await api.delete(`admins/${adminId}/devices/${deviceId}`);
};
