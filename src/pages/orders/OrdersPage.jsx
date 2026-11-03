//UTILITIES
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import CountUp from "react-countup";
import { useSearchParams } from "react-router-dom";
import { AsyncPaginate } from "react-select-async-paginate";
import { toast } from "react-toastify";
//COMPONENT
import SearchIcon from "@mui/icons-material/Search";
import {
  Card,
  FormControl,
  Tab,
  TableCell,
  Tabs,
  TextField,
  useTheme,
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import Filters from "../../Components/Filters/Filters";
import {
  FormDateRange,
  FormDropdownList,
} from "../../Components/form-component/FormComponent";
import RowComponent from "../../Components/shared/table-component/RowComponent";
import TableComponent from "../../Components/shared/table-component/TableComponent";
import TablePaginationComponent from "../../Components/shared/table-component/TablePaginationComponent";
import TagComponent from "../../Components/shared/tag-component/TagComponent";
import {
  isSearchTooShort,
  lookupNoOptionsMessage,
  USERS_LOOKUP_MIN_SEARCH,
} from "../../Components/shared/lookup-select/lookupLoadOptions";
import { getUsersLookup } from "../../core/apis/lookupsAPI";
import { getAllOrders, getOrdersFilterUser } from "../../core/apis/ordersAPI";
import useUrlQueries, {
  useLastValidPage,
} from "../../core/custom-hook/useUrlQueries";
import { dateRangeError } from "../promotions/PromoAnalysis";
import { isCalendarDay } from "../../core/helpers/apiDates";

// TEOS-119: tabs with counts from the API `facets` (the status filter is not applied to them).
const STATUS_TABS = [
  { value: "all", label: "All" },
  { value: "success", label: "Success" },
  { value: "pending", label: "Pending" },
  { value: "canceled", label: "Canceled" },
  { value: "failed", label: "Failed" },
];

const paymentStatusOptions = [
  { id: "success", name: "Success" },
  { id: "pending", name: "Pending" },
  { id: "failed", name: "Failed" },
  { id: "canceled", name: "Canceled" },
];

// Only the columns the API can sort on (others are not clickable).
const SORT_COLUMNS = ["created_at", "amount", "order_status"];
const DEFAULT_SORT = { sortBy: "created_at", sortDirection: "desc" };
const SEARCH_MAX = 100;

const DEFAULT_QUERIES = {
  pageSize: 10,
  page: 0,
  status: "all",
  user: null,
  paymentStatus: null,
  search: "",
  from: "",
  to: "",
  ...DEFAULT_SORT,
};

const toNumber = (value, fallback) => {
  const number = Number.parseInt(value, 10);
  return Number.isNaN(number) || number < 0 ? fallback : number;
};

// TEOS-274: an impossible month or day ("2026-99-99") is not a date
const isDate = isCalendarDay;

// Reads the filters from the URL; unknown values fall back to the defaults.
const readQueries = (searchParams) => {
  const sortBy = searchParams.get("sortBy");
  const sortDirection = searchParams.get("sortDirection");
  const status = searchParams.get("status");
  const paymentStatus = searchParams.get("paymentStatus");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const dates = isDate(from) && isDate(to) ? [from, to] : [null, null];
  const datesOk = !dateRangeError(dates);
  return {
    pageSize: toNumber(searchParams.get("pageSize"), 10) || 10,
    page: toNumber(searchParams.get("page"), 0),
    user: searchParams.get("user") || null,
    status: STATUS_TABS.some((tab) => tab.value === status) ? status : "all",
    paymentStatus: paymentStatusOptions.some((el) => el.id === paymentStatus)
      ? paymentStatus
      : null,
    search: (searchParams.get("search") || "").slice(0, SEARCH_MAX),
    from: datesOk && isDate(from) ? from : "",
    to: datesOk && isDate(to) ? to : "",
    sortBy: SORT_COLUMNS.includes(sortBy) ? sortBy : DEFAULT_SORT.sortBy,
    sortDirection: ["asc", "desc"].includes(sortDirection)
      ? sortDirection
      : DEFAULT_SORT.sortDirection,
  };
};

const STALE_URL_NOTICE = "Some filters were not valid; the defaults are restored";

// TEOS-164: true when readQueries replaced a value that was in the URL, so the
// page can say that a stale link was reset instead of doing it silently.
const URL_KEYS = [
  "pageSize",
  "page",
  "status",
  "paymentStatus",
  "from",
  "to",
  "sortBy",
  "sortDirection",
];
const hasReplacedUrlValues = (searchParams, queries) =>
  URL_KEYS.some((key) => {
    const raw = searchParams.get(key);
    return raw != null && raw !== "" && String(queries[key] ?? "") !== raw;
  });

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

function OrdersPage() {
  const theme = useTheme();

  const asyncPaginateStyles = theme?.asyncPaginateStyles || {};
  const [searchParams] = useSearchParams();
  const supportPromo = import.meta.env.VITE_SUPPORT_PROMO == "true";
  const supportReferral = import.meta.env.VITE_APP_REFER_AND_EARN == "true";

  // TEOS-289: the URL is the source of truth (TEOS-287): the table follows Back / Forward,
  // the filter inputs too
  const [searchQueries, setSearchQueries] = useUrlQueries(readQueries, {
    onUrlChange: (next) => {
      // another user is looked up again from its id
      setSelectedUser((current) => (current?.id === next.user ? current : null));
      setSelectedPaymentStatus(
        paymentStatusOptions.find((el) => el.id === next.paymentStatus) || null
      );
      setSearch(next.search);
      setDates([next.from || null, next.to || null]);
    },
  });
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState(
    () =>
      paymentStatusOptions.find((el) => el.id === searchQueries.paymentStatus) ||
      null
  );
  const [search, setSearch] = useState(searchQueries.search);
  const [dates, setDates] = useState([
    searchQueries.from || null,
    searchQueries.to || null,
  ]);

  const {
    page,
    pageSize,
    user,
    status,
    paymentStatus,
    from,
    to,
    sortBy,
    sortDirection,
  } = searchQueries;

  const rangeError = useMemo(() => dateRangeError(dates), [dates]);

  const { data, isFetching, isError, error } = useQuery({
    queryKey: ["orders", searchQueries],
    queryFn: () =>
      getAllOrders({
        page: page + 1,
        page_size: pageSize,
        status,
        user_id: user || undefined,
        payment_status: paymentStatus || undefined,
        search: searchQueries.search?.trim() || undefined,
        from: from || undefined,
        to: to || undefined,
        sort: sortBy,
        dir: sortDirection,
      }),
    placeholderData: keepPreviousData,
    retry: false,
  });

  // Shows the email of the user filter after a reload (only the id is in the URL).
  const { data: filterUser, isError: filterUserError } = useQuery({
    queryKey: ["users", "lookup", user],
    queryFn: () => getOrdersFilterUser(user),
    enabled: !!user && !selectedUser,
  });

  const resetFilters = () => {
    setSearchQueries({ ...DEFAULT_QUERIES, pageSize });
    setSelectedUser(null);
    setSelectedPaymentStatus(null);
    setSearch("");
    setDates([null, null]);
  };

  useEffect(() => {
    if (hasReplacedUrlValues(searchParams, searchQueries)) {
      toast.warning(STALE_URL_NOTICE, { toastId: "orders-stale-url" });
    }
  }, []);

  useEffect(() => {
    if (!isError) return;
    // a stale URL (e.g. a value the API no longer accepts): back to the defaults,
    // page size included (TEOS-164), so the query key changes and the list reloads
    if (error?.response?.status === 422) {
      toast.warning(STALE_URL_NOTICE, { toastId: "orders-stale-url" });
      resetFilters();
      // TEOS-289: a reset of a stale URL replaces it, as a normalised URL does
      setSearchQueries({ ...DEFAULT_QUERIES }, { replace: true });
    } else if (!error?.isForbidden) {
      toast.error("Failed to load orders");
    }
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

  // TEOS-289: a page past the end (stale URL, rows removed) moves to the last valid page,
  // replacing the out-of-range URL (TEOS-286 / TEOS-287).
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
    if (rangeError) return;
    setSearchQueries({
      ...searchQueries,
      user: selectedUser?.id || null,
      paymentStatus: selectedPaymentStatus?.id || null,
      search: search.trim(),
      from: dates?.[0] || "",
      to: dates?.[1] || "",
      page: 0,
    });
  };

  const tableHeaders = [
    { name: "Order ID" },
    { name: "User Email" },
    { name: "User Phone" },
    { name: "Bundle Name" },
    { name: "Amount", sorted: "amount" },
    ...(supportPromo ? [{ name: "Promo Code" }] : []),
    ...(supportReferral ? [{ name: "Referral Code" }] : []),

    { name: "Order Type" },
    { name: "Order Status", sorted: "order_status" },
    { name: "Payment Status" },

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
        applyDisable={
          !!rangeError ||
          (!selectedUser &&
            !selectedPaymentStatus &&
            !search.trim() &&
            !dates?.[0] &&
            !dates?.[1])
        }
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
                size="small"
                placeholder="Order ID, bundle code or promo code"
                type="text"
                slotProps={{
                  input: { startAdornment: <SearchIcon /> },
                  htmlInput: { maxLength: SEARCH_MAX },
                }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </FormControl>
          </Grid>
          <Grid item size={{ xs: 12, sm: 3 }}>
            <FormControl fullWidth>
              <label className="mb-2" htmlFor="user-input">
                User
              </label>

              <AsyncPaginate
                inputId="user-input"
                isClearable={true}
                value={selectedUser}
                placeholder={"Select User Email"}
                loadOptions={usersLoadOptions}
                noOptionsMessage={lookupNoOptionsMessage(USERS_LOOKUP_MIN_SEARCH)}
                onChange={(value) => setSelectedUser(value)}
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
            <FormControl fullWidth>
              <label className="mb-2" htmlFor="payment-status-input">
                Payment Status
              </label>
              <FormDropdownList
                placeholder={"Select Payment Status"}
                value={selectedPaymentStatus}
                data={paymentStatusOptions}
                accessName={"name"}
                onChange={(value) => setSelectedPaymentStatus(value)}
              />
            </FormControl>
          </Grid>
          <Grid item size={{ xs: 12, sm: 3 }}>
            <FormControl fullWidth>
              <label className="mb-2" htmlFor="date-range">
                Date range
              </label>
              <FormDateRange
                placeholder={"Select dates"}
                value={dates}
                onChange={(value) => setDates(value || [null, null])}
                helperText={rangeError}
              />
            </FormControl>
          </Grid>
        </Grid>
      </Filters>

      <Tabs
        value={status}
        onChange={(_, value) =>
          setSearchQueries({ ...searchQueries, status: value, page: 0 })
        }
        aria-label="Order status"
      >
        {STATUS_TABS.map((tab) => (
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
        loading={isFetching}
        dataPerPage={pageSize}
        tableData={rows}
        noDataFound={"No Orders Found"}
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
              {el?.user?.email || "N/A"}
            </TableCell>
            <TableCell {...tableCellStyles}>
              {el?.user?.msisdn || "N/A"}
            </TableCell>
            <TableCell {...tableCellStyles}>
              {el?.bundle_name || "N/A"}
            </TableCell>
            <TableCell {...tableCellStyles}>
              {el?.currency}{" "}
              <CountUp
                start={0}
                end={el?.amount / 100.0} //because the amount is from stripe by cent
                duration={1.5}
                separator=","
                decimals={2}
              />
            </TableCell>
            {supportPromo && (
              <TableCell {...tableCellStyles}>
                {el?.promo_code || "N/A"}
              </TableCell>
            )}
            {supportReferral && (
              <TableCell {...tableCellStyles}>
                {el?.referral_code || "N/A"}
              </TableCell>
            )}

            <TableCell {...tableCellStyles}>
              {el?.order_type || "N/A"}
            </TableCell>
            <TableCell {...tableCellStyles}>
              <TagComponent value={el?.order_status} />
            </TableCell>
            <TableCell {...tableCellStyles}>
              <TagComponent value={el?.payment_status} />
            </TableCell>
            <TableCell {...tableCellStyles}>
              {el?.created_at
                ? dayjs(el?.created_at).format("DD-MM-YYYY HH:mm")
                : "N/A"}
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

export default OrdersPage;
