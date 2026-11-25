import { yupResolver } from "@hookform/resolvers/yup";
import { Close } from "@mui/icons-material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { Button, Dialog, DialogContent, IconButton, TextField } from "@mui/material";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import * as yup from "yup";
import { cleanDeviceName, DEVICE_NAME_MAX, deviceTitle } from "./deviceDisplay";

/*
  TEOS-256: the dialogs of the trusted devices screens, in the style of the Admins
  page dialogs (AdminActionDialogs.jsx). The close button sits at the inline end
  (insetInlineEnd), so it follows an RTL layout.
*/

export const DeviceDialogFrame = ({ title, icon, body, busy, onClose, children }) => (
  <Dialog open={true} maxWidth="sm" fullWidth aria-labelledby="device-dialog-title">
    <DialogContent className="flex flex-col gap-[1rem] xs:!px-8 !py-10 ">
      <IconButton
        aria-label="close"
        disabled={busy}
        onClick={onClose}
        sx={{ position: "absolute", insetInlineEnd: 8, top: 8, color: "black" }}
      >
        <Close />
      </IconButton>
      <h1 id="device-dialog-title" className={"text-center"}>
        {title}
      </h1>
      {body && (
        <div className={"flex flex-row gap-[0.75rem] items-start"}>
          {icon}
          <p className={"break-words"}>{body}</p>
        </div>
      )}
      {children}
    </DialogContent>
  </Dialog>
);

const DialogButtons = ({ busy, onClose, onConfirm, confirmLabel, confirmColor, disabled, submit }) => (
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
      type={submit ? "submit" : "button"}
      onClick={submit ? undefined : onConfirm}
    >
      {confirmLabel}
    </Button>
  </div>
);

/*
  A yes/no dialog. onConfirm returns a promise; the dialog stays open (buttons
  disabled) while it runs, so a double click sends one request. The caller closes
  the dialog in its own then/catch.
*/
export const ConfirmDeviceDialog = ({
  title,
  body,
  danger = true,
  confirmLabel,
  busyLabel,
  onConfirm,
  onClose,
}) => {
  const [busy, setBusy] = useState(false);

  const confirm = () => {
    if (busy) return;
    setBusy(true);
    Promise.resolve(onConfirm?.()).finally(() => setBusy(false));
  };

  return (
    <DeviceDialogFrame
      title={title}
      icon={
        danger ? <WarningAmberIcon color="warning" /> : <InfoOutlinedIcon color="primary" />
      }
      body={body}
      busy={busy}
      onClose={onClose}
    >
      <DialogButtons
        busy={busy}
        onClose={onClose}
        onConfirm={confirm}
        confirmColor={danger ? "error" : "primary"}
        confirmLabel={busy ? busyLabel || confirmLabel : confirmLabel}
      />
    </DeviceDialogFrame>
  );
};

// Revoke one device. The current device gets the stronger text: it signs this browser out.
export const RevokeDeviceDialog = ({ device, ownerEmail, onConfirm, onClose }) => {
  const name = `"${deviceTitle(device)}"`;
  let body;
  if (device?.current) {
    body = `${name} is the device you are using now. You will be signed out, and the next sign-in on this browser asks for an email code. Do you want to continue?`;
  } else if (ownerEmail) {
    body = `${name} of ${ownerEmail} will be signed out, and its next sign-in asks for an email code. Do you want to continue?`;
  } else {
    body = `${name} will be signed out, and its next sign-in asks for an email code. Do you want to continue?`;
  }
  return (
    <ConfirmDeviceDialog
      title={device?.current ? "Sign Out This Device" : "Revoke Device"}
      body={body}
      confirmLabel={device?.current ? "Sign me out" : "Revoke"}
      busyLabel={device?.current ? "Signing out..." : "Revoking..."}
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
};

const renameSchema = yup.object({
  name: yup
    .string()
    .transform((value) => cleanDeviceName(value || ""))
    .required("Enter a name")
    .max(DEVICE_NAME_MAX, `At most ${DEVICE_NAME_MAX} characters`),
});

// Rename: 1..60 characters (spaces collapsed, like the API). onSubmit(name) returns a promise.
export const RenameDeviceDialog = ({ device, onSubmit, onClose }) => {
  const [busy, setBusy] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { isValid },
  } = useForm({
    defaultValues: { name: device?.name || "" },
    resolver: yupResolver(renameSchema),
    mode: "all",
  });

  const submit = ({ name }) => {
    if (busy) return;
    setBusy(true);
    Promise.resolve(onSubmit?.(cleanDeviceName(name))).finally(() => setBusy(false));
  };

  return (
    <DeviceDialogFrame title="Rename Device" busy={busy} onClose={onClose}>
      <form
        className="flex flex-col gap-[1rem]"
        onSubmit={handleSubmit(submit)}
        noValidate
        aria-label="Rename device"
      >
        <Controller
          name="name"
          control={control}
          render={({ field: { onChange, value }, fieldState: { error } }) => (
            <TextField
              fullWidth
              autoFocus
              label="Device name"
              placeholder={deviceTitle({ ...device, name: "" })}
              value={value}
              error={!!error}
              helperText={
                error?.message ||
                `A name you'll recognise (${cleanDeviceName(value).length}/${DEVICE_NAME_MAX})`
              }
              onChange={(e) => onChange(e.target.value)}
              slotProps={{ htmlInput: { dir: "auto" } }}
            />
          )}
        />
        <DialogButtons
          busy={busy}
          onClose={onClose}
          submit={true}
          confirmColor="primary"
          disabled={!isValid}
          confirmLabel={busy ? "Saving..." : "Save"}
        />
      </form>
    </DeviceDialogFrame>
  );
};
