import SearchIcon from "@mui/icons-material/Search";
import {
  Card,
  FormControl,
  Grid2,
  TableCell,
  TablePagination,
  TextField,
} from "@mui/material";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import Filters from "../../Components/Filters/Filters";
import { FormDateRange } from "../../Components/form-component/FormComponent";
import PromotionDetail from "../../Components/page-component/promotion/PromotionDetail";
import LookupSelect from "../../Components/shared/lookup-select/LookupSelect";
import { USERS_LOOKUP_MIN_SEARCH } from "../../Components/shared/lookup-select/lookupLoadOptions";
import RowComponent from "../../Components/shared/table-component/RowComponent";
import TableComponent from "../../Components/shared/table-component/TableComponent";
import TagComponent from "../../Components/shared/tag-component/TagComponent";
import { getBundlesLookup, getUsersLookup } from "../../core/apis/lookupsAPI";
import { getAllPromotionsUsage } from "../../core/apis/promotionsAPI";
import useUrlQueries, {
  useLastValidPage,
} from "../../core/custom-hook/useUrlQueries";
import { DefaultCurrency } from "../../core/vairables/EnumData";
import { PERMISSIONS } from "../../core/vairables/Permissions";
import { toNumber } from "./promotionHelpers";
import { isCalendarDay } from "../../core/helpers/apiDates";

const MAX_RANGE_DAYS = 366;

const DEFAULT_QUERIES = {
  code: "",
  user_id: "",
  bundle_ids: [],
  from: "",
  to: "",
  pageSize: 10,
  page: 0,
};

// "" when the range is fine, else the message shown under the picker (no request is sent).
export const dateRangeError = ([from, to] = []) => {
  if (!from || !to) return "";
  const start = dayjs(from);
  const end = dayjs(to);
  if (end.isBefore(start, "day")) return "The end date must be after the start date";
  if (end.diff(start, "day") + 1 > MAX_RANGE_DAYS) {
    return `The range is at most ${MAX_RANGE_DAYS} days`;
  }
  return "";
};

const formatAmount = (amount, currency) =>
  `${Number(amount ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency || DefaultCurrency}`;

/*
  MS-5055: promo analysis on GET /promotions/usage (table, filters and paging only; the
  `totals` the API returns are not shown). On error: toast + the table's empty row.
*/
const STALE_URL_NOTICE = "Some filters were not valid; the defaults are restored";

// The from/to dates of the URL, or "" for both when one is not a real day (TEOS-275) or the range is
// not valid (TEOS-288: from after to, or too long), as Orders does. `dropped`: a date in the URL was
// not kept, so the page shows STALE_URL_NOTICE.
export const readUrlDates = (searchParams) => {
  const urlFrom = searchParams.get("from") || "";
  const urlTo = searchParams.get("to") || "";
  const from = isCalendarDay(urlFrom) ? urlFrom : "";
  const to = isCalendarDay(urlTo) ? urlTo : "";
  const kept = dateRangeError([from, to]) ? { from: "", to: "" } : { from, to };
  return { ...kept, dropped: kept.from !== urlFrom || kept.to !== urlTo };
};

const readQueries = (searchParams) => ({
  code: searchParams.get("code") || "",
  user_id: searchParams.get("user_id") || "",
  bundle_ids: searchParams.getAll("bundle_ids").filter(Boolean),
  // TEOS-275 / TEOS-288: an impossible date or a reversed range from the URL is dropped
  from: readUrlDates(searchParams).from,
  to: readUrlDates(searchParams).to,
  pageSize: toNumber(searchParams.get("pageSize"), 10) || 10,
  page: toNumber(searchParams.get("page"), 0),
});

// the options of URL ids, labelled by the id until the lookups answer
const userOption = (id) => (id ? { value: id, label: id } : null);
const bundleOptions = (ids) => ids.map((id) => ({ value: id, label: id, id }));

