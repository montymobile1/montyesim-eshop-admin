import { api } from "./axios";

/*
  Users (MS-5080) on the admin API. Every call goes through the shared axios
  instance. The ban state, the ban and unban actions and their audit rows
  are handled by the API (MS-5079).
*/

export const HOURS_PER_DAY = 24;

// 365 days, the ban duration the interface pre-fills (TEOS-63).
export const DEFAULT_BAN_DAYS = 365;

// The same duration in hours, which is what the API stores (POST /users/{id}/ban).
export const DEFAULT_BAN_HOURS = DEFAULT_BAN_DAYS * HOURS_PER_DAY;

// Largest ban the API accepts, in hours (10 years).
export const MAX_BAN_HOURS = 87600;

// Values of the ban_status filter (the tabs of the users list).
export const BAN_STATUS = {
  all: "all",
  banned: "banned",
  active: "active",
};

// GET /users?search&ban_status=all|banned|active&sort=created_at|email&dir=asc|desc&page&page_size
// res.data.data = { data: [user rows with is_banned, banned_until], total_count,
//                   facets: { all, banned, active } }
export const getAllUsers = (params) => api.get("users", { params });

// GET /users/{id} -> res.data.data = user row + wallet: { amount, currency } | null; 404
export const getUserById = (id) => api.get(`users/${id}`);

// POST /users/{id}/ban { hours (1..87600, default 8760), reason }
// -> res.data.data = { user_id, email, banned_until, hours_banned }; 409 already_banned;
// 409 cannot_ban_self (own account, also on unban); 502 developerMessage
// "session_revoke_failed" = banned, but the open sessions could not be signed out (TEOS-111)
export const banUser = ({ id, hours = DEFAULT_BAN_HOURS, reason }) =>
  api.post(`users/${id}/ban`, { hours: Number(hours), reason });

// POST /users/{id}/unban { reason } -> res.data.data = { user_id, email }; 409 not_banned
export const unbanUser = ({ id, reason }) =>
  api.post(`users/${id}/unban`, { reason });

// GET /users/{id}/devices?page&page_size -> res.data.data = { data: [device rows], total_count }
export const getUserDevices = (id, params) =>
  api.get(`users/${id}/devices`, { params });

// GET /users/{id}/wallet-transactions?page&page_size
// -> res.data.data = { data: [{ id, wallet_id, amount, status, source, currency, created_at }], total_count }
export const getUserWalletTransactions = (id, params) =>
  api.get(`users/${id}/wallet-transactions`, { params });

// Shared helper, defined once in ./axios (kept here so pages can import it from this module).
export { getApiErrorCode } from "./axios";
