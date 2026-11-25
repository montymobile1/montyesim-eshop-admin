import { yupResolver } from "@hookform/resolvers/yup";
import { MarkEmailReadOutlined } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  TextField,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import * as Yup from "yup";
import { resendDeviceCode, verifyDevice } from "../../../core/apis/authAPI";
import { getApiErrorCode, getApiErrorDetails } from "../../../core/apis/axios";
import { collectDevice } from "../../../core/helpers/deviceInfo";

/*
  TEOS-256: step 2 of the sign-in, shown when POST auth/login answers
  status "verification_required" (an email code was sent to this admin).
  Contract: TEOS-255-256-api-contract.md sections 2 and 3.
*/

export const DEVICE_NAME_MAX = 60;

export const CODE_STEP_MESSAGES = {
  tooManyAttempts: "Too many attempts. Sign in again.",
  expired: "Code expired. Resend a new code to continue.",
  expiredNoResend: "Code expired and no resends are left. Sign in again to get a new code.",
  emailUnavailable: "We couldn't send the code. Try again later.",
  emailNotConfigured:
    "Sign-in codes can't be emailed: email isn't set up for the admin portal. Sign in from a trusted browser or contact your administrator.",
  codeLimit: "Too many codes were requested. Try again later.",
  closed: "This code can no longer be used. Sign in again.",
  resent: "A new code was sent.",
  failed: "Couldn't verify the code. Try again.",
};

export const wrongCodeMessage = (attemptsLeft) =>
  Number.isFinite(attemptsLeft)
    ? `Wrong code. ${attemptsLeft} ${attemptsLeft === 1 ? "attempt" : "attempts"} left.`
    : "Wrong code.";

const onlyDigits = (value = "") => String(value).replace(/\D/g, "");

const buildSchema = (codeLength) =>
  Yup.object({
    code: Yup.string()
      .required(`Enter the ${codeLength}-digit code`)
      .matches(
        new RegExp(`^\\d{${codeLength}}$`),
        `Enter the ${codeLength}-digit code`,
      ),
    trust_device: Yup.boolean(),
    device_name: Yup.string()
      .trim()
      .max(DEVICE_NAME_MAX, `At most ${DEVICE_NAME_MAX} characters`),
  });

