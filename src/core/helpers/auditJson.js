import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);

/*
  Display helpers for audit data that the admin API already parsed and redacted
  (MS-5047, MS-5049). Nothing here parses JSON: the server sends objects.
*/
export const REDACTED = "***";
export const HIDDEN_LABEL = "hidden";

// Value of one setting change: "hidden" for a redacted value, "-" for none.
export const displayValue = (value, redacted = false) => {
  if (redacted || value === REDACTED) return HIDDEN_LABEL;
  if (value === null || value === undefined) return "-";
  return typeof value === "string" ? value : JSON.stringify(value);
};

// Pretty JSON for the audit detail; redacted values read "hidden".
export const prettyJson = (value) => {
  if (value === null || value === undefined) return "N/A";
  if (typeof value === "string") return value === REDACTED ? HIDDEN_LABEL : value;
  return JSON.stringify(
    value,
    (key, item) => (item === REDACTED ? HIDDEN_LABEL : item),
    2
  );
};

// Machine code of a 409 (developerMessage is a JSON string {"code": ...}).
export const conflictCode = (error) => {
  const raw = error?.response?.data?.developerMessage;
  if (!raw || typeof raw !== "string") return null;
  const match = raw.match(/"code"\s*:\s*"([^"]+)"/);
  return match ? match[1] : null;
};

/*
  The "Changed by" email. TEOS-341: an admin without an email shows "N/A" (never the
  id); "Deleted user" when the API has no admin for the row (older rows of a deleted
  account). An admin no longer found gets the email saved with the row (no mark).
*/
export const actorLabel = (changedBy) => {
  if (!changedBy) return "Deleted user";
  return changedBy.email || "N/A";
};

/*
  changed_at is a UTC timestamp without zone: shown in the local time zone.
*/
export const formatAuditDate = (value) =>
  value ? dayjs.utc(value).local().format("DD-MM-YYYY HH:mm") : "N/A";
