import dayjs from "dayjs";
import { api, getApiErrorCode } from "./axios";

/*
  Referrals (MS-5057) on the admin API.

  GET /referrals?user_id&search&from_email&date&page&page_size   (admin.referrals.read)
    -> res.data.data = { data: [{ id, created_at, payment_time, referral_code, amount, currency,
         modified_amount, order_status, status, referrer: {id,email}|null, referred: {id,email}|null }],
         total_count }
    referrer = owner of the code, receives the reward ("To User Email");
    referred = bought with the code ("From User Email").

  POST /referrals/export { user_id?, search?, from_email?, date? }   (admin.referrals.export, super admin)
    -> an .xlsx body (Content-Disposition: attachment). Built and audited by the server;
       422 too_many_rows above ADMIN_EXPORT_ROW_CAP.
    Content-Disposition is not exposed through CORS, so the file is named here (exportFileName).
*/

const cleanFilters = ({ user_id, search, from_email, date } = {}) => ({
  user_id: user_id || undefined,
  search: search?.trim() || undefined,
  from_email: from_email?.trim() || undefined,
  date: date || undefined,
});

export const getAllReferrals = ({ page, page_size, ...filters }) =>
  api.get("referrals", { params: { page, page_size, ...cleanFilters(filters) } });

export const exportReferrals = (filters) =>
  api.post("referrals/export", cleanFilters(filters), { responseType: "blob" });

// GET /users/lookup?id=<id> -> res.data.data = { data: [{ id, label, email }], total_count }
// Shows the email of the "To User" filter after a page reload (only the id is in the URL).
export const getReferralsFilterUser = (id) =>
  api.get("users/lookup", { params: { id } });

export const exportFileName = (date = new Date()) =>
  `referrals-${dayjs(date).format("YYYY-MM-DD-HHmmss")}.xlsx`;

/*
  An error of a `responseType: "blob"` request carries its JSON body as a Blob.
  Returns { status, code, message } with the machine code (e.g. too_many_rows) and the API message.
*/
export const readExportError = async (error) => {
  const status = error?.response?.status ?? null;
  let data = error?.response?.data;
  if (data && typeof data.text === "function") {
    try {
      data = JSON.parse(await data.text());
    } catch {
      data = null;
    }
  }
  return {
    status,
    code: getApiErrorCode({ response: { data } }),
    message: data?.message || error?.message || null,
  };
};

export { getApiErrorCode };
