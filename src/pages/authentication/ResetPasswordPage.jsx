import { yupResolver } from "@hookform/resolvers/yup";
import { LockReset } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import * as yup from "yup";
import { FormPassword } from "../../Components/form-component/FormComponent";
import { resetPassword } from "../../core/apis/authAPI";
import { queryClient } from "../../core/apis/ReactQueryInstance";
import { apiFieldErrors } from "../../core/helpers/apiFieldErrors";
import {
  confirmPasswordSchema,
  newPasswordSchema,
  PASSWORD_RULES_TEXT,
} from "../../core/helpers/passwordSchema";
import { SignOut } from "../../Redux/reducers/AuthReducer";

export const INVALID_LINK_MESSAGE =
  "This reset link is invalid or has expired. Ask a super admin to send a new one.";

const schema = yup.object({
  new_password: newPasswordSchema(),
  confirm_password: confirmPasswordSchema("new_password"),
});

/*
  The reset email links straight here: /reset-password#token=<recovery token>.
  Opening the page uses nothing up: the API checks the token only when the new
  password is sent, so a mail scanner opening the link first does no harm.
  Read once, then the fragment is removed from the address bar and the history.
*/
export const readResetLink = (location = window.location) => {
  const hash = new URLSearchParams((location.hash || "").replace(/^#/, ""));
  const query = new URLSearchParams(location.search || "");
  const failed = hash.get("error") || query.get("error");
  const token = hash.get("token");
  if (failed || !token) return { token: null };
  return { token };
};

/*
  TEOS-307: last step of a password reset sent from the Admins page. The new
  password is sent with the link's token; the API then signs out every admin portal session of
  the account, so the admin signs in again with the new password.
*/
const ResetPasswordPage = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const isAuthenticated = useSelector(
    (state) => state.authentication?.isAuthenticated
  );
  const [link] = useState(() => readResetLink());
  const [linkError, setLinkError] = useState(
    link.token ? null : INVALID_LINK_MESSAGE
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // the token must not stay in the address bar or the history
    if (window.location.hash || window.location.search) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  const { control, handleSubmit, setError } = useForm({
    defaultValues: { new_password: "", confirm_password: "" },
    resolver: yupResolver(schema),
    mode: "all",
  });

  const onSubmit = (values) => {
    if (submitting || !link.token) return;
    setSubmitting(true);
    resetPassword({ token: link.token, new_password: values.new_password })
      .then(() => {
        // every admin portal session of the account was signed out, this browser's included
        if (isAuthenticated) {
          dispatch(SignOut());
          queryClient.clear();
        }
        navigate("/signin?reason=password_reset", { replace: true });
      })
      .catch((error) => {
        const status = error?.response?.status;
        if (status === 400) {
          setLinkError(error?.message || INVALID_LINK_MESSAGE);
          return;
        }
        if (status === 422) {
          const fields = apiFieldErrors(error).filter((item) =>
            ["new_password", "confirm_password"].includes(item.field)
          );
          if (fields.length) {
            fields.forEach((item) =>
              setError(item.field, { type: "server", message: item.message })
            );
          } else {
            setError("new_password", { type: "server", message: error.message });
          }
          return;
        }
        toast.error(error?.message || "Failed to reset the password");
      })
      .finally(() => setSubmitting(false));
  };

  return (
    <Box className="flex items-center justify-center min-h-[calc(100vh-180px)] px-4">
      <Card
        elevation={0}
        sx={{
          width: "100%",
          maxWidth: 460,
          border: `1px solid ${theme.palette.divider}`,
        }}
      >
        <CardContent
          className="flex flex-col gap-6"
          sx={{ p: { xs: 3, sm: 5 }, "&:last-child": { pb: { xs: 3, sm: 5 } } }}
        >
          <div className="flex flex-col items-center gap-3 text-center">
            <Box
              className="flex items-center justify-center w-14 h-14 rounded-2xl"
              sx={{
                backgroundColor: alpha(theme.palette.primary.main, 0.08),
                color: theme.palette.primary.main,
              }}
            >
              <LockReset fontSize="medium" />
            </Box>
            <Typography variant="h5" component="h1" fontWeight={700}>
              Set a new password
            </Typography>
          </div>

          {linkError ? (
            <>
              <Alert severity="error" data-testid="reset-link-error">
                {linkError}
              </Alert>
              <Button variant="contained" onClick={() => navigate("/signin")}>
                Back to sign in
              </Button>
            </>
          ) : (
            <form
              className="flex flex-col gap-4"
              onSubmit={handleSubmit(onSubmit)}
              noValidate
            >
              {["new_password", "confirm_password"].map((name) => (
                <div className="flex flex-col gap-1.5" key={name}>
                  <Typography component="label" variant="body2" fontWeight={600}>
                    {name === "new_password" ? "New password" : "Confirm new password"}
                  </Typography>
                  <Controller
                    name={name}
                    control={control}
                    render={({ field: { onChange, value }, fieldState: { error } }) => (
                      <FormPassword
                        placeholder={
                          name === "new_password"
                            ? "Enter a new password"
                            : "Enter the new password again"
                        }
                        value={value}
                        helperText={error?.message}
                        onChange={onChange}
                      />
                    )}
                  />
                  {/* the rules stay visible in grey; a broken rule shows in red above them */}
                  {name === "new_password" && (
                    <Typography variant="caption" color="text.secondary">
                      {PASSWORD_RULES_TEXT}
                    </Typography>
                  )}
                </div>
              ))}
              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={submitting}
                startIcon={
                  submitting ? <CircularProgress size={18} color="inherit" /> : null
                }
              >
                {submitting ? "Saving..." : "Set new password"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default ResetPasswordPage;
