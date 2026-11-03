import * as yup from "yup";

export const REASON_MIN = 3;
export const REASON_MAX = 500;

/*
  The audit reason of a ban, unban or bundle status change: 3 to 500 characters
  once the spaces around it are removed, as the API requires (TEOS-148, TEOS-166).
  Checked here so an invalid reason never reaches the API.
  `required: false` (bulk activation): empty is allowed, anything typed must still
  be 3 to 500 characters.
*/
export const reasonSchema = ({ required = true } = {}) =>
  yup
    .string()
    .label("Reason")
    .nullable()
    .test("reason-required", "Reason is required", (value) =>
      required ? (value || "").trim().length > 0 : true
    )
    .test(
      "reason-min",
      `Reason must be at least ${REASON_MIN} characters`,
      (value) => {
        const length = (value || "").trim().length;
        return length === 0 || length >= REASON_MIN;
      }
    )
    .test(
      "reason-max",
      `Reason must be at most ${REASON_MAX} characters`,
      (value) => (value || "").trim().length <= REASON_MAX
    );
