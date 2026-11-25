import { Close } from "@mui/icons-material";
import PhonelinkEraseIcon from "@mui/icons-material/PhonelinkErase";
import { Dialog, DialogContent, DialogTitle, IconButton, Typography } from "@mui/material";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "react-toastify";
import { getApiErrorCode } from "../../../core/apis/axios";
import { getAdminDevices, revokeAdminDevice } from "../../../core/apis/trustedDevicesAPI";
import usePermission from "../../../core/hooks/usePermission";
import { PERMISSIONS } from "../../../core/vairables/Permissions";
import ActionsMenu, { ActionItem } from "../../shared/actions-menu/ActionsMenu";
import { RevokeDeviceDialog } from "./DeviceDialogs";
import DevicesList from "./DevicesList";
import { DEVICE_QUERY_KEYS, deviceTitle, handleDeviceActionError } from "./deviceDisplay";

const NOT_ADMIN_MESSAGE = "This account is no longer an admin.";

const loadError = (error) => {
  if (!error) return null;
  if (error?.response?.status === 404 && getApiErrorCode(error) !== "device_not_found") {
    return { message: NOT_ADMIN_MESSAGE };
  }
  return error;
};

/*
  TEOS-256: Admins page > Devices. Another admin's devices, read-only except Revoke
  (super admin, admin.security.manage; the API is the guard, this only hides it).
*/
const AdminDevicesDialog = ({ admin, onClose }) => {
  const allowed = usePermission(PERMISSIONS.SECURITY_MANAGE);
  const queryClient = useQueryClient();
  const [revoking, setRevoking] = useState(null);
  const queryKey = DEVICE_QUERY_KEYS.admin(admin?.id);

  const { data, isFetching, isError, error, refetch } = useQuery({
    queryKey,
    queryFn: () => getAdminDevices(admin?.id).then((res) => res?.data?.data),
    enabled: allowed && !!admin?.id,
  });

  if (!allowed) return null;

  const rows = isError ? [] : data?.data || [];
  const refresh = () => queryClient.invalidateQueries({ queryKey });

  const revoke = () =>
    revokeAdminDevice({ adminId: admin?.id, deviceId: revoking?.id })
      .then(() => {
        toast.success(`"${deviceTitle(revoking)}" of ${admin?.email} was signed out.`);
        setRevoking(null);
        refresh();
      })
      .catch((err) => {
        if (handleDeviceActionError(err, "Failed to revoke the device", refresh)) {
          setRevoking(null);
        }
      });

  return (
    <>
      <Dialog open={true} onClose={onClose} maxWidth="lg" fullWidth aria-labelledby="admin-devices-title">
        <DialogTitle id="admin-devices-title" sx={{ paddingInlineEnd: 6 }}>
          Devices
          <Typography variant="body2" color="text.secondary" className="break-all" dir="auto">
            {admin?.email}
          </Typography>
        </DialogTitle>
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{ position: "absolute", insetInlineEnd: 8, top: 8 }}
        >
          <Close />
        </IconButton>
        <DialogContent className="flex flex-col gap-4">
          <DevicesList
            rows={rows}
            loading={isFetching && !data}
            error={isError ? loadError(error) : null}
            onRetry={() => refetch()}
            noDataText="This admin has no signed-in devices"
            renderActions={(row) => (
              <ActionsMenu label={`Actions for ${deviceTitle(row)}`}>
                <ActionItem
                  icon={<PhonelinkEraseIcon fontSize="small" />}
                  label="Revoke"
                  description="Sign this device out and require a code next time"
                  color="error"
                  onClick={() => setRevoking(row)}
                />
              </ActionsMenu>
            )}
          />
        </DialogContent>
      </Dialog>
      {revoking && (
        <RevokeDeviceDialog
          device={{ ...revoking, current: false }}
          ownerEmail={admin?.email}
          onConfirm={revoke}
          onClose={() => setRevoking(null)}
        />
      )}
    </>
  );
};

export default AdminDevicesDialog;
