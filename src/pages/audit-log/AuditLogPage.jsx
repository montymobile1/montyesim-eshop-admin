//UTILITIES
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
//COMPONENT
import { Card, FormControl, TableCell } from "@mui/material";
import Grid from "@mui/material/Grid2";
import Filters from "../../Components/Filters/Filters";
import {
  FormDate,
  FormDropdownList,
} from "../../Components/form-component/FormComponent";
import LookupSelect from "../../Components/shared/lookup-select/LookupSelect";
import { USERS_LOOKUP_MIN_SEARCH } from "../../Components/shared/lookup-select/lookupLoadOptions";
import RowComponent from "../../Components/shared/table-component/RowComponent";
import TableComponent from "../../Components/shared/table-component/TableComponent";
import TablePaginationComponent from "../../Components/shared/table-component/TablePaginationComponent";
import { getAllAuditLogs } from "../../core/apis/auditLogAPI";
import { getUsersLookup } from "../../core/apis/lookupsAPI";
import useQueryParams from "../../core/custom-hook/useQueryParams";
import { actorLabel, formatAuditDate } from "../../core/helpers/auditJson";
import AuditLogDetail from "./AuditLogDetail";
import { isCalendarDay } from "../../core/helpers/apiDates";

// Same values as the API enums (GET /audit-log ?table, ?operation).
export const AUDIT_TABLES = [
  "bundle",
  "app_config",
  "auth.users",
  "tag_group",
  "promotion",
  "voucher",
  "banner",
  "promotion_rule",
  "bundle_tag",
  "tag",
];
export const AUDIT_OPERATIONS = ["INSERT", "UPDATE", "DELETE", "BAN", "UNBAN", "BULK"];

