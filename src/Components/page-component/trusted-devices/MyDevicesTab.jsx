import DriveFileRenameOutlineIcon from "@mui/icons-material/DriveFileRenameOutline";
import LogoutIcon from "@mui/icons-material/Logout";
import PhonelinkEraseIcon from "@mui/icons-material/PhonelinkErase";
import { Alert, Button, Tooltip } from "@mui/material";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  getMyDevices,
  renameMyDevice,
  revokeMyDevice,
  revokeMyOtherDevices,
} from "../../../core/apis/trustedDevicesAPI";
import { signOutLocally } from "../../../core/apis/axios";
import ActionsMenu, { ActionItem } from "../../shared/actions-menu/ActionsMenu";
import { TableToolbar } from "../../shared/table-component/TableComponent";
import { ConfirmDeviceDialog, RenameDeviceDialog, RevokeDeviceDialog } from "./DeviceDialogs";
import DevicesList from "./DevicesList";
import { DEVICE_QUERY_KEYS, deviceTitle, handleDeviceActionError } from "./deviceDisplay";

/*
  TEOS-256: Profile > Trusted devices, the signed-in admin's own devices (every
  admin, GET /me/devices). Row actions: Rename and Revoke. Revoking the current
  device signs this browser out (the API ended its session). Toolbar: "Sign out
  all other devices".
*/
const MyDevicesTab = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState({ type: null, device: null });

  const { data, isFetching, isError, error, refetch } = useQuery({
    queryKey: DEVICE_QUERY_KEYS.mine,
    queryFn: () => getMyDevices().then((res) => res?.data?.data),
  });

  useEffect(() => {
    if (isError && !error?.isForbidden) toast.error("Fail to display data");
  }, [isError]);

  const rows = isError ? [] : data?.data || [];
  const others = rows.filter((row) => !row?.current).length;
  // why "Sign out all other devices" is disabled (null = enabled), shown as its tooltip
  let signOutOthersBlocked = null;
  if (isFetching) signOutOthersBlocked = "Loading your devices…";
  else if (isError) signOutOthersBlocked = "Your devices couldn't be loaded. Retry first.";
  else if (others === 0) signOutOthersBlocked = "No other device is signed in: this is the only one.";

  const refresh = () => queryClient.invalidateQueries({ queryKey: DEVICE_QUERY_KEYS.mine });
  const closeDialog = () => setDialog({ type: null, device: null });

  // the API already ended this browser's session: full local sign-out (store, the
  // encrypted persisted auth, query cache), then the sign-in page
  const signOutHere = async () => {
    await signOutLocally();
    queryClient.clear();
    toast.success("This device was signed out.");
    navigate("/signin", { replace: true });
  };

  const rename = (name) =>
    renameMyDevice({ id: dialog.device?.id, name })
      .then((res) => {
        const updated = res?.data?.data;
        // the row updates in place, then the list is checked again
        queryClient.setQueryData(DEVICE_QUERY_KEYS.mine, (old) =>
          old?.data
            ? {
                ...old,
                data: old.data.map((row) =>
                  row?.id === dialog.device?.id ? { ...row, ...(updated || { name }) } : row
                ),
              }
            : old
        );
        toast.success("The device was renamed.");
        closeDialog();
        refresh();
      })
      .catch((err) => {
        if (handleDeviceActionError(err, "Failed to rename the device", refresh)) closeDialog();
      });

  const revoke = () => {
    const device = dialog.device;
    return revokeMyDevice(device?.id)
      .then(() => {
        closeDialog();
        if (device?.current) {
          signOutHere();
          return;
        }
        toast.success(`"${deviceTitle(device)}" was signed out.`);
        refresh();
      })
      .catch((err) => {
        if (handleDeviceActionError(err, "Failed to revoke the device", refresh)) closeDialog();
      });
  };

  const revokeOthers = () =>
    revokeMyOtherDevices()
      .then((res) => {
        const count = Number(res?.data?.data?.revoked) || 0;
        if (count === 0) toast.info("No other device was signed in.");
        else toast.success(`Signed out ${count} other device${count === 1 ? "" : "s"}.`);
        closeDialog();
        refresh();
      })
      .catch((err) => {
        toast.error(err?.message || "Failed to sign out the other devices");
        if (err?.response?.status === 403) closeDialog();
      });

  return (
    <div className="flex flex-col gap-4">
      <Alert severity="info">
        A trusted device signs in without an email code for 30 days. Revoke a device you
        don&apos;t recognise: it is signed out and asks for a code next time.
      </Alert>
      <TableToolbar>
        {/* a disabled button fires no mouse events: the span carries the tooltip */}
        <Tooltip title={signOutOthersBlocked || ""} arrow>
          <span>
            <Button
              variant="outlined"
              color="error"
              startIcon={<LogoutIcon />}
              disabled={Boolean(signOutOthersBlocked)}
              onClick={() => setDialog({ type: "others", device: null })}
            >
              Sign out all other devices
            </Button>
          </span>
        </Tooltip>
      </TableToolbar>

      <DevicesList
        rows={rows}
        loading={isFetching && !data}
        error={isError ? error : null}
        onRetry={() => refetch()}
        noDataText="No devices found"
        renderActions={(row) => (
          <ActionsMenu label={`Actions for ${deviceTitle(row)}`}>
            <ActionItem
              icon={<DriveFileRenameOutlineIcon fontSize="small" />}
              label="Rename"
              description="Give this device a name you'll recognise"
              color="primary"
              onClick={() => setDialog({ type: "rename", device: row })}
            />
            <ActionItem
              icon={<PhonelinkEraseIcon fontSize="small" />}
              label="Revoke"
              description={
                row?.current
                  ? "Sign this browser out; it asks for a code next time"
                  : "Sign this device out and require a code next time"
              }
              color="error"
              onClick={() => setDialog({ type: "revoke", device: row })}
            />
          </ActionsMenu>
        )}
      />

      {dialog.type === "rename" && (
        <RenameDeviceDialog device={dialog.device} onSubmit={rename} onClose={closeDialog} />
      )}
      {dialog.type === "revoke" && (
        <RevokeDeviceDialog device={dialog.device} onConfirm={revoke} onClose={closeDialog} />
      )}
      {dialog.type === "others" && (
        <ConfirmDeviceDialog
          title="Sign Out Other Devices"
          body="Every device except this one will be signed out, and each asks for an email code at its next sign-in. Do you want to continue?"
          confirmLabel="Sign out others"
          busyLabel="Signing out..."
          onConfirm={revokeOthers}
          onClose={closeDialog}
        />
      )}
    </div>
  );
};

export default MyDevicesTab;