const PromoAnalysis = () => {
  const [searchParams] = useSearchParams();
  // TEOS-290: the URL is the source of truth (TEOS-287): the table follows Back / Forward,
  // the filter inputs too (a user / bundle already shown keeps its label)
  const [searchQueries, setSearchQueries] = useUrlQueries(readQueries, {
    onUrlChange: (next) => {
      setSearch(next.code);
      setSelectedUser((current) =>
        current?.value === next.user_id ? current : userOption(next.user_id)
      );
      setSelectedBundle((current) =>
        next.bundle_ids.map(
          (id) =>
            (current || []).find((el) => el?.value === id) ||
            bundleOptions([id])[0]
        )
      );
      setDates([next.from || null, next.to || null]);
    },
  });
  const [search, setSearch] = useState(searchQueries.code);
  const [selectedUser, setSelectedUser] = useState(() =>
    userOption(searchQueries.user_id)
  );
  const [selectedBundle, setSelectedBundle] = useState(() =>
    bundleOptions(searchQueries.bundle_ids)
  );
  const [dates, setDates] = useState([
    searchQueries.from || null,
    searchQueries.to || null,
  ]);
  const [openPromoDetail, setOpenPromoDetail] = useState({
    open: false,
    data: null,
  });

  // TEOS-275 / TEOS-288: same notice as Orders when the URL had dates that were not kept
  useEffect(() => {
    if (readUrlDates(searchParams).dropped) {
      toast.warning(STALE_URL_NOTICE, { toastId: "promo-analysis-stale-url" });
    }
  }, []);

  // after a reload (or Back / Forward, TEOS-290) the URL only holds ids: ask the lookups
  // for the labels (?id=) of the ones still labelled by their id
  const bundleKey = searchQueries.bundle_ids.join(",");
  useEffect(() => {
    let cancelled = false;
    const unlabelled = (option) => !option || option.label === option.value;
    if (searchQueries.user_id && unlabelled(selectedUser)) {
      getUsersLookup({ id: searchQueries.user_id })
        .then((res) => {
          const item = res?.data?.data?.data?.[0];
          if (!cancelled && item) {
            setSelectedUser({ ...item, value: item.id, label: item.label });
          }
        })
        .catch(() => {});
    }
    if (searchQueries.bundle_ids.length && (selectedBundle || []).some(unlabelled)) {
      Promise.all(
        searchQueries.bundle_ids.map((id) =>
          getBundlesLookup({ id })
            .then((res) => res?.data?.data?.data?.[0])
            .catch(() => null)
        )
      ).then((items) => {
        if (cancelled) return;
        setSelectedBundle(
          searchQueries.bundle_ids.map((id, index) => ({
            ...(items[index] || {}),
            id,
            value: id,
            label: items[index]?.label || id,
          }))
        );
      });
    }
    return () => {
      cancelled = true;
    };
  }, [searchQueries.user_id, bundleKey]);

  const rangeError = useMemo(() => dateRangeError(dates), [dates]);

  const { data, isFetching, isError, error } = useQuery({
    queryKey: ["promotions", "usage", searchQueries],
    queryFn: () =>
      getAllPromotionsUsage({
        page: searchQueries.page + 1,
        page_size: searchQueries.pageSize,
        code: searchQueries.code?.trim() || undefined,
        user_id: searchQueries.user_id || undefined,
        bundle_ids: searchQueries.bundle_ids.length
          ? searchQueries.bundle_ids
          : undefined,
        from: searchQueries.from || undefined,
        to: searchQueries.to || undefined,
      }).then((res) => res?.data?.data),
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (isError && !error?.isForbidden) toast.error("Fail to display data");
  }, [isError]);

  const rows = isError ? [] : data?.data || [];
  const totalRows = data?.total_count || 0;

  // TEOS-232: a page past the end (stale URL, rows removed) moves to the last valid page;
  // TEOS-290: it replaces the out-of-range URL, so Back does not land on it again.
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

  const resetFilters = () => {
    setSearchQueries({ ...DEFAULT_QUERIES, pageSize: searchQueries.pageSize });
    setSearch("");
    setSelectedUser(null);
    setSelectedBundle([]);
    setDates([null, null]);
  };

  const applyFilter = () => {
    if (rangeError) return;
    setSearchQueries({
      ...searchQueries,
      code: search,
      user_id: selectedUser?.value || "",
      bundle_ids: (selectedBundle || []).map((el) => el?.value).filter(Boolean),
      from: dates?.[0] || "",
      to: dates?.[1] || "",
      page: 0,
    });
  };

  const tableHeaders = [
    { name: "User Email" },
    { name: "User Phone" },
    { name: "Promo Code" },
    { name: "Amount" },
    { name: "Bundle Code" },
    { name: "Status" },
    { name: "Created At" },
  ];

  const cell = {
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
          ((!search || search === "") &&
            !selectedUser &&
            selectedBundle?.length === 0 &&
            !dates?.[0] &&
            !dates?.[1])
        }
      >
        <Grid2 container size={{ xs: 12 }} spacing={2}>
          <Grid2 item size={{ xs: 12, sm: 3 }}>
            <FormControl fullWidth>
              <label className="mb-2" htmlFor="search-input">
                Search
              </label>
              <TextField
                id="search-input"
                fullWidth
                required
                size="small"
                placeholder="Search by promo code"
                type="text"
                slotProps={{
                  input: {
                    startAdornment: <SearchIcon />,
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
          </Grid2>
          <Grid2 item size={{ xs: 12, sm: 3 }}>
            <FormControl fullWidth>
              <label className="mb-2" htmlFor="user-select">
                Users
              </label>
              <LookupSelect
                inputId="user-select"
                fetcher={getUsersLookup}
                minSearchLength={USERS_LOOKUP_MIN_SEARCH}
                permission={PERMISSIONS.USERS_READ}
                value={selectedUser}
                placeholder={"Select User"}
                onChange={(value) => setSelectedUser(value || null)}
              />
            </FormControl>
          </Grid2>
          <Grid2 item size={{ xs: 12, sm: 3 }}>
            <FormControl fullWidth>
              <label className="mb-2" htmlFor="bundles-select">
                Bundles Code
              </label>
              <LookupSelect
                inputId="bundles-select"
                isMulti
                fetcher={getBundlesLookup}
                permission={PERMISSIONS.BUNDLES_READ}
                value={selectedBundle}
                placeholder={"Select Bundles Code"}
                onChange={(value) => setSelectedBundle(value || [])}
              />
            </FormControl>
          </Grid2>
          <Grid2 item size={{ xs: 12, sm: 3 }}>
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
          </Grid2>
        </Grid2>
      </Filters>

      <TableComponent
        loading={isFetching && !data}
        dataPerPage={searchQueries?.pageSize}
        tableData={rows}
        noDataFound={"No usage"}
        tableHeaders={tableHeaders}
        actions={false}
      >
        {rows.map((el) => (
          <RowComponent key={el?.id} actions={false}>
            <TableCell {...cell}>
              {el?.user ? el?.user?.email || "N/A" : "Deleted user"}
            </TableCell>
            <TableCell {...cell}>{el?.user?.msisdn || "N/A"}</TableCell>
            {el?.promotion?.id ? (
              <TableCell
                onClick={() =>
                  setOpenPromoDetail({ open: true, data: el?.promotion?.id })
                }
                sx={{ minWidth: "200px" }}
                className={
                  "max-w-[250px] truncate cursor-pointer underline !text-(--color-secondary)"
                }
              >
                {el?.promotion?.code || el?.promotion_code || "N/A"}
              </TableCell>
            ) : (
              <TableCell {...cell}>
                {el?.promotion_code || "N/A"} (Deleted promotion)
              </TableCell>
            )}
            <TableCell {...cell}>
              {el?.discount_amount != null
                ? formatAmount(el?.discount_amount, el?.currency)
                : "N/A"}
            </TableCell>
            <TableCell {...cell}>
              {el?.bundle_code || el?.bundle_id || "All"}
            </TableCell>
            <TableCell sx={{ minWidth: "100px" }}>
              <TagComponent value={el?.status} />
            </TableCell>
            <TableCell {...cell}>
              {el?.created_at
                ? dayjs(el?.created_at).format("DD-MM-YYYY HH:mm")
                : "N/A"}
            </TableCell>
          </RowComponent>
        ))}
      </TableComponent>
      <TablePagination
        component="div"
        count={totalRows}
        page={searchQueries?.page}
        onPageChange={(_, page) => setSearchQueries({ ...searchQueries, page })}
        rowsPerPage={searchQueries?.pageSize}
        onRowsPerPageChange={(e) => {
          setSearchQueries({
            ...searchQueries,
            page: 0,
            pageSize: e.target.value,
          });
        }}
      />

      {openPromoDetail?.open && (
        <PromotionDetail
          onClose={() => setOpenPromoDetail({ data: null, open: false })}
          id={openPromoDetail?.data}
        />
      )}
    </Card>
  );
};

export default PromoAnalysis;
