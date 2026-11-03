// Image upload rules of the admin API (media_storage_service.py: PNG, JPEG or WebP, ADMIN_MAX_UPLOAD_BYTES
// = 1 MB). The browser checks them first for fast feedback; the API still has the final say (413 / 422).
export const MAX_UPLOAD_BYTES = 1024 * 1024;
export const MAX_UPLOAD_LABEL = "1 MB";

// react-dropzone `accept` shape
export const UPLOAD_IMAGE_TYPES = {
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
};

// At most this many icon files in one group create or edit (API: 413 above, TEOS-187).
export const MAX_GROUP_ICON_FILES = 200;

// At most this many tags in one group (API: MAX_TAGS in app/schemas/admin/groups.py, 422 above).
export const MAX_GROUP_TAGS = 500;

// Whole multipart body of a group create or edit (API: 413 "request body too large" above, TEOS-188).
// Mirrors the API default ADMIN_MAX_GROUP_FORM_BYTES (50 MB, TEOS-188).
export const MAX_GROUP_FORM_BYTES = 50 * 1024 * 1024;
export const MAX_GROUP_FORM_LABEL = "50 MB";
// Room kept for the JSON payload and the multipart headers of each file.
export const GROUP_FORM_MARGIN_BYTES = 64 * 1024;
