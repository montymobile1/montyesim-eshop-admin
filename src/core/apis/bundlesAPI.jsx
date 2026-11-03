import { api } from "./axios";

/*
  Bundles page and "assign bundle to groups" page on the admin API (MS-5084).
  The API audits every write and rotates APP_CACHE_KEY itself, so nothing here
  writes audit rows, reads the client IP or touches app_config any more.
*/

// Arrays go as repeated keys (tag_ids=a&tag_ids=b); the API answers 422 to tag_ids[].
const REPEATED_KEYS = { paramsSerializer: { indexes: null } };

// GET /bundles?search&tag_ids&status=all|active|inactive&page&page_size
// res.data.data = { data: [...], total_count, facets: {all, active, inactive}, totals: {total, active_count, inactive_count} }
export const getAllBundles = (params) =>
  api.get("bundles", { params, ...REPEATED_KEYS });

// GET /bundles/{id} -> bundle + tags: [{ bundle_tag_id, tag: { id, name, icon, group: {...} } }]
export const getBundleById = (bundleId) => api.get(`bundles/${bundleId}`);

// PATCH /bundles/{id} { bundle_name } -> { id, bundle_name }; 409 no_change
export const updateBundleTitle = ({ id, bundle_name }) =>
  api.patch(`bundles/${id}`, { bundle_name });

const statusBody = ({ is_active, reason }) =>
  reason?.trim() ? { is_active, reason: reason.trim() } : { is_active };

// PATCH /bundles/{id}/status { is_active, reason } -> { id, is_active }; 409 no_change
export const toggleBundleStatus = ({ id, is_active, reason }) =>
  api.patch(`bundles/${id}/status`, statusBody({ is_active, reason }));

// POST /bundles/status/bulk { is_active, reason } -> { rows_affected, affected_bundle_ids }; 409 no_change
export const bulkBundleStatus = ({ is_active, reason }) =>
  api.post("bundles/status/bulk", statusBody({ is_active, reason }));

// PUT /bundles/{id}/tags { tag_ids } -> { id, tag_ids }; [] clears every tag (MS-5065); 422 unknown tag;
// 422 developerMessage {"code":"inactive_group_tag","tag_ids":[...]} for a newly added tag of an inactive group (TEOS-168)
export const assignTagsToBundle = (bundleId, tagIds) =>
  api.put(`bundles/${bundleId}/tags`, { tag_ids: tagIds });

// GET /groups/{id}/tags -> the tags of one group (assign page sections)
export const getGroupTags = (groupId) => api.get(`groups/${groupId}/tags`);

// Shared helpers, defined once in ./axios.
export { getApiErrorCode, getApiErrorDetails } from "./axios";
