//UTILITIES
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
//COMPONENT
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { Card, FormControl, IconButton, TableCell, TextField } from "@mui/material";
import Grid from "@mui/material/Grid2";
import Filters from "../../Components/Filters/Filters";
import { FormDate } from "../../Components/form-component/FormComponent";
import LookupSelect from "../../Components/shared/lookup-select/LookupSelect";
import { USERS_LOOKUP_MIN_SEARCH } from "../../Components/shared/lookup-select/lookupLoadOptions";
import RowComponent from "../../Components/shared/table-component/RowComponent";
import TableComponent from "../../Components/shared/table-component/TableComponent";
import TablePaginationComponent from "../../Components/shared/table-component/TablePaginationComponent";
import { getUsersLookup } from "../../core/apis/lookupsAPI";
import { getSettingsHistory } from "../../core/apis/settingsAPI";
import useUrlQueries, {
  useLastValidPage,
} from "../../core/custom-hook/useUrlQueries";
import { actorLabel, formatAuditDate } from "../../core/helpers/auditJson";
import SettingsLogsDetail from "./SettingsLogsDetail";
import { isCalendarDay } from "../../core/helpers/apiDates";

const DEFAULT_QUERIES = {
  pageSize: 10,
  page: 0,
  key: "",
  changed_by: "",
  changed_by_email: "",
  from: "",
  to: "",
};

const toNumber = (value, fallback) => {
  const number = Number.parseInt(value, 10);
  return Number.isNaN(number) || number < 0 ? fallback : number;
};

// TEOS-274: an impossible month or day ("2026-99-99") is not a date
const isDate = isCalendarDay;

const readQueries = (searchParams) => ({
  pageSize: toNumber(searchParams.get("pageSize"), 10) || 10,
  page: toNumber(searchParams.get("page"), 0),
  key: searchParams.get("key") || "",
  changed_by: searchParams.get("changed_by") || "",
  changed_by_email: searchParams.get("changed_by_email") || "",
  from: isDate(searchParams.get("from")) ? searchParams.get("from") : "",
  to: isDate(searchParams.get("to")) ? searchParams.get("to") : "",
});

const adminOption = (queries) =>
  queries.changed_by
    ? {
        id: queries.changed_by,
        value: queries.changed_by,
        label: queries.changed_by_email || queries.changed_by,
      }
    : null;

// "to" before "from" is refused before any request.
export const dateRangeError = (from, to) =>
  from && to && to < from ? "\"To\" must be on or after \"From\"" : "";

const SettingsLogs = () => {
  // TEOS-287: the table follows the URL on Back / Forward, the filter inputs too
  const [searchQueries, setSearchQueries] = useUrlQueries(readQueries, {
    onUrlChange: (next) => {
      setKeyInput(next.key);
      setAdmin(adminOption(next));
      setFrom(next.from);
      setTo(next.to);
    },
  });
  const [expand, setExpand] = useState(null);
  const [keyInput, setKeyInput] = useState(searchQueries.key);
  const [admin, setAdmin] = useState(() => adminOption(searchQueries));
  const [from, setFrom] = useState(searchQueries.from);
  const [to, setTo] = useState(searchQueries.to);
  const rangeError = dateRangeError(from, to);

  const { page, pageSize } = searchQueries;

  const { data, isFetching, isError, error } = useQuery({
    queryKey: ["settings-history", searchQueries],
    queryFn: () =>
      getSettingsHistory({
        page: page + 1,
        page_size: pageSize,
        key: searchQueries.key || undefined,
        changed_by: searchQueries.changed_by || undefined,
        from: searchQueries.from || undefined,
        to: searchQueries.to || undefined,
      }),
  });

  // on error: toast + the table with its empty row (no separate error state)
  useEffect(() => {
    if (isError && !error?.isForbidden) toast.error("Failed to load the settings history");
  }, [isError]);

  const rows = data?.data?.data?.data || [];
  const totalRows = data?.data?.data?.total_count || 0;

  // A page past the end (stale URL, rows removed) moves to the last valid page,
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

  const applyFilter = () => {
    if (rangeError) return;
    setSearchQueries({
      ...searchQueries,
      key: keyInput.trim(),
      changed_by: admin?.id || "",
      changed_by_email: admin?.id ? admin?.label || "" : "",
      from,
      to,
      page: 0,
    });
  };

  const resetFilters = () => {
    setKeyInput("");
    setAdmin(null);
    setFrom("");
    setTo("");
    setSearchQueries({ ...DEFAULT_QUERIES, pageSize });
  };

  const tableHeaders = [
    { name: "User" },
    { name: "Updated At" },
    { name: "IP Address" },
    { name: "Changed Keys" },
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
        applyDisable={!!rangeError}
        resetButtonName="Clear filters"
      >
        <Grid container size={{ xs: 12 }} spacing={2}>
          <Grid size={{ xs: 12, sm: 3 }}>
            <FormControl fullWidth>
              <label className="mb-2" htmlFor="settings-key-input">
                Key
              </label>
              <TextField
                id="settings-key-input"
                size="small"
                placeholder="Exact key"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
              />
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }}>
            <FormControl fullWidth>
              <label className="mb-2" htmlFor="settings-admin-input">
                Admin
              </label>
              <LookupSelect
                inputId="settings-admin-input"
                fetcher={getUsersLookup}
                minSearchLength={USERS_LOOKUP_MIN_SEARCH}
                value={admin}
                placeholder={"Select Admin Email"}
                onChange={(value) => setAdmin(value)}
              />
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }}>
            <FormControl fullWidth>
              <label className="mb-2">From</label>
              <FormDate value={from} onChange={(value) => setFrom(value)} />
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }}>
            <FormControl fullWidth>
              <label className="mb-2">To</label>
              <FormDate
                value={to}
                onChange={(value) => setTo(value)}
                helperText={rangeError}
              />
            </FormControl>
          </Grid>
        </Grid>
      </Filters>

      <TableComponent
        loading={isFetching}
        dataPerPage={pageSize}
        tableData={rows}
        noDataFound={"No changes recorded"}
        tableHeaders={tableHeaders}
        actions={true}
      >
        {rows.map((el) => (
          <RowComponent
            openCollapse={expand == el?.id}
            key={el?.id}
            actions={false}
            colSpan={5}
            row={el}
            collapseComponent={<SettingsLogsDetail data={el} />}
          >
            <TableCell {...tableCellStyles}>
              {actorLabel(el?.changed_by)}
            </TableCell>
            <TableCell {...tableCellStyles}>
              {formatAuditDate(el?.changed_at)}
            </TableCell>
            <TableCell {...tableCellStyles}>
              {el?.ip_address || "N/A"}
            </TableCell>
            <TableCell {...tableCellStyles}>
              {el?.parse_error ? "N/A" : el?.changes?.length || 0}
            </TableCell>
            <TableCell>
              <IconButton
                aria-label="expand"
                onClick={() => {
                  setExpand(expand == el?.id ? null : el?.id);
                }}
              >
                <KeyboardArrowDownIcon />
              </IconButton>
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
            pageSize: e.target.value,
          });
        }}
      />
    </Card>
  );
};

export default SettingsLogs;