const DEFAULT_QUERIES = {
  pageSize: 10,
  page: 0,
  table: "",
  operation: "",
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

/*
  Reads the filters from the URL. A stale URL with a value the API does not
  accept (unknown table, operation or date) falls back to the defaults and is
  reported once.
*/
export const readAuditQueries = (searchParams) => {
  const table = searchParams.get("table") || "";
  const operation = searchParams.get("operation") || "";
  const from = searchParams.get("from") || "";
  const to = searchParams.get("to") || "";
  const invalid =
    (table && !AUDIT_TABLES.includes(table)) ||
    (operation && !AUDIT_OPERATIONS.includes(operation)) ||
    (from && !isDate(from)) ||
    (to && !isDate(to));
  if (invalid) {
    return { queries: { ...DEFAULT_QUERIES }, invalid: true };
  }
  return {
    queries: {
      pageSize: toNumber(searchParams.get("pageSize"), 10) || 10,
      page: toNumber(searchParams.get("page"), 0),
      table,
      operation,
      changed_by: searchParams.get("changed_by") || "",
      changed_by_email: searchParams.get("changed_by_email") || "",
      from,
      to,
    },
    invalid: false,
  };
};

const AuditLogPage = () => {
  const [searchParams] = useSearchParams();
  const [initial] = useState(() => readAuditQueries(searchParams));
  const [searchQueries, setSearchQueries] = useState(initial.queries);
  const [openDetail, setOpenDetail] = useState({ open: false, id: null });
  const [table, setTable] = useState(initial.queries.table);
  const [operation, setOperation] = useState(initial.queries.operation);
  const [admin, setAdmin] = useState(() =>
    initial.queries.changed_by
      ? {
          id: initial.queries.changed_by,
          value: initial.queries.changed_by,
          label: initial.queries.changed_by_email || initial.queries.changed_by,
        }
      : null
  );
  const [from, setFrom] = useState(initial.queries.from);
  const [to, setTo] = useState(initial.queries.to);
  const rangeError =
    from && to && to < from ? "\"To\" must be on or after \"From\"" : "";

  useEffect(() => {
    if (initial.invalid) {
      toast.info("The filters in the link were not valid and have been reset");
    }
  }, [initial.invalid]);

  const { page, pageSize } = searchQueries;

  const { data, isFetching, isError, error } = useQuery({
    queryKey: ["audit-log", searchQueries],
    queryFn: () =>
      getAllAuditLogs({
        page: page + 1,
        page_size: pageSize,
        table: searchQueries.table || undefined,
        operation: searchQueries.operation || undefined,
        changed_by: searchQueries.changed_by || undefined,
        from: searchQueries.from || undefined,
        to: searchQueries.to || undefined,
      }),
  });

  // on error: toast + the table with its empty row (no separate error state)
  useEffect(() => {
    if (isError && !error?.isForbidden) toast.error("Failed to load the audit log");
  }, [isError]);

  const handleQueryParams = useQueryParams(searchQueries);

  useEffect(() => {
    handleQueryParams();
  }, [searchQueries]);

  const rows = data?.data?.data?.data || [];
  const totalRows = data?.data?.data?.total_count || 0;
  const byTable = data?.data?.data?.facets?.by_table || {};

  // A page past the end (stale URL) moves to the last valid page.
  useEffect(() => {
    if (!isFetching && rows.length === 0 && totalRows > 0 && page > 0) {
      setSearchQueries((current) => ({
        ...current,
        page: Math.max(0, Math.ceil(totalRows / pageSize) - 1),
      }));
    }
  }, [isFetching, rows.length, totalRows, page, pageSize]);

  const tableOptions = AUDIT_TABLES.map((name) => ({
    id: name,
    name: byTable[name] !== undefined ? `${name} (${byTable[name]})` : name,
  }));
  const operationOptions = AUDIT_OPERATIONS.map((name) => ({ id: name, name }));

  const applyFilter = () => {
    if (rangeError) return;
    setSearchQueries({
      ...searchQueries,
      table,
      operation,
      changed_by: admin?.id || "",
      changed_by_email: admin?.id ? admin?.label || "" : "",
      from,
      to,
      page: 0,
    });
  };

  const resetFilters = () => {
    setTable("");
    setOperation("");
    setAdmin(null);
    setFrom("");
    setTo("");
    setSearchQueries({ ...DEFAULT_QUERIES, pageSize });
  };

  const tableHeaders = [
    { name: "Table Name" },
    { name: "Operation" },
    { name: "Changed By" },
    { name: "Changed At" },
    { name: "Rows Affected" },
    { name: "Reason" },
    { name: "IP Address" },
  ];

  const tableCellStyles = {
    sx: { minWidth: "150px" },
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
              <label className="mb-2">Table Name</label>
              <FormDropdownList
                placeholder={"Select Table"}
                value={tableOptions.find((el) => el.id === table) || null}
                data={tableOptions}
                accessName={"name"}
                onChange={(value) => setTable(value?.id || "")}
              />
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 2 }}>
            <FormControl fullWidth>
              <label className="mb-2">Operation</label>
              <FormDropdownList
                placeholder={"Select Operation"}
                value={operationOptions.find((el) => el.id === operation) || null}
                data={operationOptions}
                accessName={"name"}
                onChange={(value) => setOperation(value?.id || "")}
              />
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }}>
            <FormControl fullWidth>
              <label className="mb-2" htmlFor="audit-admin-input">
                Admin
              </label>
              <LookupSelect
                inputId="audit-admin-input"
                fetcher={getUsersLookup}
                minSearchLength={USERS_LOOKUP_MIN_SEARCH}
                value={admin}
                placeholder={"Select Admin Email"}
                onChange={(value) => setAdmin(value)}
              />
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 2 }}>
            <FormControl fullWidth>
              <label className="mb-2">From</label>
              <FormDate value={from} onChange={(value) => setFrom(value)} />
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 2 }}>
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
        noDataFound={"No audit entries"}
        tableHeaders={tableHeaders}
        actions={true}
      >
        {rows.map((el) => (
          <RowComponent
            key={el?.id}
            row={el}
            actions={true}
            onView={() => setOpenDetail({ open: true, id: el?.id })}
          >
            <TableCell {...tableCellStyles}>
              {el?.table_name || "N/A"}
            </TableCell>
            <TableCell {...tableCellStyles}>
              {el?.operation || "N/A"}
            </TableCell>
            <TableCell {...tableCellStyles}>
              {actorLabel(el?.changed_by)}
            </TableCell>
            <TableCell {...tableCellStyles}>
              {formatAuditDate(el?.changed_at)}
            </TableCell>
            <TableCell sx={{ minWidth: "120px" }}>
              {el?.rows_affected ?? "N/A"}
            </TableCell>
            <TableCell {...tableCellStyles}>{el?.reason || "N/A"}</TableCell>
            <TableCell {...tableCellStyles}>
              {el?.ip_address || "N/A"}
              {el?.ip_address && el?.client_reported && (
                <span className="block text-xs opacity-70">
                  IP reported by browser
                </span>
              )}
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

      {openDetail?.open && (
        <AuditLogDetail
          id={openDetail?.id}
          onClose={() => setOpenDetail({ open: false, id: null })}
        />
      )}
    </Card>
  );
};

export default AuditLogPage;