export default function DeviceCodeStep({
  verification,
  notice = null,
  onSignedIn,
  onBack,
}) {
  const theme = useTheme();
  const codeLength = Number(verification?.code_length) || 6;
  const schema = useMemo(() => buildSchema(codeLength), [codeLength]);

  const { control, handleSubmit, setValue, setError, watch, setFocus } =
    useForm({
      defaultValues: { code: "", trust_device: false, device_name: "" },
      resolver: yupResolver(schema),
      mode: "onSubmit",
    });

  const code = watch("code");
  const codeComplete = new RegExp(`^\\d{${codeLength}}$`).test(code || "");

  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState(
    notice ? { severity: "success", text: notice } : null,
  );
  const [expired, setExpired] = useState(false);
  const [resendIn, setResendIn] = useState(
    Number(verification?.resend_available_in) || 0,
  );
  const [resendsLeft, setResendsLeft] = useState(
    Number.isFinite(Number(verification?.resends_left))
      ? Number(verification.resends_left)
      : 0,
  );

  // one request at a time, even for a double click or a paste + click (case 24)
  const inFlight = useRef(false);

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const timer = setTimeout(
      () => setResendIn((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => clearTimeout(timer);
  }, [resendIn]);

  const apiMessage = (error, fallback) =>
    error?.response?.data?.message || fallback;

  // Errors shared by verify-device and resend-code (contract section 2)
  const handleError = (error) => {
    const errorCode = getApiErrorCode(error);
    const details = getApiErrorDetails(error) || {};
    switch (errorCode) {
      case "code_invalid":
        setValue("code", "");
        setMessage({
          severity: "error",
          text: wrongCodeMessage(Number(details.attempts_left)),
        });
        setTimeout(() => setFocus("code"), 0);
        return;
      case "too_many_attempts":
        onBack?.(CODE_STEP_MESSAGES.tooManyAttempts);
        return;
      case "verification_expired":
        // TEOS-256 case 14: "Code expired" with a Resend option (the API resends an expired code)
        setExpired(true);
        setValue("code", "");
        setMessage({
          severity: "warning",
          text:
            resendsLeft > 0
              ? CODE_STEP_MESSAGES.expired
              : CODE_STEP_MESSAGES.expiredNoResend,
        });
        return;
      case "verification_closed":
        onBack?.(apiMessage(error, CODE_STEP_MESSAGES.closed));
        return;
      case "device_mismatch":
      case "resend_limit":
        onBack?.(apiMessage(error, CODE_STEP_MESSAGES.closed));
        return;
      case "resend_too_soon":
        setResendIn(Number(details.retry_after) || 60);
        setMessage({
          severity: "warning",
          text: apiMessage(error, "Wait before asking for a new code."),
        });
        return;
      case "code_limit":
        setMessage({
          severity: "error",
          text: apiMessage(error, CODE_STEP_MESSAGES.codeLimit),
        });
        return;
      case "email_unavailable":
        setMessage({
          severity: "error",
          text: CODE_STEP_MESSAGES.emailUnavailable,
        });
        return;
      case "email_not_configured":
        setMessage({
          severity: "error",
          text: CODE_STEP_MESSAGES.emailNotConfigured,
        });
        return;
      case "code_format":
        setError("code", {
          type: "server",
          message: `Enter the ${Number(details.code_length) || codeLength}-digit code`,
        });
        return;
      default:
        if (error?.response?.status === 503) {
          setMessage({
            severity: "error",
            text: CODE_STEP_MESSAGES.emailUnavailable,
          });
          return;
        }
        setMessage({
          severity: "error",
          text: error?.message || CODE_STEP_MESSAGES.failed,
        });
    }
  };

  const submitCode = async (values) => {
    if (inFlight.current || expired) return;
    inFlight.current = true;
    setVerifying(true);
    setMessage(null);
    const deviceName = values.device_name?.trim();
    try {
      const res = await verifyDevice({
        verification_id: verification.verification_id,
        code: values.code,
        trust_device: Boolean(values.trust_device),
        ...(deviceName ? { device_name: deviceName } : {}),
        device: collectDevice(),
      });
      const session = res?.data?.data;
      if (session?.access_token) {
        onSignedIn?.(session);
        return;
      }
      setMessage({
        severity: "error",
        text: res?.data?.message || CODE_STEP_MESSAGES.failed,
      });
    } catch (error) {
      handleError(error);
    } finally {
      inFlight.current = false;
      setVerifying(false);
    }
  };

  const resend = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setResending(true);
    setMessage(null);
    try {
      const res = await resendDeviceCode({
        verification_id: verification.verification_id,
      });
      const data = res?.data?.data || {};
      setResendIn(Number(data.resend_available_in) || 60);
      if (Number.isFinite(Number(data.resends_left)))
        setResendsLeft(Number(data.resends_left));
      setValue("code", "");
      setExpired(false); // a new code: valid for 10 minutes again
      setMessage({ severity: "success", text: CODE_STEP_MESSAGES.resent });
    } catch (error) {
      handleError(error);
    } finally {
      inFlight.current = false;
      setResending(false);
    }
  };

  const busy = verifying || resending;
  // an expired code can be resent at once (no need to wait for the countdown)
  const resendDisabled =
    busy || resendsLeft <= 0 || (!expired && resendIn > 0);
  const resendLabel =
    !expired && resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code";

  return (
    <div className="flex flex-col gap-6" data-testid="device-code-step">
      <div className="flex flex-col items-center gap-3 text-center">
        <Box
          className="flex items-center justify-center w-14 h-14 rounded-2xl"
          sx={{
            backgroundColor: alpha(theme.palette.primary.main, 0.08),
            color: theme.palette.primary.main,
          }}
        >
          <MarkEmailReadOutlined fontSize="medium" />
        </Box>
        <div className="flex flex-col gap-1">
          <Typography variant="h5" component="h1" fontWeight={700}>
            Check your email
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            data-testid="code-destination"
          >
            We sent a code to{" "}
            <Box
              component="bdi"
              sx={{ fontWeight: 600, color: "text.primary" }}
            >
              {verification?.destination}
            </Box>
          </Typography>
        </div>
      </div>

      {message && (
        <Alert
          severity={message.severity}
          data-testid="code-step-message"
          role="alert"
        >
          {message.text}
        </Alert>
      )}

      <form
        className="flex flex-col gap-4"
        onSubmit={handleSubmit(submitCode)}
        noValidate
      >
        <div className="flex flex-col gap-1.5">
          <Typography
            component="label"
            htmlFor="device-code"
            variant="body2"
            fontWeight={600}
          >
            {`Enter the ${codeLength}-digit code`}
          </Typography>
          <Controller
            name="code"
            control={control}
            render={({
              field: { onChange, value, ref },
              fieldState: { error },
            }) => (
              <TextField
                id="device-code"
                inputRef={ref}
                value={value}
                fullWidth
                size="small"
                autoFocus
                disabled={expired}
                placeholder={"0".repeat(codeLength)}
                error={Boolean(error)}
                helperText={error?.message}
                onChange={(e) => {
                  // A paste only fills the code: the admin still ticks "Trust this
                  // device" and presses Verify (no auto-submit, user's decision 2026-11-09).
                  onChange(onlyDigits(e.target.value).slice(0, codeLength));
                }}
                slotProps={{
                  htmlInput: {
                    autoComplete: "one-time-code",
                    inputMode: "numeric",
                    pattern: "[0-9]*",
                    // no maxLength: it would cut a pasted "123 456" before the spaces are dropped
                    // digits read left to right in Arabic too
                    dir: "ltr",
                    "aria-label": "Verification code",
                    style: { letterSpacing: "0.4em", textAlign: "center" },
                  },
                }}
              />
            )}
          />
        </div>

        <Controller
          name="trust_device"
          control={control}
          render={({ field: { onChange, value } }) => (
            <FormControlLabel
              control={
                <Checkbox
                  checked={Boolean(value)}
                  onChange={(e) => onChange(e.target.checked)}
                  disabled={busy}
                />
              }
              label="Trust this device for 30 days"
            />
          )}
        />

        <div className="flex flex-col gap-1.5">
          <Typography
            component="label"
            htmlFor="device-name"
            variant="body2"
            fontWeight={600}
          >
            Device name (optional)
          </Typography>
          <Controller
            name="device_name"
            control={control}
            render={({ field: { onChange, value }, fieldState: { error } }) => (
              <TextField
                id="device-name"
                value={value}
                fullWidth
                size="small"
                placeholder="e.g. Office laptop"
                error={Boolean(error)}
                helperText={error?.message}
                onChange={(e) => onChange(e.target.value)}
                slotProps={{
                  htmlInput: {
                    maxLength: DEVICE_NAME_MAX,
                    autoComplete: "off",
                  },
                }}
              />
            )}
          />
        </div>

        <Button
          variant="contained"
          color="primary"
          type="submit"
          size="large"
          fullWidth
          disabled={!codeComplete || busy || expired}
          startIcon={
            verifying ? <CircularProgress size={18} color="inherit" /> : null
          }
        >
          {verifying ? "Verifying..." : "Verify"}
        </Button>
      </form>

      <div className="flex flex-col items-center gap-1 text-center">
        <Button
          variant="text"
          onClick={resend}
          disabled={resendDisabled}
          data-testid="resend-code"
        >
          {resendLabel}
        </Button>
        <Typography
          variant="caption"
          color="text.secondary"
          data-testid="resends-left"
        >
          {resendsLeft > 0
            ? `${resendsLeft} ${resendsLeft === 1 ? "resend" : "resends"} left`
            : "No resends left"}
        </Typography>
        <Button
          variant="text"
          color="inherit"
          onClick={() => onBack?.(null)}
          disabled={busy}
        >
          Use another account
        </Button>
      </div>
    </div>
  );
}
