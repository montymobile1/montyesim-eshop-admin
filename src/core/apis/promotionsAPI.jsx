import { api } from "./axios";

/*
  MS-5051 / MS-5053 / MS-5055: promotions on the admin API (backend MS-5050, MS-5052, MS-5054).
  Lists come back as res.data.data = { data: [...], total_count, facets?, totals? }.
*/

// GET /promotions?search&status&rule_ids[]&bundle_codes[]&include_global&page&page_size
// facets: { all, active, inactive, expired, scheduled }
export const getAllPromotions = (params) =>
  api.get("promotions", { params, paramsSerializer: { indexes: null } });

// GET /promotions/{id} -> the promotion with rule and bundle_codes[]
export const getPromotionById = (id) => api.get(`promotions/${id}`);

// POST /promotions { name, code, rule_id, amount?, valid_from, valid_to, bundle_codes[] }
// -> 201; 409 duplicate_code / duplicate_name; 422 unknown bundle code.
// The server sets type, is_active and times_used: never send them.
export const AddPromotion = ({
  name,
  code,
  rule_id,
  amount,
  valid_from,
  valid_to,
  bundle_codes,
}) =>
  api.post("promotions", {
    name,
    code,
    rule_id,
    ...(amount !== null && amount !== undefined && amount !== "" && { amount }),
    valid_from,
    valid_to,
    bundle_codes: bundle_codes || [],
  });

// PUT /promotions/{id} { name, bundle_codes, valid_to?, code?, rule_id?, amount?, valid_from? }
// code, rule_id, amount and valid_from are immutable once used (409 promotion_used).
export const editPromotion = ({ id, ...body }) => {
  const payload = { name: body.name, bundle_codes: body.bundle_codes || [] };
  ["valid_to", "code", "rule_id", "amount", "valid_from"].forEach((key) => {
    if (body[key] !== null && body[key] !== undefined && body[key] !== "") {
      payload[key] = body[key];
    }
  });
  return api.put(`promotions/${id}`, payload);
};

// PATCH /promotions/{id}/status { is_active } -> 409 no_change when already in that state
export const togglePromotionStatus = ({ id, is_active }) =>
  api.patch(`promotions/${id}/status`, { is_active });

// DELETE /promotions/{id} -> 204; 409 promotion_used { times_used }
export const deletePromotion = (id) => api.delete(`promotions/${id}`);

// GET /promotions/usage?code&user_id&bundle_ids[]&from&to&page&page_size
// totals: { uses, distinct_users, discount_amount: [{ currency, amount }] }
export const getAllPromotionsUsage = (params) =>
  api.get("promotions/usage", { params, paramsSerializer: { indexes: null } });

// Shared helper, defined once in ./axios.
export { getApiErrorCode } from "./axios";

// The whole 409 detail object, e.g. { code: "promotion_used", times_used: 3 }.
export const getApiErrorDetails = (error) => {
  try {
    const parsed = JSON.parse(error?.response?.data?.developerMessage);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};
