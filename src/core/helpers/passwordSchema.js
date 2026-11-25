import * as yup from "yup";

/*
  TEOS-307: the rules of a new admin password, the same as the API's
  (app/schemas/admin/auth.py check_password_rules), so a password the API
  refuses never leaves the browser.
*/
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_BYTES = 72;

// The hint under the field; each rule has its own yup message too.
export const PASSWORD_RULES_TEXT = `At least ${PASSWORD_MIN_LENGTH} characters, with an upper-case letter, a lower-case letter, a digit and a symbol.`;

const byteLength = (value) => new TextEncoder().encode(value || "").length;

export const newPasswordSchema = () =>
  yup
    .string()
    .required("New password is required")
    .min(
      PASSWORD_MIN_LENGTH,
      `Password must be at least ${PASSWORD_MIN_LENGTH} characters`
    )
    .test(
      "password-max-bytes",
      "Password is too long",
      (value) => byteLength(value) <= PASSWORD_MAX_BYTES
    )
    .test(
      "password-no-outer-space",
      "Password must not start or end with a space",
      (value) => !value || value === value.trim()
    )
    .test(
      "password-upper",
      "Password must contain an upper-case letter",
      (value) => /\p{Lu}/u.test(value || "")
    )
    .test(
      "password-lower",
      "Password must contain a lower-case letter",
      (value) => /\p{Ll}/u.test(value || "")
    )
    .test(
      "password-digit",
      "Password must contain a digit",
      (value) => /\p{Nd}/u.test(value || "")
    )
    .test(
      "password-symbol",
      "Password must contain a symbol",
      (value) => /[^\p{L}\p{N}\s]/u.test(value || "")
    );

export const confirmPasswordSchema = (field = "new_password") =>
  yup
    .string()
    .required("Confirm the new password")
    .oneOf([yup.ref(field)], "Passwords do not match");
