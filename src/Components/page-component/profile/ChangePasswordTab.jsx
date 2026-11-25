import { yupResolver } from "@hookform/resolvers/yup";
import { Alert, Button, CircularProgress, Typography } from "@mui/material";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useDispatch } from "react-redux";
import { toast } from "react-toastify";
import * as yup from "yup";
import { FormPassword } from "../../form-component/FormComponent";
import { changePassword } from "../../../core/apis/authAPI";
import { getApiErrorCode } from "../../../core/apis/axios";
import { apiFieldErrors } from "../../../core/helpers/apiFieldErrors";
import {
  confirmPasswordSchema,
  newPasswordSchema,
  PASSWORD_RULES_TEXT,
} from "../../../core/helpers/passwordSchema";
import { TokensRefreshed } from "../../../Redux/reducers/AuthReducer";

const schema = yup.object({
  current_password: yup.string().required("Current password is required"),
  new_password: newPasswordSchema().test(
    "differs-from-current",
    "The new password must be different from the current one",
    (value, context) => !value || value !== context.parent.current_password
  ),
  confirm_password: confirmPasswordSchema("new_password"),
});

const EMPTY = { current_password: "", new_password: "", confirm_password: "" };

const FIELDS = [
  {
    name: "current_password",
    label: "Current password",
    placeholder: "Enter your current password",
  },
  {
    name: "new_password",
    label: "New password",
    placeholder: "Enter a new password",
    hint: PASSWORD_RULES_TEXT,
  },
  {
    name: "confirm_password",
    label: "Confirm new password",
    placeholder: "Enter the new password again",
  },
];

/*
  TEOS-307: the signed-in admin's own password change (Profile > Change password).
  The API answers with a new session: every other session of the account (other
  browsers, and this tab's old one) is signed out, so the tokens are replaced at once.
*/
const ChangePasswordTab = () => {
  const dispatch = useDispatch();
  const [submitting, setSubmitting] = useState(false);

  const { control, handleSubmit, reset, setError } = useForm({
    defaultValues: EMPTY,
    resolver: yupResolver(schema),
    mode: "all",
  });

  const onSubmit = (values) => {
    if (submitting) return;
    setSubmitting(true);
    changePassword({
      current_password: values.current_password,
      new_password: values.new_password,
    })
      .then((res) => {
        const session = res?.data?.data;
        if (session?.access_token) dispatch(TokensRefreshed(session));
        reset(EMPTY);
        if (session?.other_sessions_signed_out === false) {
          toast.warn(
            "Your password was changed, but your other admin portal sessions could not be signed out. They end when their access expires."
          );
        } else {
          toast.success(
            "Your password was changed. You were signed out of the admin portal on every other device."
          );
        }
      })
      .catch((error) => {
        const status = error?.response?.status;
        const code =
          getApiErrorCode(error) || error?.response?.data?.developerMessage;
        if (code === "current_password_invalid") {
          setError("current_password", { type: "server", message: error.message });
          return;
        }
        if (status === 422) {
          const fields = apiFieldErrors(error).filter((item) =>
            Object.keys(EMPTY).includes(item.field)
          );
          if (fields.length) {
            fields.forEach((item) =>
              setError(item.field, { type: "server", message: item.message })
            );
            return;
          }
          // same_password / weak_password: the API's message, under the field
          setError("new_password", { type: "server", message: error.message });
          return;
        }
        toast.error(error?.message || "Failed to change the password");
      })
      .finally(() => setSubmitting(false));
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      aria-label="Change password"
    >
      <Alert severity="info">
        Changing your password signs you out on every other device and browser.
      </Alert>
      <div className="flex flex-col gap-4">
        {FIELDS.map(({ name, label, placeholder, hint }) => (
          <div key={name} className="flex flex-col gap-1.5">
            <Typography component="label" variant="body2" fontWeight={600}>
              {label}
            </Typography>
            <Controller
              name={name}
              control={control}
              render={({ field: { onChange, value }, fieldState: { error } }) => (
                <FormPassword
                  placeholder={placeholder}
                  value={value}
                  helperText={error?.message}
                  onChange={onChange}
                />
              )}
            />
            {/* the rules stay visible in grey; a broken rule shows in red above them */}
            {hint && (
              <Typography variant="caption" color="text.secondary">
                {hint}
              </Typography>
            )}
          </div>
        ))}
      </div>
      <div className="flex flex-row justify-end">
        <Button
          type="submit"
          variant="contained"
          color="primary"
          disabled={submitting}
          startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : null}
        >
          {submitting ? "Saving..." : "Change password"}
        </Button>
      </div>
    </form>
  );
};

export default ChangePasswordTab;
