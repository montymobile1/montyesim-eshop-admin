import { api } from "./axios";

// GET /vouchers?search&status=all|active|inactive|used|expired&page&page_size
// res.data.data = { data: [{ id, code, amount, currency, is_active, is_used,
//   is_expired, expired_at, created_at, used_by: {id,email}|null, used_by_user }],
//   total_count, facets: { all, active, inactive, used, expired } }
export const getAllVouchers = (params) => api.get("vouchers", { params });

// POST /vouchers { code?, amount, expired_at } -> 201 with the voucher;
// without a code the server generates one (TEOS-133). 409 duplicate_code;
// 422 when the amount is above the VOUCHER_MAX_AMOUNT setting.
export const addVoucher = ({ code, amount, expired_at }) =>
  api.post("vouchers", {
    ...(code ? { code } : {}),
    amount,
    expired_at: expired_at || null,
  });

// PATCH /vouchers/{id}/status { is_active } -> 409 no_change when already in
// that state; 409 already_used when activating a redeemed voucher.
export const toggleVoucherStatus = ({ id, is_active }) =>
  api.patch(`vouchers/${id}/status`, { is_active });

// DELETE /vouchers/{id} -> 204; 409 voucher_used
export const DeleteVoucher = (voucherId) => api.delete(`vouchers/${voucherId}`);

// Shared helper, defined once in ./axios (kept here so existing imports keep working).
export { getApiErrorCode } from "./axios";
