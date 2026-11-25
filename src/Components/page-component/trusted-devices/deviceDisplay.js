import dayjs from "dayjs";
import { toast } from "react-toastify";
import { getApiErrorCode } from "../../../core/apis/axios";
import { deviceLabel } from "../../../core/helpers/deviceInfo";

/*
  TEOS-256: display helpers shared by Profile > Trusted devices and the Admins
  page's Devices dialog. A row is the API's AdminDeviceRow (trustedDevicesAPI.jsx).
*/

export const DEVICE_QUERY_KEYS = {
  mine: ["trusted-devices", "me"],
  admin: (adminId) => ["trusted-devices", "admin", adminId],
};

export const DEVICE_NAME_MAX = 60;

export const formatDeviceDate = (value) =>
  value ? dayjs(value).format("DD-MM-YYYY HH:mm") : "N/A";

// the admin's own name for the device, else "Chrome on Windows"
export const deviceTitle = (row) => row?.name?.trim() || deviceLabel(row);

const withVersion = (name, version) =>
  name ? [name, version].filter(Boolean).join(" ") : "N/A";

export const deviceBrowser = (row) => withVersion(row?.browser, row?.browser_version);
export const deviceOs = (row) => withVersion(row?.os, row?.os_version);

// the API's `trusted` flag wins; without it, trusted_until still in the future
export const isTrusted = (row) => {
  if (!row?.trusted_until) return false;
  if (typeof row?.trusted === "boolean") return row.trusted;
  return dayjs(row.trusted_until).isAfter(dayjs());
};

// the Status chip
export const trustText = (row) => (isTrusted(row) ? "Trusted" : "Not trusted");

// the Expires column: when the trust ends, with the hour; none for an untrusted device
export const trustExpiry = (row) =>
  isTrusted(row) ? formatDeviceDate(row.trusted_until) : "N/A";

// "spaces collapsed" like the API does, so the length check matches the server
export const cleanDeviceName = (value = "") => value.replace(/\s+/g, " ").trim();

export const DEVICE_NOT_FOUND_MESSAGE =
  "This device was already signed out. The list was refreshed.";

/*
  Errors of a device action (rename / revoke). 404 device_not_found: the row is
  gone already, so the list is refreshed. Anything else: the API's message.
  Returns true when the dialog should close.
*/
export const handleDeviceActionError = (error, fallback, refresh) => {
  const status = error?.response?.status;
  if (status === 404 && getApiErrorCode(error) === "device_not_found") {
    toast.info(DEVICE_NOT_FOUND_MESSAGE);
    refresh?.();
    return true;
  }
  toast.error(error?.message || fallback);
  return status === 403;
};
