import { api } from "./axios";

/*
  Groups (tag groups) on the admin API (MS-5086).
  The API uploads the tag icons, builds the region / country data, checks the
  names, audits every write and rotates APP_CACHE_KEY itself; the browser
  never talks to storage or to app_config any more.
*/

// GET /groups?search&status=all|active|inactive&page&page_size
// res.data.data = { data: [{ ...group, tag_count }], total_count, facets: { all, active, inactive } }
export const getAllGroups = (params) => api.get("groups", { params });

// GET /groups/{id}?tag_search
// res.data.data = { ...group, tags: [{ id, name, icon, sorting_number, data }], top_countries_count }
export const getGroupById = (id, tag_search) =>
  api.get(`groups/${id}`, { params: tag_search ? { tag_search } : undefined });

// GET /groups/{id}/tags -> res.data.data = { data: [tags], total_count }
export const getGroupTags = (id) => api.get(`groups/${id}/tags`);

/*
  One multipart request: `payload` (JSON) + one file per icon.
  Create:  payload = { name, type, group_category, tags: [{ client_key, name, alternative_country }] }
           files   = icon_<client_key> for the tags with a newly chosen icon
  Edit:    payload = { name, type, group_category, new_tags: [...], updated_tags: [{ id, name,
                       remove_icon, alternative_country }], deleted_tag_ids: [] }
           files   = icon_<client_key> (new tags) and icon_<tag id> (existing tags), only when
                     the icon is a newly chosen Blob.
*/
const toKeywords = (value) =>
  Array.isArray(value)
    ? value.map((keyword) => `${keyword}`.trim()).filter(Boolean)
    : typeof value === "string"
      ? value.split(",").map((keyword) => keyword.trim()).filter(Boolean)
      : [];

export const toGroupFormData = ({ group, tags = [], deletedTags = [] }, isEdit) => {
  const form = new FormData();
  const newTags = [];
  const updatedTags = [];

  tags.forEach((tag, index) => {
    const key = tag?.id || `n${index}`;
    const hasNewIcon = tag?.icon instanceof Blob;
    if (hasNewIcon) form.append(`icon_${key}`, tag.icon, `${key}.png`);

    if (tag?.id) {
      updatedTags.push({
        id: tag.id,
        name: tag?.name,
        remove_icon: !hasNewIcon && !tag?.icon,
        alternative_country: toKeywords(tag?.alternative_country),
      });
    } else {
      newTags.push({
        client_key: key,
        name: tag?.name,
        alternative_country: toKeywords(tag?.alternative_country),
      });
    }
  });

  const payload = {
    name: group?.name,
    type: group?.type,
    group_category: group?.group_category,
    ...(isEdit
      ? {
          new_tags: newTags,
          updated_tags: updatedTags,
          deleted_tag_ids: deletedTags.map((tag) => tag?.id).filter(Boolean),
        }
      : { tags: newTags }),
  };
  form.append("payload", JSON.stringify(payload));
  return form;
};

// The shared instance defaults to JSON, which would turn FormData into JSON.
const MULTIPART = { headers: { "Content-Type": "multipart/form-data" } };

// Optional axios upload progress callback (the save progress bar, MS-5086 case 16).
const multipartConfig = (onUploadProgress) =>
  onUploadProgress ? { ...MULTIPART, onUploadProgress } : MULTIPART;

// POST /groups (multipart) -> 201; 409 duplicate_group_name | duplicate_tag_name; 413 icon too large
export const addGroup = (payload, onUploadProgress) =>
  api.post(
    "groups",
    toGroupFormData(payload, false),
    multipartConfig(onUploadProgress),
  );

// PUT /groups/{id} (multipart) -> 200; 404; 409 duplicate_* | linked_bundles (deleting a tag in use)
export const editGroup = ({ id, ...payload }, onUploadProgress) =>
  api.put(
    `groups/${id}`,
    toGroupFormData(payload, true),
    multipartConfig(onUploadProgress),
  );

// DELETE /groups/{id} -> 204; 409 {"code":"linked_bundles","bundle_count":n}
export const deleteGroup = (id) => api.delete(`groups/${id}`);

// PATCH /groups/{id}/status { is_active } -> 409 no_change when already in that state
export const toggleGroupStatus = ({ id, is_active }) =>
  api.patch(`groups/${id}/status`, { is_active });

// PUT /groups/{id}/tags/order { tag_ids } (every tag of the group, in order) -> { tag_ids }
export const updateTagGroupsOrder = ({ id, tag_ids }) =>
  api.put(`groups/${id}/tags/order`, { tag_ids });

// Shared helpers, defined once in ./axios (kept here so existing imports keep working).
export { getApiErrorCode, getApiErrorDetails } from "./axios";
