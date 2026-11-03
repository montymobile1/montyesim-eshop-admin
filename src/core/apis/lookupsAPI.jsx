import { api } from "./axios";

/*
  Dropdown sources (MS-5077 / MS-5078).
  GET /<resource>/lookup?search&page&page_size
  -> res.data.data = { data: [{ id, label, ...extra }], total_count }
*/

export const getUsersLookup = async (params) => {
  return await api.get(`users/lookup`, { params });
};

export const getBundlesLookup = async (params) => {
  return await api.get(`bundles/lookup`, { params });
};

export const getGroupsLookup = async (params) => {
  return await api.get(`groups/lookup`, { params });
};

export const getTagsLookup = async (params) => {
  return await api.get(`tags/lookup`, { params });
};

export const getPromotionRulesLookup = async (params) => {
  return await api.get(`promotion-rules/lookup`, { params });
};
