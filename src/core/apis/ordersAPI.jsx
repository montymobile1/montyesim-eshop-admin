import { api } from "./axios";

/*
  Orders (MS-5082, TEOS-119). GET /orders?page&page_size&status=all|success|pending|canceled|failed
    &user_id&payment_status&from&to (YYYY-MM-DD)&search&sort=created_at|amount|order_status&dir
  -> res.data.data = { data: [order + bundle_name + bundle_code + user:{id,email,msisdn}|null],
                       total_count, facets: {all, success, pending, canceled, failed} }
  No payment_intent_code or raw bundle_data (TEOS-117).
  Wallet top-ups are excluded by the API.
*/
export const getAllOrders = async (params) => {
  return await api.get(`orders`, { params });
};

// The user selected in the filter, to show its email after a reload (only the id is in the URL).
// GET /users/lookup?id=<id> -> res.data.data = { data: [{ id, label, email }], total_count }
export const getOrdersFilterUser = async (id) => {
  return await api.get(`users/lookup`, { params: { id } });
};
