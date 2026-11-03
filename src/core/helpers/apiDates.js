import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);

// The admin API returns timestamps in UTC without an offset ("2026-11-09T22:00:00").
// dayjs() would read those as local time, so they are parsed as UTC and shown in local time.
// Values that already carry "Z" or an offset are parsed as they are.
const HAS_OFFSET = /(Z|[+-]\d{2}:?\d{2})$/i;

export const apiDateToLocal = (value) => {
  if (!value) return null;
  const text = String(value);
  return HAS_OFFSET.test(text) ? dayjs(text) : dayjs.utc(text).local();
};

// Local calendar day ("YYYY-MM-DD") of an API timestamp, or null.
export const apiDateToLocalDay = (value) =>
  apiDateToLocal(value)?.format("YYYY-MM-DD") ?? null;

// "DD-MM-YYYY" in local time, or "N/A".
export const formatApiDate = (value, format = "DD-MM-YYYY") =>
  apiDateToLocal(value)?.format(format) ?? "N/A";

// TEOS-274 / TEOS-275: a real calendar day "YYYY-MM-DD" (e.g. from the URL). dayjs rolls an impossible
// date over ("2026-13-01" -> 2027-01-01, "2026-02-30" -> 2 March) and the date pickers crash on it,
// so the value must also format back to exactly the same text.
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const isCalendarDay = (value) =>
  typeof value === "string" &&
  DAY_PATTERN.test(value) &&
  dayjs(value).format("YYYY-MM-DD") === value;
