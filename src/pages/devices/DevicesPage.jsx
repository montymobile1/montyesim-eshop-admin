//UTILITIES
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { AsyncPaginate } from "react-select-async-paginate";
import { toast } from "react-toastify";
//COMPONENT
import {
  Card,
  Chip,
  FormControl,
  MenuItem,
  Select,
  Tab,
  TableCell,
  Tabs,
  useTheme,
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import Filters from "../../Components/Filters/Filters";
import RowComponent from "../../Components/shared/table-component/RowComponent";
import TableComponent from "../../Components/shared/table-component/TableComponent";
import TablePaginationComponent from "../../Components/shared/table-component/TablePaginationComponent";
import {
  getAllDevices,
  getDevicesFilterUser,
} from "../../core/apis/devicesAPI";
import {
  isSearchTooShort,
  lookupNoOptionsMessage,
  USERS_LOOKUP_MIN_SEARCH,
} from "../../Components/shared/lookup-select/lookupLoadOptions";
import { getUsersLookup } from "../../core/apis/lookupsAPI";
import useUrlQueries, {
  useLastValidPage,
} from "../../core/custom-hook/useUrlQueries";

// Platform tabs, counted by the API facets (TEOS-116).
const PLATFORM_TABS = [
  { value: "all", label: "All" },
  { value: "android", label: "Android" },
  { value: "ios", label: "iOS" },
];

const LOGGED_IN_OPTIONS = [
  { value: "all", label: "All" },
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

// Only the columns the API can sort on; the others are not clickable.
const SORT_COLUMNS = ["created_at", "timestamp_login"];
const DEFAULT_SORT = { sortBy: "created_at", sortDirection: "desc" };

const DEFAULT_QUERIES = {
  pageSize: 10,
  page: 0,
  user: null,
  platform: "all",
  loggedIn: "all",
  ...DEFAULT_SORT,
};

const toNumber = (value, fallback) => {
  const number = Number.parseInt(value, 10);
  return Number.isNaN(number) || number < 0 ? fallback : number;
};

const oneOf = (options, value, fallback) =>
  options.some((option) => option.value === value) ? value : fallback;

const readQueries = (searchParams) => {
  const sortBy = searchParams.get("sortBy");
  const sortDirection = searchParams.get("sortDirection");
  return {
    pageSize: toNumber(searchParams.get("pageSize"), 10) || 10,
    page: toNumber(searchParams.get("page"), 0),
    user: searchParams.get("user") || null,
    platform: oneOf(PLATFORM_TABS, searchParams.get("platform"), "all"),
    loggedIn: oneOf(LOGGED_IN_OPTIONS, searchParams.get("loggedIn"), "all"),
    sortBy: SORT_COLUMNS.includes(sortBy) ? sortBy : DEFAULT_SORT.sortBy,
    sortDirection: ["asc", "desc"].includes(sortDirection)
      ? sortDirection
      : DEFAULT_SORT.sortDirection,
  };
};

const formatDate = (value) =>
  value ? dayjs(value).format("DD-MM-YYYY HH:mm") : "N/A";

const usersLoadOptions = async (search, loadedOptions, { page }) => {
  const pageSize = 10;
  // TEOS-147: a 1-character search sends no request; the menu explains why
  if (isSearchTooShort(search, USERS_LOOKUP_MIN_SEARCH)) {
    return { options: [], hasMore: false, additional: { page } };
  }
  try {
    // trimmed, so blanks never travel as a 1-character search (TEOS-147)
    const res = await getUsersLookup({
      search: search?.trim() || undefined,
      page,
      page_size: pageSize,
    });
    const list = res?.data?.data?.data || [];
    const total = res?.data?.data?.total_count || 0;
    return {
      options: list.map((item) => ({
        ...item,
        value: item.id,
        label: item.label || item.email,
      })),
      hasMore: page * pageSize < total,
      additional: { page: page + 1 },
    };
  } catch {
    return {
      options: [...loadedOptions],
      hasMore: false,
      additional: { page },
    };
  }
};

/*
  Devices (TEOS-116): GET /devices with platform tabs, a "Logged in" filter,
  the user filter and the Created / Last login sort, all kept in the URL.
  The API never returns the push token (fcm_token) or the registration IP
  (originated_ip), and no column shows them.
*/
function DevicesPage() {
  const theme = useTheme();

  const asyncPaginateStyles = theme?.asyncPaginateStyles || {};
  // TEOS-287: the table follows the URL on Back / Forward; another user filter is
  // looked up again from its id (below)
  const [searchQueries, setSearchQueries] = useUrlQueries(readQueries, {
    onUrlChange: (next) =>
      setSelectedUser((current) => (current?.id === next.user ? current : null)),
  });
  const [selectedUser, setSelectedUser] = useState(null);

  const { page, pageSize, user, platform, loggedIn, sortBy, sortDirection } =
    searchQueries;

  const { data, isFetching, isPlaceholderData, isError, error } = useQuery({
    queryKey: ["devices", searchQueries],
    queryFn: () =>
      getAllDevices({
        page: page + 1,
        page_size: pageSize,
        user_id: user || undefined,
        platform,
        logged_in: loggedIn,
        sort: sortBy,
        dir: sortDirection,
      }),
    placeholderData: keepPreviousData,
  });

  // Shows the email of the user filter after a reload (only the id is in the URL).
  const { data: filterUser, isError: filterUserError } = useQuery({
    queryKey: ["users", "lookup", user],
    queryFn: () => getDevicesFilterUser(user),
    enabled: !!user && !selectedUser,
  });

  useEffect(() => {
    if (isError && !error?.isForbidden) toast.error("Failed to load devices");
  }, [isError]);

  useEffect(() => {
    if (user && !selectedUser && (filterUser || filterUserError)) {
      const found = filterUser?.data?.data?.data?.[0];
      setSelectedUser({ id: user, value: user, label: found?.email || user });
    }
  }, [filterUser, filterUserError, user, selectedUser]);

  const rows = isError ? [] : data?.data?.data?.data || [];
  const totalRows = isError ? 0 : data?.data?.data?.total_count || 0;
  const facets = isError ? null : data?.data?.data?.facets;

  // TEOS-286: a page past the end (stale URL, rows removed) moves to the last valid page,
  // replacing the out-of-range URL (TEOS-287).
  useLastValidPage({
    page,
    pageSize,
    totalRows,
    rowCount: rows.length,
    isFetching,
    isError,
    onChange: (last) =>
      setSearchQueries({ ...searchQueries, page: last }, { replace: true }),
  });

  const resetFilters = () => {
    setSearchQueries(DEFAULT_QUERIES);
    setSelectedUser(null);
  };

  const applyFilter = () => {
    setSearchQueries({ ...searchQueries, user: selectedUser?.id, page: 0 });
  };

  // A new column starts ascending; clicking the same column again flips the direction.
  const requestSort = (key) => {
    if (!SORT_COLUMNS.includes(key)) return;
    const direction =
      sortBy === key && sortDirection === "asc" ? "desc" : "asc";
    setSearchQueries({
      ...searchQueries,
      sortBy: key,
      sortDirection: direction,
      page: 0,
    });
  };

  const tableHeaders = [
    { name: "Device ID" },
    { name: "Owner" },
    { name: "Platform" },
    { name: "Manufacturer" },
    { name: "Device Model" },
    { name: "IP Location" },
    { name: "Last Login", sorted: "timestamp_login" },
    { name: "Last Logout" },
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
        applyDisable={!selectedUser}
      >
        <Grid container size={{ xs: 12 }} spacing={2}>
          <Grid item size={{ xs: 12, sm: 3 }}>
            <FormControl fullWidth>
              <label className="mb-2" htmlFor="user-input">
                User
              </label>
              <AsyncPaginate
                inputId="user-input"
                isClearable={true}
                value={selectedUser}
                loadOptions={usersLoadOptions}
                noOptionsMessage={lookupNoOptionsMessage(USERS_LOOKUP_MIN_SEARCH)}
                placeholder={"Select User Email"}
                onChange={(value) => {
                  if (value) {
                    setSelectedUser(value);
                  } else {
                    setSelectedUser(null);
                    setSearchQueries({ ...searchQueries, user: null, page: 0 });
                  }
                }}
                additional={{ page: 1 }}
                isSearchable
                debounceTimeout={300}
                styles={{
                  ...asyncPaginateStyles,
                }}
              />
            </FormControl>
          </Grid>
          <Grid item size={{ xs: 12, sm: 3 }}>
            <FormControl fullWidth size="small">
              <label className="mb-2" id="logged-in-label">
                Logged in
              </label>
              <Select
                labelId="logged-in-label"
                value={loggedIn}
                onChange={(e) =>
                  setSearchQueries({
                    ...searchQueries,
                    loggedIn: e.target.value,
                    page: 0,
                  })
                }
              >
                {LOGGED_IN_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Filters>

      <Tabs
        value={platform}
        onChange={(_, value) => {
          if (value !== platform) {
            setSearchQueries({ ...searchQueries, platform: value, page: 0 });
          }
        }}
        aria-label="Platform"
      >
        {PLATFORM_TABS.map((tab) => (
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
        // TEOS-162: a new tab, page or filter shows the skeleton, not the previous rows
        loading={isFetching && (!data || isPlaceholderData)}
        dataPerPage={pageSize}
        tableData={rows}
        noDataFound={"No Devices Found"}
        tableHeaders={tableHeaders}
        actions={true}
        requestSort={requestSort}
        sortedBy={sortBy}
        sortDirection={sortDirection}
      >
        {rows?.map((el) => (
          <RowComponent key={el?.id} actions={true}>
            <TableCell {...tableCellStyles}>{el?.id || "N/A"}</TableCell>
            <TableCell {...tableCellStyles}>
              {el?.user_email || "Anonymous"}
            </TableCell>
            <TableCell sx={{ whiteSpace: "nowrap" }}>
              {el?.os || "N/A"}
              {el?.is_rooted && (
                <Chip
                  size="small"
                  color="warning"
                  label="Rooted"
                  sx={{ ml: 1 }}
                />
              )}
            </TableCell>
            <TableCell {...tableCellStyles}>
              {el?.manufacturer || "N/A"}
            </TableCell>
            <TableCell {...tableCellStyles}>
              {el?.device_model || "N/A"}
            </TableCell>
            <TableCell {...tableCellStyles}>
              {el?.ip_location || "N/A"}
            </TableCell>
            <TableCell sx={{ whiteSpace: "nowrap" }}>
              {formatDate(el?.timestamp_login)}
            </TableCell>
            <TableCell sx={{ whiteSpace: "nowrap" }}>
              {formatDate(el?.timestamp_logout)}
            </TableCell>
            <TableCell sx={{ whiteSpace: "nowrap" }}>
              {formatDate(el?.created_at)}
            </TableCell>
          </RowComponent>
        ))}
      </TableComponent>
      <TablePaginationComponent
        totalRows={totalRows}
        page={page}
        pageSize={pageSize}
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
    </Card>
  );
}

export default DevicesPage;
