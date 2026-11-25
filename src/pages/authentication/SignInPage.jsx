import { yupResolver } from "@hookform/resolvers/yup";
import { LockOutlined, MailOutline } from "@mui/icons-material";
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
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import * as Yup from "yup";
import {
  FormInput,
  FormPassword,
} from "../../Components/form-component/FormComponent";
import DeviceCodeStep, {
  CODE_STEP_MESSAGES,
} from "../../Components/page-component/sign-in/DeviceCodeStep";
import { login } from "../../core/apis/authAPI";
import { getApiErrorCode, SIGN_OUT_REASONS } from "../../core/apis/axios";
import { collectDevice } from "../../core/helpers/deviceInfo";
import { ClearSignOutReason, SignIn } from "../../Redux/reducers/AuthReducer";

const validationSchema = Yup.object({
  // Format checked before the API call, so a typo gets a field error instead of a 422 toast (TEOS-146)
  email: Yup.string()
    .trim()
    .email("Enter a valid email address")
    .required("Email is required"),
  password: Yup.string().required("Password is required"),
});

// Only same-app paths are allowed as ?next= targets
const getNextPath = (next) =>
  next && next.startsWith("/") && !next.startsWith("//") ? next : "/users";

export default function SignInPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch();
  // TEOS-256: step 2 (email code) when the API does not trust this device yet
  const [verification, setVerification] = useState(null);
  const [verificationNotice, setVerificationNotice] = useState(null);
  // why the code step sent the admin back here (too many attempts, closed code...)
  const [stepMessage, setStepMessage] = useState(null);

  const { control, handleSubmit, reset } = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    resolver: yupResolver(validationSchema),
    mode: "all",
  });

  // TEOS-145: why the previous session ended (set by the axios interceptor).
  const reasonKey = searchParams.get("reason");
  const signOutReason = SIGN_OUT_REASONS[reasonKey];

  // TEOS-145: the reason is now in the URL, so the stored one is no longer needed
  const storedReason = useSelector(
    (state) => state.authentication?.signOutReason,
  );
  useEffect(() => {
    if (storedReason) dispatch(ClearSignOutReason());
  }, [storedReason]);

  // The message goes away once the admin starts typing the email; ?next= is kept.
  const dismissSignOutReason = () => {
    if (!searchParams.has("reason")) return;
    const params = new URLSearchParams(searchParams);
    params.delete("reason");
    setSearchParams(params, { replace: true });
  };

  const completeSignIn = (session) => {
    dispatch(SignIn(session));
    navigate(getNextPath(searchParams.get("next")), { replace: true });
  };

  // notice: shown on the code step (a new code after an expired one)
  const submitLogin = async (payload, notice = null) => {
    setLoading(true);
    setStepMessage(null);

    await login({
      email: payload.email?.trim(),
      password: payload.password?.trim(),
      device: collectDevice(),
    })
      .then((res) => {
        const data = res?.data?.data;
        if (data?.status === "verification_required" && data?.verification_id) {
          setVerificationNotice(notice);
          setVerification(data);
        } else if (res?.data?.status === "success" && data?.access_token) {
          completeSignIn(data);
        } else {
          toast.error(res?.data?.message || "Failed to Sign in");
        }
      })
      .catch((e) => {
        const code = getApiErrorCode(e);
        if (code === "email_not_configured") {
          // no SMTP on this client: only trusted browsers can sign in
          toast.error(CODE_STEP_MESSAGES.emailNotConfigured);
        } else if (code === "email_unavailable" || e?.response?.status === 503) {
          // TEOS-256 case 23: the code could not be emailed
          toast.error(CODE_STEP_MESSAGES.emailUnavailable);
        } else if (code === "code_limit") {
          toast.error(
            e?.response?.data?.message || CODE_STEP_MESSAGES.codeLimit,
          );
        } else {
          toast.error(e?.message || "Failed to Sign in");
        }
        // a failed new-code request leaves the expired code step
        if (notice) {
          setVerification(null);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const handleSubmitForm = (payload) => submitLogin(payload);

  // Back to step 1: with a reason (code step error) or none ("Use another account")
  const leaveCodeStep = (message) => {
    setVerification(null);
    setVerificationNotice(null);
    if (message) {
      setStepMessage(message);
    } else {
      setStepMessage(null);
      reset({ email: "", password: "" });
    }
  };

  return (
    // "safe" centring: margin auto centres the card when it fits, and when it is taller
    // than the space (the code step) it starts at the top instead of being cut off
    <Box className="flex min-h-[calc(100vh-180px)] px-4 py-6">
      <Card
        elevation={0}
        sx={{
          m: "auto",
          width: "100%",
          maxWidth: 420,
          border: `1px solid ${theme.palette.divider}`,
          boxShadow: `0 20px 45px -20px ${alpha(
            theme.palette.primary.main,
            0.25,
          )}`,
        }}
      >
        <CardContent
          className="flex flex-col gap-6"
          sx={{ p: { xs: 3, sm: 5 }, "&:last-child": { pb: "10px" } }}
        >
          {verification ? (
            <DeviceCodeStep
              key={verification.verification_id}
              verification={verification}
              notice={verificationNotice}
              onSignedIn={completeSignIn}
              onBack={leaveCodeStep}
            />
          ) : (
            <>
              <div className="flex flex-col items-center gap-3 text-center">
                <Box
                  className="flex items-center justify-center w-14 h-14 rounded-2xl"
                  sx={{
                    backgroundColor: alpha(theme.palette.primary.main, 0.08),
                    color: theme.palette.primary.main,
                  }}
                >
                  <LockOutlined fontSize="medium" />
                </Box>
                <div className="flex flex-col gap-1">
                  <Typography variant="h5" component="h1" fontWeight={700}>
                    Welcome back
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Sign in to continue to your dashboard
                  </Typography>
                </div>
              </div>

              {signOutReason && (
                <Alert
                  severity={
                    reasonKey === "password_reset" ? "success" : "warning"
                  }
                  data-testid="sign-out-reason"
                >
                  {signOutReason}
                </Alert>
              )}

              {stepMessage && (
                <Alert severity="error" data-testid="sign-in-step-message">
                  {stepMessage}
                </Alert>
              )}

              <form
                className="flex flex-col gap-5"
                onSubmit={handleSubmit(handleSubmitForm)}
                noValidate
              >
                <div className="flex flex-col gap-1.5">
                  <Typography
                    component="label"
                    htmlFor="email"
                    variant="body2"
                    fontWeight={600}
                  >
                    Email
                  </Typography>
                  <Controller
                    render={({
                      field: { onChange, value },
                      fieldState: { error },
                    }) => (
                      <FormInput
                        placeholder={"you@example.com"}
                        value={value}
                        helperText={error?.message}
                        onChange={(value) => {
                          onChange(value);
                          dismissSignOutReason();
                        }}
                        startAdornment={
                          <MailOutline
                            fontSize="small"
                            sx={{ color: "text.secondary" }}
                          />
                        }
                      />
                    )}
                    name="email"
                    control={control}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Typography
                    component="label"
                    htmlFor="password"
                    variant="body2"
                    fontWeight={600}
                  >
                    Password
                  </Typography>
                  <Controller
                    render={({
                      field: { onChange, value },
                      fieldState: { error },
                    }) => (
                      <FormPassword
                        placeholder={"Enter your password"}
                        value={value}
                        helperText={error?.message}
                        onChange={(value) => onChange(value)}
                        startAdornment={
                          <LockOutlined
                            fontSize="small"
                            sx={{ color: "text.secondary" }}
                          />
                        }
                      />
                    )}
                    name="password"
                    control={control}
                  />
                </div>
                <Button
                  variant={"contained"}
                  color="primary"
                  type="submit"
                  size="large"
                  fullWidth
                  disabled={loading}
                  aria-label="Sign In"
                  startIcon={
                    loading ? (
                      <CircularProgress size={18} color="inherit" />
                    ) : null
                  }
                  sx={{
                    mt: 1,
                    py: 1.25,
                    "&:hover": {
                      backgroundColor: theme.palette.primary.main,
                      boxShadow: `0 8px 20px -6px ${alpha(
                        theme.palette.primary.main,
                        0.5,
                      )}`,
                      transform: "translateY(-1px)",
                    },
                    "&.Mui-disabled": {
                      backgroundColor: alpha(theme.palette.primary.main, 0.6),
                      color: theme.palette.primary.contrastText,
                    },
                  }}
                >
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
