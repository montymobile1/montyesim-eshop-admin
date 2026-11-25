import DevicesOtherIcon from "@mui/icons-material/DevicesOther";
import {
  Alert,
  Button,
  Chip,
  Paper,
  TableCell,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import TableComponent from "../../shared/table-component/TableComponent";
import RowComponent from "../../shared/table-component/RowComponent";
import TableSkeletons from "../../shared/skeletons/TableSkeletons";
import NoDataFound from "../../shared/fallbacks/no-data-found/NoDataFound";
import {
  deviceBrowser,
  deviceOs,
  deviceTitle,
  formatDeviceDate,
  isTrusted,
  trustExpiry,
  trustText,
} from "./deviceDisplay";

/*
  TEOS-256: the list of trusted devices, used by Profile > Trusted devices (own
  devices) and by the Admins page (another admin's devices).
  Wide screens: the shared table. Narrow screens (below md): one card per device.
  Both views draw the same row actions (renderActions -> the shared ⋯ ActionsMenu).
  RTL: no left/right anywhere, only logical "start"/"end" alignment; device names
  are typed by the admin, so they get dir="auto".
*/

const HEADERS = [
  { name: "Device" },
  { name: "Browser" },
  { name: "System" },
  { name: "Last IP" },
  { name: "Last used" },
  { name: "First seen" },
  { name: "Status" },
  { name: "Expires" },
];

const CurrentBadge = () => (
  <Chip size="small" color="primary" variant="outlined" label="This device" />
);

const TrustChip = ({ row }) => (
  <Chip
    size="small"
    color={isTrusted(row) ? "success" : "default"}
    variant={isTrusted(row) ? "filled" : "outlined"}
    label={trustText(row)}
  />
);

// the admin's name for the device when it has one, else the default "Chrome on Windows"
const DeviceName = ({ row }) => (
  <div className="flex flex-row flex-wrap items-center gap-[0.5rem] min-w-0">
    <span dir="auto" className="break-words font-semibold" data-testid="device-name">
      {deviceTitle(row)}
    </span>
    {row?.current && <CurrentBadge />}
  </div>
);

const CARD_FIELDS = [
  ["Browser", deviceBrowser],
  ["System", deviceOs],
  ["Last IP", (row) => row?.last_ip || "N/A"],
  ["Last used", (row) => formatDeviceDate(row?.last_used_at)],
  ["First seen", (row) => formatDeviceDate(row?.created_at)],
  ["Expires", trustExpiry],
];

const DeviceCard = ({ row, actions }) => (
  <Paper
    variant="outlined"
    component="li"
    className="flex flex-col gap-[0.75rem] p-4"
    data-testid="device-card"
    aria-current={row?.current ? "true" : undefined}
  >
    <div className="flex flex-row items-start justify-between gap-[0.5rem]">
      <DeviceName row={row} />
      <div className="shrink-0">{actions}</div>
    </div>
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 m-0">
      {CARD_FIELDS.map(([label, read]) => (
        <div key={label} className="contents">
          <Typography component="dt" variant="body2" color="text.secondary">
            {label}
          </Typography>
          <Typography component="dd" variant="body2" className="m-0 break-words">
            {read(row)}
          </Typography>
        </div>
      ))}
    </dl>
    <div>
      <TrustChip row={row} />
    </div>
  </Paper>
);

const DevicesList = ({
  rows = [],
  loading = false,
  error = null,
  onRetry,
  renderActions,
  noDataText = "No devices found",
}) => {
  const theme = useTheme();
  const cards = useMediaQuery(theme.breakpoints.down("md"));

  if (error) {
    return (
      <Alert
        severity="error"
        action={
          onRetry ? (
            <Button color="inherit" size="small" onClick={onRetry}>
              Retry
            </Button>
          ) : null
        }
      >
        {error?.message || "Failed to load the devices."}
      </Alert>
    );
  }

  if (cards) {
    if (loading) return <TableSkeletons count={3} />;
    if (rows.length === 0) {
      return (
        <NoDataFound row={true} text={noDataText} image={<DevicesOtherIcon fontSize="small" />} />
      );
    }
    return (
      <ul className="flex flex-col gap-[0.75rem] p-0 m-0 list-none" aria-label="Devices">
        {rows.map((row) => (
          <DeviceCard key={row?.id} row={row} actions={renderActions?.(row)} />
        ))}
      </ul>
    );
  }

  return (
    <TableComponent
      loading={loading}
      dataPerPage={3}
      tableData={rows}
      noDataFound={noDataText}
      tableHeaders={HEADERS}
      actions={!!renderActions}
    >
      {rows.map((row) => (
        <RowComponent key={row?.id} actions={false}>
          <TableCell sx={{ minWidth: "200px", maxWidth: "320px" }} data-testid="device-cell">
            <DeviceName row={row} />
          </TableCell>
          <TableCell sx={{ whiteSpace: "nowrap" }}>{deviceBrowser(row)}</TableCell>
          <TableCell sx={{ whiteSpace: "nowrap" }}>{deviceOs(row)}</TableCell>
          <TableCell sx={{ whiteSpace: "nowrap" }}>{row?.last_ip || "N/A"}</TableCell>
          <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDeviceDate(row?.last_used_at)}</TableCell>
          <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDeviceDate(row?.created_at)}</TableCell>
          <TableCell sx={{ whiteSpace: "nowrap" }}>
            <TrustChip row={row} />
          </TableCell>
          <TableCell sx={{ whiteSpace: "nowrap" }} data-testid="device-expires">
            {trustExpiry(row)}
          </TableCell>
          {renderActions && (
            <TableCell sx={{ textAlign: "end" }}>{renderActions(row)}</TableCell>
          )}
        </RowComponent>
      ))}
    </TableComponent>
  );
};

export default DevicesList;
