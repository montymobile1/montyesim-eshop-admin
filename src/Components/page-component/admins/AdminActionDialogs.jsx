import { yupResolver } from "@hookform/resolvers/yup";
import { Close } from "@mui/icons-material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { Button, Dialog, DialogContent, IconButton } from "@mui/material";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "react-toastify";
import * as yup from "yup";
import {
  getApiErrorCode,
  revokeAdminAccess,
  sendPasswordReset,
} from "../../../core/apis/adminsAPI";
import { reasonSchema } from "../../../core/helpers/reasonSchema";
import { ROLE_LABELS } from "../../../core/vairables/Permissions";
import { FormInput } from "../../form-component/FormComponent";

/*
  TEOS-307: shared handling of the errors both Admins page actions can get.
  Returns true when the dialog should close (and the list be refreshed).
*/
const handleActionError = (error, fallback) => {
  const status = error?.response?.status;
  const code = getApiErrorCode(error);
  if (code === "cannot_target_self") {
    toast.error(error.message);
    return true;
  }
  if (status === 404) {
    toast.info("This account is no longer an admin.");
    return true;
  }
  if (status === 403) {
    toast.error(error?.message);
    return true;
  }
  toast.error(error?.message || fallback);
  return false;
};

const DialogFrame = ({ title, icon, body, busy, onClose, children }) => (
  <Dialog open={true} maxWidth="sm" fullWidth>
    <DialogContent className="flex flex-col gap-[1rem] xs:!px-8 !py-10 ">
      <IconButton
        aria-label="close"
        disabled={busy}
        onClick={onClose}
        sx={{ position: "absolute", right: 8, top: 8, color: "black" }}
      >
        <Close />
      </IconButton>
      <h1 className={"text-center"}>{title}</h1>
      <div className={"flex flex-row gap-[0.75rem] items-start"}>
        {icon}
        <p className={"break-words"}>{body}</p>
      </div>
      {children}
    </DialogContent>
  </Dialog>
);

const DialogButtons = ({ busy, onClose, onConfirm, confirmLabel, confirmColor, disabled }) => (
  <div className={"w-full flex flex-row justify-between gap-[1rem]"}>
    <Button
      variant={"contained"}
      sx={{ width: "100%" }}
      color="secondary"
      disabled={busy}
      onClick={onClose}
    >
      Cancel
    </Button>
    <Button
      variant={"contained"}
      sx={{ width: "100%" }}
      color={confirmColor}
      disabled={busy || disabled}
      onClick={onConfirm}
    >
      {confirmLabel}
    </Button>
  </div>
);

// Reset password: the API emails the admin a single-use link to /reset-password.
export const ResetPasswordDialog = ({ admin, onClose, onSuccess }) => {
  const [busy, setBusy] = useState(false);

  const confirm = () => {
    if (busy) return;
    setBusy(true);
    sendPasswordReset(admin?.id)
      .then((res) => {
        toast.success(
          `A password reset link was sent to ${res?.data?.data?.email || admin?.email}.`
        );
        onSuccess?.();
        onClose();
      })
      .catch((error) => {
        if (handleActionError(error, "Failed to send the reset link")) {
          onSuccess?.();
          onClose();
        }
      })
      .finally(() => setBusy(false));
  };

  return (
    <DialogFrame
      title="Reset Password"
      icon={<InfoOutlinedIcon color="primary" />}
      body={`A password reset link will be emailed to "${admin?.email}". Their current password keeps working until they set a new one from the link, which then signs them out of the admin portal. Do you want to continue?`}
      busy={busy}
      onClose={onClose}
    >
      <DialogButtons
        busy={busy}
        onClose={onClose}
        onConfirm={confirm}
        confirmColor="primary"
        confirmLabel={busy ? "Sending..." : "Send reset link"}
      />
    </DialogFrame>
  );
};

const revokeSchema = yup.object({ reason: reasonSchema() });

// Revoke access: removes the admin role (the account is kept) with a reason.
export const RevokeAccessDialog = ({ admin, onClose, onSuccess }) => {
  const [busy, setBusy] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { isValid },
  } = useForm({
    defaultValues: { reason: "" },
    resolver: yupResolver(revokeSchema),
    mode: "all",
  });

  const onSubmit = ({ reason }) => {
    if (busy) return;
    setBusy(true);
    revokeAdminAccess({ id: admin?.id, reason: reason.trim() })
      .then((res) => {
        const result = res?.data?.data;
        if (result?.sessions_signed_out === false) {
          toast.warn(
            `Admin access was removed from ${admin?.email}, but their open sessions could not be signed out. Their next request is refused.`
          );
        } else {
          toast.success(`Admin access was removed from ${admin?.email}.`);
        }
        onSuccess?.();
        onClose();
      })
      .catch((error) => {
        if (handleActionError(error, "Failed to revoke the access")) {
          onSuccess?.();
          onClose();
        }
      })
      .finally(() => setBusy(false));
  };

  return (
    <DialogFrame
      title="Revoke Access"
      icon={<WarningAmberIcon color="warning" />}
      body={`You are about to remove the ${
        ROLE_LABELS[admin?.role] || admin?.role
      } role from "${admin?.email}". They are signed out of the admin portal and can no longer use it. The account itself is kept. Do you want to continue?`}
      busy={busy}
      onClose={onClose}
    >
      <div className="label-input-wrapper">
        <Controller
          name="reason"
          control={control}
          render={({ field: { onChange, value }, fieldState: { error } }) => (
            <label className="w-full">
              Reason*
              <FormInput
                placeholder={"e.g. Left the company."}
                multiline={true}
                minRows={3}
                maxRows={6}
                value={value}
                helperText={error?.message}
                onChange={(val) => onChange(val)}
              />
            </label>
          )}
        />
      </div>
      <DialogButtons
        busy={busy}
        onClose={onClose}
        onConfirm={handleSubmit(onSubmit)}
        confirmColor="error"
        disabled={!isValid}
        confirmLabel={busy ? "Revoking..." : "Revoke access"}
      />
    </DialogFrame>
  );
};
