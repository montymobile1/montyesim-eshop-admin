import { Check, Close } from "@mui/icons-material";
import LockIcon from "@mui/icons-material/Lock";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import SearchIcon from "@mui/icons-material/Search";
import {
  Card,
  Chip,
  FormControl,
  IconButton,
  Tab,
  TableCell,
  Tabs,
  TextField,
  Tooltip,
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import Filters from "../../Components/Filters/Filters";
import BanUser from "../../Components/page-component/users/BanUser";
import RowComponent from "../../Components/shared/table-component/RowComponent";
import TableComponent from "../../Components/shared/table-component/TableComponent";
import TablePaginationComponent from "../../Components/shared/table-component/TablePaginationComponent";
import { BAN_STATUS, getAllUsers } from "../../core/apis/usersAPI";
import useUrlQueries, {
  useLastValidPage,
} from "../../core/custom-hook/useUrlQueries";
import usePermission from "../../core/hooks/usePermission";
import { PERMISSIONS } from "../../core/vairables/Permissions";

// The ban status filter, fed by the API facets (MS-5080).
const BAN_STATUS_TABS = [
  { value: BAN_STATUS.all, label: "All" },
  { value: BAN_STATUS.banned, label: "Banned" },
  { value: BAN_STATUS.active, label: "Active" },
];

// Only the columns the API can sort on (TEOS-111); the others are not clickable.
const SORT_COLUMNS = ["created_at", "email"];
const DEFAULT_SORT = { sortBy: "created_at", sortDirection: "desc" };

const DEFAULT_QUERIES = {
  search: "",
  banStatus: BAN_STATUS.all,
  pageSize: 10,
  page: 0,
  ...DEFAULT_SORT,
};

const toNumber = (value, fallback) => {
  const number = Number.parseInt(value, 10);
  return Number.isNaN(number) || number < 0 ? fallback : number;
};

const isBanStatus = (value) =>
  BAN_STATUS_TABS.some((tab) => tab.value === value);

const readQueries = (searchParams) => {
  const banStatus = searchParams.get("banStatus");
  const sortBy = searchParams.get("sortBy");
  const sortDirection = searchParams.get("sortDirection");
  return {
    search: searchParams.get("search") || "",
    banStatus: isBanStatus(banStatus) ? banStatus : BAN_STATUS.all,
    pageSize: toNumber(searchParams.get("pageSize"), 10) || 10,
    page: toNumber(searchParams.get("page"), 0),
    sortBy: SORT_COLUMNS.includes(sortBy) ? sortBy : DEFAULT_SORT.sortBy,
    sortDirection: ["asc", "desc"].includes(sortDirection)
      ? sortDirection
      : DEFAULT_SORT.sortDirection,
  };
};

function UsersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canBanUsers = usePermission(PERMISSIONS.USERS_BAN);
  // TEOS-287: the table follows the URL on Back / Forward, the search box too
  const [searchQueries, setSearchQueries] = useUrlQueries(readQueries, {
    onUrlChange: (next) => setSearch(next.search),
  });
  const [search, setSearch] = useState(searchQueries.search);
  const [openBan, setOpenBan] = useState({ open: false, data: null });

  const { data, isFetching, isError, error } = useQuery({
    queryKey: ["users", searchQueries],
    queryFn: () =>
      getAllUsers({
        page: searchQueries.page + 1,
        page_size: searchQueries.pageSize,
        ban_status: searchQueries.banStatus,
        search: searchQueries.search?.trim() || undefined,
        sort: searchQueries.sortBy,
        dir: searchQueries.sortDirection,
      }).then((res) => res?.data?.data),
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (isError && !error?.isForbidden) toast.error("Fail to display data");
  }, [isError]);

  const rows = isError ? [] : data?.data || [];
  const totalRows = data?.total_count || 0;
  const facets = data?.facets;

  // TEOS-286: a page past the end (stale URL, rows removed) moves to the last valid page,
  // replacing the out-of-range URL (TEOS-287).
  useLastValidPage({
    page: searchQueries.page,
    pageSize: searchQueries.pageSize,
    totalRows,
    rowCount: rows.length,
    isFetching,
    isError,
    onChange: (page) =>
      setSearchQueries({ ...searchQueries, page }, { replace: true }),
  });

  const refreshUsers = () =>
    queryClient.invalidateQueries({ queryKey: ["users"] });

  const resetFilters = () => {
    setSearchQueries({
      ...DEFAULT_QUERIES,
      banStatus: searchQueries.banStatus,
      sortBy: searchQueries.sortBy,
      sortDirection: searchQueries.sortDirection,
    });
    setSearch("");
  };

  // A new column starts ascending; clicking the same column again flips the direction.
  const requestSort = (key) => {
    if (!SORT_COLUMNS.includes(key)) return;
    const direction =
      searchQueries.sortBy === key && searchQueries.sortDirection === "asc"
        ? "desc"
        : "asc";
    setSearchQueries({
      ...searchQueries,
      sortBy: key,
      sortDirection: direction,
      page: 0,
    });
  };

  const applyFilter = () => {
    // Back to the first page: the filtered list is shorter, so the page being
    // read may not exist any more.
    setSearchQueries({ ...searchQueries, search, page: 0 });
  };

  // Banning is a super admin only action, so is the column that goes with it.
  const tableHeaders = [
    { name: "Name" },
    { name: "Email", sorted: "email" },
    { name: "MSISDN" },
    { name: "Email Verified" },
    { name: "Phone Verified" },
    { name: "Should Notify" },
    { name: "Ban Status" },
    { name: "Created At", sorted: "created_at" },
  ];

  const tableCellStyles = {
    sx: { minWidth: "200px" },
    className: "max-w-[250px] truncate",
  };

  return (
    <Card className="page-card">
      <Filters
        onReset={resetFilters}
        onApply={applyFilter}
        applyDisable={!search?.trim()}
      >
        <Grid container size={{ xs: 12 }} spacing={2}>
          <Grid item size={{ xs: 12, sm: 3 }}>
            <FormControl fullWidth>
              <label className="mb-2" htmlFor="search-input">
                Search
              </label>
              <TextField
                id="search-input"
                fullWidth
                required
                size="small"
                placeholder="Search By Email"
                type="text"
                slotProps={{
                  input: {
                    startAdornment: <SearchIcon sx={{ mr: 1 }} />,
                    autoComplete: "new-password",
                    form: {
                      autoComplete: "off",
                    },
                  },
                }}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                }}
              />
            </FormControl>
          </Grid>
        </Grid>
      </Filters>

      <Tabs
        value={searchQueries.banStatus}
        onChange={(_, banStatus) =>
          setSearchQueries({ ...searchQueries, banStatus, page: 0 })
        }
        aria-label="Ban status"
      >
        {BAN_STATUS_TABS.map((tab) => (
          <Tab
            key={tab.value}
            value={tab.value}
            label={
              facets ? `${tab.label} (${facets?.[tab.value] ?? 0})` : tab.label
            }
          />
        ))}
      </Tabs>

      <TableComponent
        loading={isFetching && !data}
        dataPerPage={searchQueries?.pageSize}
        tableData={rows}
        noDataFound={"No Users Found"}
        tableHeaders={tableHeaders}
        actions={true}
        requestSort={requestSort}
        sortedBy={searchQueries.sortBy}
        sortDirection={searchQueries.sortDirection}
      >
        {rows.map((el) => (
          <RowComponent
            key={el?.id}
            actions={true}
            onView={() => navigate(`/users/${el?.id}`)}
            /*
              Banning sits next to the eye icon, and only for admins having
              the ban permission.
              A closed padlock bans, an open one lifts the ban.
            */
            extraActions={
              canBanUsers ? (
                <Tooltip
                  title={el?.is_banned ? "Unban User" : "Ban User"}
                  placement={"top"}
                >
                  <IconButton
                    color={el?.is_banned ? "primary" : "error"}
                    aria-label={el?.is_banned ? "unban" : "ban"}
                    onClick={() => setOpenBan({ open: true, data: el })}
                  >
                    {el?.is_banned ? (
                      <LockOpenIcon fontSize="small" />
                    ) : (
                      <LockIcon fontSize="small" />
                    )}
                  </IconButton>
                </Tooltip>
              ) : null
            }
          >
            <TableCell {...tableCellStyles}>
              {el?.first_name || el?.last_name
                ? `${el?.first_name || ""} ${el?.last_name || ""}`
                : "N/A"}
            </TableCell>
            <TableCell {...tableCellStyles}>{el?.email || "N/A"}</TableCell>
            <TableCell {...tableCellStyles}>{el?.msisdn || "N/A"}</TableCell>
            <TableCell>
              {el?.email_verified ? (
                <Check color="success" />
              ) : (
                <Close color="error" />
              )}
            </TableCell>
            <TableCell>
              {el?.phone_verified ? (
                <Check color="success" />
              ) : (
                <Close color="error" />
              )}
            </TableCell>
            <TableCell>
              {el?.should_notify ? (
                <Check color="success" />
              ) : (
                <Close color="error" />
              )}
            </TableCell>

            <TableCell sx={{ minWidth: "200px" }}>
              <div className={"flex flex-row items-center gap-[0.5rem]"}>
                <Chip
                  size="small"
                  label={el?.is_banned ? "Banned" : "Active"}
                  color={el?.is_banned ? "error" : "success"}
                />
                {el?.is_banned && el?.banned_until && (
                  <span className={"text-xs whitespace-nowrap"}>
                    {`until ${dayjs(el?.banned_until).format(
                      "DD-MM-YYYY HH:mm",
                    )}`}
                  </span>
                )}
              </div>
            </TableCell>
            <TableCell sx={{ whiteSpace: "nowrap" }}>
              {el?.created_at
                ? dayjs(el?.created_at).format("DD-MM-YYYY HH:mm")
                : "N/A"}
            </TableCell>
          </RowComponent>
        ))}
      </TableComponent>
      <TablePaginationComponent
        totalRows={totalRows}
        page={searchQueries?.page}
        pageSize={searchQueries?.pageSize}
        onPageChange={(e, newPage) => {
          setSearchQueries({ ...searchQueries, page: newPage });
        }}
        onRowsPerPageChange={(e) => {
          setSearchQueries({
            ...searchQueries,
            page: 0,
            pageSize: Number(e.target.value),
          });
        }}
      />

      {openBan?.open && (
        <BanUser
          user={openBan?.data || null}
          onClose={() => setOpenBan({ open: false, data: null })}
          onSuccess={refreshUsers}
        />
      )}
    </Card>
  );
}

export default UsersPage;
