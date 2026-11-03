import { api } from "./axios";

// GET /banners?search&status&page&page_size
// res.data.data = { data: [...], total_count, facets: { all, active, inactive } }
export const getAllBanners = (params) => api.get("banners", { params });

// GET /banners/{id} -> res.data.data = { id, title, description, image_url, action, platform, is_active }
export const getBannerById = (id) => api.get(`banners/${id}`);

/*
  The banner and its image are saved in one multipart request; the API
  uploads the image, saves the row and removes replaced files itself.
  `image` is sent only when it is a newly chosen File (optional on edit).
*/
const toBannerFormData = ({ title, description, platform, action, image }) => {
  const form = new FormData();
  form.append("title", title ?? "");
  form.append("description", description ?? "");
  form.append("platform", platform ?? "");
  if (action) form.append("action", action);
  if (image instanceof Blob) form.append("image", image);
  return form;
};

// The shared instance defaults to JSON, which would turn FormData into JSON.
const MULTIPART = { headers: { "Content-Type": "multipart/form-data" } };

// Optional axios upload progress callback (the save progress bar, MS-5061).
const multipartConfig = (onUploadProgress) =>
  onUploadProgress ? { ...MULTIPART, onUploadProgress } : MULTIPART;

// POST /banners (multipart) -> 201; 409 duplicate_title; 413 image too large
export const AddBanner = (payload, onUploadProgress) =>
  api.post(
    "banners",
    toBannerFormData(payload),
    multipartConfig(onUploadProgress),
  );

// PUT /banners/{id} (multipart, image optional, title editable) -> 200; 404; 409 duplicate_title; 413
export const editBanner = ({ id, ...payload }, onUploadProgress) =>
  api.put(
    `banners/${id}`,
    toBannerFormData(payload),
    multipartConfig(onUploadProgress),
  );

// DELETE /banners/{id} -> 204 (the API also removes the image file)
export const deleteBanner = (id) => api.delete(`banners/${id}`);

// Shared helper, defined once in ./axios (kept here so existing imports keep working).
export { getApiErrorCode } from "./axios";
