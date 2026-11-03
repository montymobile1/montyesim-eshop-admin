//UTILITIES
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { saveAs } from "file-saver";
import { useEffect, useState } from "react";
import CountUp from "react-countup";
import { toast } from "react-toastify";
//COMPONENT
import SearchIcon from "@mui/icons-material/Search";
import { FileDownload } from "@mui/icons-material";
import {
  Button,
  Card,
  CircularProgress,
  FormControl,
  Grid2,
  TableCell,
  TablePagination,
  TextField,
} from "@mui/material";
import Filters from "../../Components/Filters/Filters";
import { FormDate } from "../../Components/form-component/FormComponent";
import LookupSelect from "../../Components/shared/lookup-select/LookupSelect";
import { USERS_LOOKUP_MIN_SEARCH } from "../../Components/shared/lookup-select/lookupLoadOptions";
import RowComponent from "../../Components/shared/table-component/RowComponent";
import TableComponent from "../../Components/shared/table-component/TableComponent";
import TagComponent from "../../Components/shared/tag-component/TagComponent";
import { getUsersLookup } from "../../core/apis/lookupsAPI";
import {
  exportFileName,
  exportReferrals,
  getAllReferrals,
  getReferralsFilterUser,
  readExportError,
} from "../../core/apis/referralsAPI";
import useUrlQueries, {
  useLastValidPage,
} from "../../core/custom-hook/useUrlQueries";
import usePermission from "../../core/hooks/usePermission";
import { PERMISSIONS } from "../../core/vairables/Permissions";
import { isCalendarDay } from "../../core/helpers/apiDates";

/*
  MS-5057: the referrals list and its export on the admin API.

  Filters (kept in the URL): search (part of the code), from_email ("From User": the email of the
  user who bought with the code), user ("To User": the id of the user whose order it is, as the
  legacy page sent it), date (referral day). Same columns as before.
  Export: POST /referrals/export with the current filters, the file is saved from the response;
  only drawn with admin.referrals.export (super admin).
*/


const toNumber = (value, fallback) => {
  const number = Number.parseInt(value, 10);
  return Number.isNaN(number) || number < 0 ? fallback : number;
};

export const readReferralQueries = (searchParams) => {
  const date = searchParams.get("date") || "";
  return {
    pageSize: toNumber(searchParams.get("pageSize"), 10) || 10,
    page: toNumber(searchParams.get("page"), 0),
    search: searchParams.get("search") || "",
    user: searchParams.get("user") || "",
    from_email: searchParams.get("from_email") || "",
    date: isCalendarDay(date) ? date : "", // TEOS-274: real days only
  };
};

const emailOption = (email) =>
  email ? { id: email, value: email, label: email, email } : null;

