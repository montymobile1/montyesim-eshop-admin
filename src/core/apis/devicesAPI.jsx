import { api } from "./axios";

/*
  Devices (MS-5082, TEOS-116).
  GET /devices?page&page_size&user_id&platform=all|android|ios&logged_in=all|yes|no
              &sort=created_at|timestamp_login&dir=asc|desc
  -> res.data.data = { data: [device rows with user_email], total_count,
                       facets: { all, android, ios } }
  Rows never carry fcm_token or originated_ip (TEOS-115).
*/
export const getAllDevices = async (params) => {
  return await api.get(`devices`, { params });
};

// The user selected in the filter, to show its email after a reload (only the id is in the URL).
// GET /users/lookup?id=<id> -> res.data.data = { data: [{ id, label, email }], total_count }
export const getDevicesFilterUser = async (id) => {
  return await api.get(`users/lookup`, { params: { id } });
};

// The Devices tab of the user details page uses getUserDevices from usersAPI.jsx
// (GET /users/{id}/devices, MS-5080); the legacy getAllUserDevices was removed with it.
