/*
  TEOS-230: the field errors of an admin API 422.

  The API sends them in developerMessage as "<field path>: <message>; <field path>: <message>"
  (app/api/v1/admin/_route.py _format_validation, and the services' "amount: ..." messages).
  Returns [{ field, message }] with field = the first segment of the path ("bundle_codes.0"
  -> "bundle_codes") and pydantic's "Value error, " prefix removed. A part without a field
  path is returned with field = null.
*/
export const apiFieldErrors = (error) => {
  if (error?.response?.status !== 422) return [];
  const text = error?.response?.data?.developerMessage;
  if (typeof text !== "string" || !text.trim()) return [];
  return text
    .split("; ")
    .map((part) => {
      const match = part.match(/^([A-Za-z_][\w.]*): (.+)$/s);
      if (!match) return { field: null, message: part.trim() };
      return {
        field: match[1].split(".")[0],
        message: match[2].replace(/^Value error, /, "").trim(),
      };
    })
    .filter((item) => item.message);
};