export default function Referrals() {
  const canExport = usePermission(PERMISSIONS.REFERRALS_EXPORT);
  // TEOS-287: the table follows the URL on Back / Forward, the filter inputs too
  const [searchQueries, setSearchQueries] = useUrlQueries(readReferralQueries, {
    onUrlChange: (next) => {
      setSearch(next.search);
      setSelectedFromUser(emailOption(next.from_email));
      // another To User is looked up again from its id
      setSelectedUser((current) => (current?.id === next.user ? current : null));
      setReferralDate(next.date);
    },
  });
  const [search, setSearch] = useState(searchQueries.search);
  const [selectedFromUser, setSelectedFromUser] = useState(() =>
    emailOption(searchQueries.from_email)
  );
  const [selectedUser, setSelectedUser] = useState(null);
  const [referralDate, setReferralDate] = useState(searchQueries.date);
  const [exporting, setExporting] = useState(false);

  const { page, pageSize, user } = searchQueries;

  const listParams = {
    page: page + 1,
    page_size: pageSize,
    user_id: user || undefined,
    search: searchQueries.search || undefined,
    from_email: searchQueries.from_email || undefined,
    date: searchQueries.date || undefined,
  };

  const { data, isFetching, isError, error } = useQuery({
    queryKey: ["referrals", searchQueries],
    queryFn: () => getAllReferrals(listParams).then((res) => res?.data?.data),
    placeholderData: keepPreviousData,
  });

  // Shows the email of the "To User" filter after a reload (only the id is in the URL).
  const { data: filterUser, isError: filterUserError } = useQuery({
    queryKey: ["users", "lookup", user],
    queryFn: () => getReferralsFilterUser(user),
    enabled: !!user && !selectedUser,
  });

  useEffect(() => {
    if (user && !selectedUser && (filterUser || filterUserError)) {
      const found = filterUser?.data?.data?.data?.[0];
      setSelectedUser({ id: user, value: user, label: found?.email || user });
    }
  }, [filterUser, filterUserError, user, selectedUser]);

  useEffect(() => {
    if (isError && !error?.isForbidden) toast.error("Failed to load referral transactions");
  }, [isError]);

  const rows = isError ? [] : data?.data || [];
  const totalRows = data?.total_count || 0;

  // TEOS-237: a page past the end (stale URL, rows removed) moves to the last valid page;
  // TEOS-287: it replaces the out-of-range URL, so Back does not land on it again.
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
    { name: "Refer Code" },
    { name: "Reward Amount" },
    { name: "From User Email" },
    { name: "To User Email" },
    { name: "Order Number" },
    { name: "Order Status" },
    { name: "Usage Status" },
    { name: "Referral Date" },
    { name: "Purchased Date" },
  ];

  const resetFilters = () => {
    setSearchQueries({
      ...searchQueries,
      page: 0,
      search: "",
      user: "",
      from_email: "",
      date: "",
    });
    setSearch("");
    setSelectedFromUser(null);
    setSelectedUser(null);
    setReferralDate("");
  };

  const applyFilter = () => {
    setSearchQueries({
      ...searchQueries,
      page: 0,
      search: search.trim(),
      user: selectedUser?.id || "",
      from_email: selectedFromUser?.email || selectedFromUser?.label || "",
      date: referralDate || "",
    });
  };

  const handleExportClick = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const res = await exportReferrals({
        user_id: user || undefined,
        search: searchQueries.search || undefined,
        from_email: searchQueries.from_email || undefined,
        date: searchQueries.date || undefined,
      });
      saveAs(res?.data, exportFileName());
      toast.success("Exported Successfully");
    } catch (error) {
      const { code, status, message } = await readExportError(error);
      if (code === "too_many_rows") {
        toast.error("Too many rows, narrow the filters");
      } else if (status === 403) {
        toast.error("You are not allowed to export referrals");
      } else {
        toast.error(message || "Failed to export referrals");
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card className="page-card">
      <Filters
        onReset={resetFilters}
        onApply={applyFilter}
        applyDisable={
          !search.trim() && !selectedUser && !selectedFromUser && !referralDate
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
                placeholder="Search by code"
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
          </Grid2>
          <Grid2 item size={{ xs: 12, sm: 3 }}>
            <FormControl fullWidth>
              <label className="mb-2" htmlFor="from-user-input">
                From User
              </label>
              <LookupSelect
                inputId="from-user-input"
                fetcher={getUsersLookup}
                minSearchLength={USERS_LOOKUP_MIN_SEARCH}
                value={selectedFromUser}
                placeholder={"Select User Email"}
                onChange={(value) => setSelectedFromUser(value)}
              />
            </FormControl>
          </Grid2>
          <Grid2 item size={{ xs: 12, sm: 3 }}>
            <FormControl fullWidth>
              <label className="mb-2" htmlFor="to-user-input">
                To User
              </label>
              <LookupSelect
                inputId="to-user-input"
                fetcher={getUsersLookup}
                minSearchLength={USERS_LOOKUP_MIN_SEARCH}
                value={selectedUser}
                placeholder={"Select User Email"}
                onChange={(value) => setSelectedUser(value)}
              />
            </FormControl>
          </Grid2>
          <Grid2 item size={{ xs: 12, sm: 3 }}>
            <FormControl fullWidth>
              <label className="mb-2" htmlFor="referral-date-input">
                Referral Date
              </label>
              <FormDate
                value={referralDate}
                onChange={(value) => setReferralDate(value || "")}
                placeholder="Select referral date"
              />
            </FormControl>
          </Grid2>
        </Grid2>
      </Filters>

      {canExport && (
        <Grid2 className="flex justify-end" size={{ xs: 12 }}>
          <Button
            type="button"
            variant="contained"
            color="primary"
            onClick={handleExportClick}
            startIcon={
              exporting ? (
                <CircularProgress color="inherit" size={18} />
              ) : (
                <FileDownload />
              )
            }
            disabled={exporting}
          >
            {exporting ? "Exporting..." : "Export"}
          </Button>
        </Grid2>
      )}

      <TableComponent
        loading={isFetching && !data}
        dataPerPage={pageSize}
        tableData={rows}
        noDataFound={"No Referral Transactions Found"}
        tableHeaders={tableHeaders}
        actions={false}
      >
        {/* TEOS-236: el.id is the order id and repeats (one row per rewarded side), so the
            index makes the key unique; duplicate keys left old rows mounted after a refetch */}
        {rows.map((el, idx) => (
          <RowComponent key={`${el?.id}-${idx}`} actions={false}>
            <TableCell
              sx={{ minWidth: 140 }}
              className="max-w-[220px] truncate"
            >
              {el?.referral_code || "N/A"}
            </TableCell>
            <TableCell sx={{ minWidth: 140 }}>
              {el?.currency}{" "}
              <CountUp
                start={0}
                end={Number(el?.amount) || 0}
                duration={1.5}
                separator=","
                decimals={2}
              />
            </TableCell>
            <TableCell
              sx={{ minWidth: 220 }}
              className="max-w-[260px] truncate"
            >
              {el?.referred?.email || "N/A"}
            </TableCell>
            <TableCell
              sx={{ minWidth: 220 }}
              className="max-w-[260px] truncate"
            >
              {el?.referrer?.email || "N/A"}
            </TableCell>
            <TableCell
              sx={{ minWidth: 160 }}
              className="max-w-[220px] truncate"
            >
              {el?.id || "N/A"}
            </TableCell>
            <TableCell
              sx={{ minWidth: 160 }}
              className="max-w-[220px] truncate"
            >
              <TagComponent value={el?.order_status} />
            </TableCell>
            <TableCell
              sx={{ minWidth: 160 }}
              className="max-w-[220px] truncate"
            >
              <TagComponent value={el?.status} />
            </TableCell>
            <TableCell sx={{ minWidth: 180 }}>
              {el?.created_at
                ? dayjs(el?.created_at).format("DD-MM-YYYY HH:mm")
                : "N/A"}
            </TableCell>
            <TableCell sx={{ minWidth: 180 }}>
              {el?.payment_time
                ? dayjs(el.payment_time).format("DD-MM-YYYY HH:mm")
                : "N/A"}
            </TableCell>
          </RowComponent>
        ))}
      </TableComponent>

      <TablePagination
        component="div"
        count={totalRows}
        page={page}
        onPageChange={(_, newPage) => {
          setSearchQueries({ ...searchQueries, page: newPage });
        }}
        rowsPerPage={pageSize}
        onRowsPerPageChange={(e) => {
          setSearchQueries({
            ...searchQueries,
            pageSize: Number(e.target.value),
            page: 0,
          });
        }}
      />
    </Card>
  );
}
