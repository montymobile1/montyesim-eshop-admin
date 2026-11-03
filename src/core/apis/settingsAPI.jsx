import { api } from "./axios";

/*
  Settings (MS-5092, TEOS-135) and settings history (MS-5047) on the admin API.
  Super admin only (admin.settings.read / admin.settings.write).

  GET /settings?search&key&page&page_size   (search: part of the key; key: exact)
    -> res.data.data = { data: [{ id, key, value, description, created_at,
         is_secret, editable, deletable }], total_count }
    Secret-shaped keys are never returned (TEOS-134). page_size <= 100.
  PUT /settings { items: [{ key, value }], deleted_keys: [] }   (at most 100 keys)
    -> res.data.data = { updated: [keys], deleted: [keys], cache_key_rotated }
    409 developerMessage {"code":"no_change"}; 409 {"code":"protected_key","key","keys"}
    422 developerMessage "items.<i>.key: ..." / "items.<i>.value: invalid_value, ..."
    The audit row and the APP_CACHE_KEY rotation are done by the server.
  GET /settings/history?key&changed_by&from&to&page&page_size
    -> res.data.data = { data: [{ id, changed_at, changed_by: {id,email}|null, ip_address,
         client_reported, reason, operation, changes: [{ key, old_value, new_value, redacted }],
         parse_error }], total_count }
  GET /settings/history/{id} -> one row of the same shape
*/
export const getAllSettings = async (params) => {
  return await api.get(`settings`, { params });
};

export const updateSettings = async (payload) => {
  return await api.put(`settings`, payload);
};

export const getSettingsHistory = async (params) => {
  return await api.get(`settings/history`, { params });
};

export const getSettingsHistoryById = async (id) => {
  return await api.get(`settings/history/${id}`);
};
