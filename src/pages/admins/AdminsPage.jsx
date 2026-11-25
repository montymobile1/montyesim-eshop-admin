import DevicesIcon from "@mui/icons-material/Devices";
import LockResetIcon from "@mui/icons-material/LockReset";
import PersonRemoveIcon from "@mui/icons-material/PersonRemove";
import SearchIcon from "@mui/icons-material/Search";
import { Card, Chip, FormControl, Tab, TableCell, Tabs, TextField } from "@mui/material";
import Grid from "@mui/material/Grid2";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import Filters from "../../Components/Filters/Filters";
import {
  ResetPasswordDialog,
  RevokeAccessDialog,
} from "../../Components/page-component/admins/AdminActionDialogs";
import AdminDevicesDialog from "../../Components/page-component/trusted-devices/AdminDevicesDialog";
import ActionsMenu, {
  ActionItem,
} from "../../Components/shared/actions-menu/ActionsMenu";
import RowComponent from "../../Components/shared/table-component/RowComponent";
import TableComponent from "../../Components/shared/table-component/TableComponent";
import TablePaginationComponent from "../../Components/shared/table-component/TablePaginationComponent";
import { ADMIN_ROLE_FILTER, getAdmins } from "../../core/apis/adminsAPI";
import useUrlQueries, {
  useLastValidPage,
} from "../../core/custom-hook/useUrlQueries";
import usePermission from "../../core/hooks/usePermission";
import { PERMISSIONS, ROLE_LABELS } from "../../core/vairables/Permissions";

// TEOS-307: the role tabs, fed by the API facets
const ROLE_TABS = [
  { value: ADMIN_ROLE_FILTER.all, label: "All" },
  { value: ADMIN_ROLE_FILTER.super_admin, label: "Super Admins" },
  { value: ADMIN_ROLE_FILTER.admin, label: "Admins" },
];

const DEFAULT_QUERIES = { search: "", role: ADMIN_ROLE_FILTER.all, pageSize: 10, page: 0 };

const toNumber = (value, fallback) => {
  const number = Number.parseInt(value, 10);
  return Number.isNaN(number) || number < 0 ? fallback : number;
};

const readQueries = (searchParams) => {
  const role = searchParams.get("role");
  return {
    search: searchParams.get("search") || "",
    role: ROLE_TABS.some((tab) => tab.value === role) ? role : ADMIN_ROLE_FILTER.all,
    pageSize: toNumber(searchParams.get("pageSize"), 10) || 10,
    page: toNumber(searchParams.get("page"), 0),
  };
};

const formatDate = (value) => (value ? dayjs(value).format("DD-MM-YYYY HH:mm") : "N/A");

