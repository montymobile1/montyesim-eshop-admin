import { api } from "./axios";

/*
  Contact us messages (MS-5082, TEOS-120). Read-only.
  GET /contact-us?page&page_size&search&from&to
  - search: email or message content, max 100 characters
  - from / to: YYYY-MM-DD, inclusive (from after to -> 422)
  -> res.data.data = { data: [{ id, email, content, created_at }], total_count }
     newest first (created_at desc, id desc)
*/
export const getAllMessages = async (params) => {
  return await api.get(`contact-us`, { params });
};
