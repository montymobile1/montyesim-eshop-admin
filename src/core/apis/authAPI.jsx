import { api } from "./axios";

// TEOS-256: payload = { email, password, device: collectDevice() }.
// res.data.data.status: "signed_in" (a session, trusted device) or
// "verification_required" ({ verification_id, destination, code_length,
// expires_in, resend_available_in, resends_left }: a code was emailed).
export const login = async (payload) => {
  return await api.post(`auth/login`, payload);
};

// TEOS-256: payload = { refresh_token, device: collectDevice() }
export const refreshSession = async (payload) => {
  return await api.post(`auth/refresh`, payload);
};

// TEOS-256: payload = { verification_id, code, trust_device, device_name?, device }
// -> a session (status "signed_in", device_id)
export const verifyDevice = async (payload) => {
  return await api.post(`auth/verify-device`, payload);
};

// TEOS-256: payload = { verification_id } -> { expires_in, resend_available_in, resends_left }
export const resendDeviceCode = async (payload) => {
  return await api.post(`auth/resend-code`, payload);
};

export const logout = async () => {
  return await api.post(`auth/logout`);
};

export const getMe = async () => {
  return await api.get(`auth/me`);
};

// TEOS-307: the signed-in admin's own password. The answer is a NEW session
// (every other session of the account, this tab's old one included, is signed out).
export const changePassword = async (payload) => {
  return await api.post(`auth/change-password`, payload);
};

// TEOS-307: the reset email link's page. access_token = the link's session.
export const resetPassword = async (payload) => {
  return await api.post(`auth/reset-password`, payload);
};