/*
  TEOS-307: the admin accounts (super admin only, admin.security.manage).
  Row actions: Reset password (emails a reset link) and Revoke access (removes the
  admin role). The signed-in super admin's own row has both actions disabled: their
  own password is changed from the Profile page.
  TEOS-256: row action Devices (that admin's devices, with Revoke). On the own row
  it opens Profile > Trusted devices instead, where the current device is handled
  (revoking it there signs this browser out properly).
*/
function AdminsPage() {
  const queryClient = useQueryClient();
  const [searchQueries, setSearchQueries] = useUrlQueries(readQueries, {
    onUrlChange: (next) => setSearch(next.search),
  });
  const [search, setSearch] = useState(searchQueries.search);
  const [dialog, setDialog] = useState({ type: null, admin: null });
  const navigate = useNavigate();
  // the whole page needs it already; the Devices action is still guarded (TEOS-256 case 19)
  const canManageDevices = usePermission(PERMISSIONS.SECURITY_MANAGE);

  const { data, isFetching, isError, error } = useQuery({
    queryKey: ["admins", searchQueries],
    queryFn: () =>
      getAdmins({
        page: searchQueries.page + 1,
        page_size: searchQueries.pageSize,
        role: searchQueries.role,
        search: searchQueries.search?.trim() || undefined,
      }).then((res) => res?.data?.data),
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (isError && !error?.isForbidden) toast.error("Fail to display data");
  }, [isError]);

  const rows = isError ? [] : data?.data || [];
  const totalRows = data?.total_count || 0;
  const facets = data?.facets;
  // false when the API cannot email reset links (no SMTP or no reset URL on this client)
  const resetAvailable = data?.password_reset_available !== false;

  useLastValidPage({
    page: searchQueries.page,
    pageSize: searchQueries.pageSize,
    totalRows,
    rowCount: rows.length,
    isFetching,
    isError,
    onChange: (page) => setSearchQueries({ ...searchQueries, page }, { replace: true }),
  });

  const refreshAdmins = () => queryClient.invalidateQueries({ queryKey: ["admins"] });
  const closeDialog = () => setDialog({ type: null, admin: null });

  const resetFilters = () => {
    setSearchQueries({ ...DEFAULT_QUERIES, role: searchQueries.role });
    setSearch("");
  };

  const tableHeaders = [
    { name: "Email" },
    { name: "Role" },
    { name: "Created At" },
    { name: "Last Sign-in" },
  ];

  return (
    <Card className="page-card">
      <Filters
        onReset={resetFilters}
        onApply={() => setSearchQueries({ ...searchQueries, search, page: 0 })}
        applyDisable={!search?.trim()}
      >
        <Grid container size={{ xs: 12 }} spacing={2}>
          <Grid size={{ xs: 12, sm: 3 }}>
            <FormControl fullWidth>
              <label className="mb-2" htmlFor="admins-search-input">
                Search
              </label>
              <TextField
                id="admins-search-input"
                fullWidth
                size="small"
                placeholder="Search By Email"
                type="text"
                slotProps={{
                  input: {
                    startAdornment: <SearchIcon sx={{ mr: 1 }} />,
                    autoComplete: "new-password",
                    form: { autoComplete: "off" },
                  },
                }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </FormControl>
          </Grid>
        </Grid>
      </Filters>

      <Tabs
        value={searchQueries.role}
        onChange={(_, role) => setSearchQueries({ ...searchQueries, role, page: 0 })}
        aria-label="Role"
      >
        {ROLE_TABS.map((tab) => (
          <Tab
            key={tab.value}
            value={tab.value}
            label={facets ? `${tab.label} (${facets?.[tab.value] ?? 0})` : tab.label}
          />
        ))}
      </Tabs>

      <TableComponent
        loading={isFetching && !data}
        dataPerPage={searchQueries?.pageSize}
        tableData={rows}
        noDataFound={"No Admins Found"}
        tableHeaders={tableHeaders}
        actions={true}
      >
        {rows.map((el) => {
          const ownRow = !!el?.is_current_user;
          const ownReason = "You can't do this on your own account. Use your Profile page.";
          return (
            <RowComponent key={el?.id} actions={false}>
              <TableCell sx={{ minWidth: "220px" }} className="max-w-[300px] truncate">
                <div className="flex flex-row items-center gap-[0.5rem]">
                  <span className="truncate">{el?.email || "N/A"}</span>
                  {ownRow && <Chip size="small" variant="outlined" label="You" />}
                </div>
              </TableCell>
              <TableCell>
                <Chip
                  size="small"
                  color={el?.role === "super_admin" ? "primary" : "default"}
                  label={ROLE_LABELS[el?.role] || el?.role}
                />
              </TableCell>
              <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDate(el?.created_at)}</TableCell>
              <TableCell sx={{ whiteSpace: "nowrap" }}>
                {el?.last_sign_in_at ? formatDate(el.last_sign_in_at) : "Never"}
              </TableCell>
              <TableCell align={"right"}>
                <ActionsMenu label={`Actions for ${el?.email}`}>
                  {canManageDevices && (
                    <ActionItem
                      icon={<DevicesIcon fontSize="small" />}
                      label="Devices"
                      description={
                        ownRow
                          ? "Your devices are on your Profile page"
                          : "See their devices and revoke one"
                      }
                      color="primary"
                      onClick={() =>
                        ownRow
                          ? navigate("/profile?tab=devices")
                          : setDialog({ type: "devices", admin: el })
                      }
                    />
                  )}
                  <ActionItem
                    icon={<LockResetIcon fontSize="small" />}
                    label="Reset password"
                    description={
                      ownRow
                        ? ownReason
                        : resetAvailable
                          ? "Email a link to set a new password"
                          : "Unavailable: emails aren't set up for the admin portal"
                    }
                    color="primary"
                    disabled={ownRow || !resetAvailable}
                    onClick={() => setDialog({ type: "reset", admin: el })}
                  />
                  <ActionItem
                    icon={<PersonRemoveIcon fontSize="small" />}
                    label="Revoke access"
                    description={
                      ownRow
                        ? ownReason
                        : "Remove the admin role and sign them out of the admin portal"
                    }
                    color="error"
                    disabled={ownRow}
                    onClick={() => setDialog({ type: "revoke", admin: el })}
                  />
                </ActionsMenu>
              </TableCell>
            </RowComponent>
          );
        })}
      </TableComponent>
      <TablePaginationComponent
        totalRows={totalRows}
        page={searchQueries?.page}
        pageSize={searchQueries?.pageSize}
        onPageChange={(e, newPage) => setSearchQueries({ ...searchQueries, page: newPage })}
        onRowsPerPageChange={(e) =>
          setSearchQueries({ ...searchQueries, page: 0, pageSize: Number(e.target.value) })
        }
      />

      {dialog.type === "reset" && (
        <ResetPasswordDialog admin={dialog.admin} onClose={closeDialog} onSuccess={refreshAdmins} />
      )}
      {dialog.type === "devices" && canManageDevices && (
        <AdminDevicesDialog admin={dialog.admin} onClose={closeDialog} />
      )}
      {dialog.type === "revoke" && (
        <RevokeAccessDialog admin={dialog.admin} onClose={closeDialog} onSuccess={refreshAdmins} />
      )}
    </Card>
  );
}

export default AdminsPage;
