//UTILITIES
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
//COMPONENT
import SearchIcon from "@mui/icons-material/Search";
import { Card, FormControl, TableCell, TextField } from "@mui/material";
import Grid from "@mui/material/Grid2";
import { toast } from "react-toastify";
import Filters from "../../Components/Filters/Filters";
import { FormDate } from "../../Components/form-component/FormComponent";
import ContactMessageText from "../../Components/page-component/contact-us/ContactMessageText";
import ContactUsDetail from "../../Components/page-component/contact-us/ContactUsDetail";
import RowComponent from "../../Components/shared/table-component/RowComponent";
import TableComponent from "../../Components/shared/table-component/TableComponent";
import TablePaginationComponent from "../../Components/shared/table-component/TablePaginationComponent";
import { getAllMessages } from "../../core/apis/contactusAPI";
import useUrlQueries, {
  useLastValidPage,
} from "../../core/custom-hook/useUrlQueries";
import { formatAuditDate } from "../../core/helpers/auditJson";
import { isCalendarDay } from "../../core/helpers/apiDates";

// Same limit as the API (GET /contact-us ?search, max 100 characters).
const SEARCH_MAX_LENGTH = 100;

const DEFAULT_QUERIES = { search: "", from: "", to: "", pageSize: 10, page: 0 };

const toNumber = (value, fallback) => {
  const number = Number.parseInt(value, 10);
  return Number.isNaN(number) || number < 0 ? fallback : number;
};

// TEOS-274: an impossible month or day ("2026-99-99") is not a date
const isDate = isCalendarDay;

/*
  Reads the filters from the URL; a search longer than the API accepts is cut
  to 100 characters and a date that is not YYYY-MM-DD is ignored.
*/
const readContactUsQueries = (searchParams) => {
  const from = searchParams.get("from") || "";
  const to = searchParams.get("to") || "";
  return {
    search: (searchParams.get("search") || "").slice(0, SEARCH_MAX_LENGTH),
    from: isDate(from) ? from : "",
    to: isDate(to) ? to : "",
    pageSize: toNumber(searchParams.get("pageSize"), 10) || 10,
    page: toNumber(searchParams.get("page"), 0),
  };
};

function ContactusPage() {
  // TEOS-287: the table follows the URL on Back / Forward, the filter inputs too
  const [searchQueries, setSearchQueries] = useUrlQueries(readContactUsQueries, {
    onUrlChange: (next) => {
      setSearch(next.search);
      setFrom(next.from);
      setTo(next.to);
    },
  });
  const [search, setSearch] = useState(searchQueries.search);
  const [from, setFrom] = useState(searchQueries.from);
  const [to, setTo] = useState(searchQueries.to);
  const [openDetail, setOpenDetail] = useState({ id: null, details: null });
  const rangeError =
    from && to && to < from ? "\"To\" must be on or after \"From\"" : "";

  const { page, pageSize } = searchQueries;

  const { data, isFetching, isError, error } = useQuery({
    queryKey: ["contact-us", searchQueries],
    queryFn: () =>
      getAllMessages({
        page: page + 1,
        page_size: pageSize,
        search: searchQueries.search?.trim() || undefined,
        from: searchQueries.from || undefined,
        to: searchQueries.to || undefined,
      }),
  });

  useEffect(() => {
    if (isError && !error?.isForbidden) toast.error("Failed to load messages");
  }, [isError]);

  const rows = data?.data?.data?.data || [];
  const totalRows = data?.data?.data?.total_count || 0;

  // A page past the end (stale URL) moves to the last valid page, replacing the
  // out-of-range URL (TEOS-287).
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

  const tableHeaders = [
    { name: "Email" },
    { name: "Content" },
    { name: "Created At" },
  ];

  const tableCellStyles = {
    sx: { minWidth: "200px" },
    className: "max-w-[250px] truncate",
  };

  const resetFilters = () => {
    setSearch("");
    setFrom("");
    setTo("");
    setSearchQueries({ ...DEFAULT_QUERIES, pageSize });
  };

  const applyFilter = () => {
    if (rangeError) return;
    setSearchQueries({ ...searchQueries, search, from, to, page: 0 });
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
          <Grid size={{ xs: 12, sm: 4 }}>
            <FormControl fullWidth>
              <label className="mb-2" htmlFor="contact-search-input">
                Search
              </label>
              <TextField
                id="contact-search-input"
                fullWidth
                size="small"
                placeholder="Search by email or message"
                type="text"
                slotProps={{
                  input: {
                    startAdornment: <SearchIcon sx={{ mr: 1 }} />,
                    autoComplete: "new-password",
                    form: {
                      autoComplete: "off",
                    },
                  },
                  htmlInput: { maxLength: SEARCH_MAX_LENGTH },
                }}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value.slice(0, SEARCH_MAX_LENGTH));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyFilter();
                }}
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
        noDataFound={"No Messages Found"}
        tableHeaders={tableHeaders}
        actions={true}
      >
        {rows?.map((el) => (
          <RowComponent
            key={el?.id}
            actions={true}
            onView={() =>
              setOpenDetail({
                id: el?.id,
                details: el,
              })
            }
          >
            <TableCell {...tableCellStyles}>
              {el?.email ? (
                <a
                  href={`mailto:${el.email}`}
                  className="underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {el.email}
                </a>
              ) : (
                "N/A"
              )}
            </TableCell>
            <TableCell sx={{ minWidth: "250px", maxWidth: "400px" }}>
              <ContactMessageText content={el?.content} />
            </TableCell>
            <TableCell {...tableCellStyles}>
              {formatAuditDate(el?.created_at)}
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

      {openDetail?.id && (
        <ContactUsDetail
          onClose={() => setOpenDetail(null)}
          data={openDetail?.details || ""}
        />
      )}
    </Card>
  );
}

export default ContactusPage;
