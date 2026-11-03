//UTILITIES
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
//COMPONENT
import { Card, Chip, FormControl, TableCell, TextField } from "@mui/material";
import Grid from "@mui/material/Grid2";
import Filters from "../../Components/Filters/Filters";
import RowComponent from "../../Components/shared/table-component/RowComponent";
import TableComponent from "../../Components/shared/table-component/TableComponent";
import TablePaginationComponent from "../../Components/shared/table-component/TablePaginationComponent";
import { getAllSettings } from "../../core/apis/settingsAPI";
import useQueryParams from "../../core/custom-hook/useQueryParams";
import usePermission from "../../core/hooks/usePermission";
import { PERMISSIONS } from "../../core/vairables/Permissions";

const toNumber = (value, fallback) => {
  const number = Number.parseInt(value, 10);
  return Number.isNaN(number) || number < 0 ? fallback : number;
};

function Settings() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const canWrite = usePermission(PERMISSIONS.SETTINGS_WRITE);

  const [searchQueries, setSearchQueries] = useState(() => ({
    pageSize: toNumber(searchParams.get("pageSize"), 10) || 10,
    page: toNumber(searchParams.get("page"), 0),
    search: searchParams.get("search") || "",
  }));
  const [search, setSearch] = useState(searchQueries.search);

  const { page, pageSize } = searchQueries;
  const term = searchQueries.search?.trim();

  const { data, isFetching, isError, error } = useQuery({
    queryKey: ["settings", searchQueries],
    queryFn: () =>
      getAllSettings({
        page: page + 1,
        page_size: pageSize,
        ...(term ? { search: term } : {}),
      }),
  });

  useEffect(() => {
    if (isError && !error?.isForbidden) toast.error("Failed to load settings");
  }, [isError]);

  const handleQueryParams = useQueryParams(searchQueries);

  useEffect(() => {
    handleQueryParams();
  }, [searchQueries]);

  // Part of the key name, sent on Apply like the other list filters; starts on page 1.
  const applyFilter = () => {
    setSearchQueries({ ...searchQueries, search: search.trim(), page: 0 });
  };

  const resetFilters = () => {
    setSearch("");
    setSearchQueries({ ...searchQueries, search: "", page: 0 });
  };

  const rows = data?.data?.data?.data || [];
  const totalRows = data?.data?.data?.total_count || 0;

  const tableHeaders = [
    { name: "Key" },
    { name: "Value" },
    { name: "Description" },
    { name: "Created At" },
  ];

  const tableCellStyles = {
    sx: { minWidth: "200px", verticalAlign: "baseline" },
    className: "max-w-[250px] truncate",
  };

  return (
    <Card className="page-card">
      <Filters
        onReset={resetFilters}
        onApply={applyFilter}
        resetButtonName="Clear filters"
      >
        <Grid container size={{ xs: 12 }} spacing={2}>
          <Grid size={{ xs: 12, sm: 3 }}>
            <FormControl fullWidth>
              <label className="mb-2" htmlFor="settings-search-input">
                Key
              </label>
              <TextField
                id="settings-search-input"
                size="small"
                placeholder="Search by key"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </FormControl>
          </Grid>
        </Grid>
      </Filters>
      <TableComponent
        loading={isFetching}
        dataPerPage={pageSize}
        tableData={rows}
        noDataFound={term ? "No settings match this search" : "No settings"}
        tableHeaders={tableHeaders}
        actions={true}
        onEdit={canWrite ? () => navigate("/settings/edit") : undefined}
        onLogs={() => navigate("/settings/logs")}
      >
        {rows.map((el) => (
          <RowComponent key={el?.id} actions={true}>
            <TableCell {...tableCellStyles}>
              <span className="inline-flex items-baseline gap-2">
                {el?.key || "N/A"}
                {el?.editable === false && (
                  <Chip size="small" label="Read only" variant="outlined" />
                )}
              </span>
            </TableCell>
            <TableCell {...tableCellStyles}>
              {el?.value || "N/A"}
            </TableCell>
            <TableCell {...tableCellStyles}>{el?.description || "-"}</TableCell>
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
            pageSize: e.target.value,
          });
        }}
      />
    </Card>
  );
}

export default Settings;
