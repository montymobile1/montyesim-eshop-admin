import { api } from "./axios";

export const login = async (payload) => {
  return await api.post(`auth/login`, payload);
};

export const refreshSession = async (payload) => {
  return await api.post(`auth/refresh`, payload);
};

export const logout = async () => {
  return await api.post(`auth/logout`);
};

export const getMe = async () => {
  return await api.get(`auth/me`);
};
