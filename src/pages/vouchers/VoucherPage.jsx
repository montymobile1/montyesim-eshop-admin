import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import SearchIcon from "@mui/icons-material/Search";
import {
  Card,
  Chip,
  IconButton,
  Tooltip,
  FormControl,
  Grid2,
  Switch,
  Tab,
  TableCell,
  TablePagination,
  Tabs,
  TextField,
} from "@mui/material";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import CountUp from "react-countup";
import { toast } from "react-toastify";
import Filters from "../../Components/Filters/Filters";
import RowComponent from "../../Components/shared/table-component/RowComponent";
import TableComponent, {
  TableToolbar,
} from "../../Components/shared/table-component/TableComponent";
import {
  DeleteVoucher,
  getAllVouchers,
  getApiErrorCode,
  toggleVoucherStatus,
} from "../../core/apis/vouchersAPI";
import useUrlQueries, {
  useLastValidPage,
} from "../../core/custom-hook/useUrlQueries";
import { copyToClipboard } from "../../core/helpers/clipboard";
import usePermission from "../../core/hooks/usePermission";
import { DefaultCurrency } from "../../core/vairables/EnumData";
import { PERMISSIONS } from "../../core/vairables/Permissions";
import VoucherDeleteModal from "./components/modals/VoucherDeleteModal";
import VoucherFormModal from "./components/modals/VoucherFormModal";

const STATUS_TABS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "used", label: "Used" },
  { value: "expired", label: "Expired" },
];

// Unused and past its expiry (the API sends is_expired; computed for older rows).
// TEOS-214: a voucher is valid until the end of its expiry day, so it is
// expired only when that day is before today.
export const isExpired = (voucher, now = dayjs()) =>
  voucher?.is_expired ??
  (!voucher?.is_used &&
    !!voucher?.expired_at &&
    dayjs(voucher.expired_at).isBefore(now, "day"));

const DEFAULT_QUERIES = { search: "", status: "all", pageSize: 10, page: 0 };

const toNumber = (value, fallback) => {
  const number = Number.parseInt(value, 10);
  return Number.isNaN(number) || number < 0 ? fallback : number;
};

const readQueries = (searchParams) => {
  const status = searchParams.get("status");
  return {
    search: searchParams.get("search") || "",
    status: STATUS_TABS.some((tab) => tab.value === status) ? status : "all",
    pageSize: toNumber(searchParams.get("pageSize"), 10) || 10,
    page: toNumber(searchParams.get("page"), 0),
  };
};

export default function VoucherPage() {
  const queryClient = useQueryClient();
  const canWrite = usePermission(PERMISSIONS.VOUCHERS_WRITE);
  // TEOS-287: the table follows the URL on Back / Forward, the search box too
  const [searchQueries, setSearchQueries] = useUrlQueries(readQueries, {
    onUrlChange: (next) => setSearch(next.search),
  });
  const [search, setSearch] = useState(searchQueries.search);
  const [openDelete, setOpenDelete] = useState({ open: false, data: null });
  const [deleting, setDeleting] = useState(false);
  const [modalCtx, setModalCtx] = useState({ open: false, data: null });

  const { data, isFetching, isError, error } = useQuery({
    queryKey: ["vouchers", searchQueries],
    queryFn: () =>
      getAllVouchers({
        page: searchQueries.page + 1,
        page_size: searchQueries.pageSize,
        status: searchQueries.status,
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

  const refreshVouchers = () =>
    queryClient.invalidateQueries({ queryKey: ["vouchers"] });

  const resetFilters = () => {
    setSearchQueries({ ...DEFAULT_QUERIES, status: searchQueries.status });
    setSearch("");
  };

  const applyFilter = () => {
    setSearchQueries({ ...searchQueries, search, page: 0 });
  };

  const tableHeaders = [
    { name: "Code" },
    { name: "Amount" },
    { name: "Used By" },
    { name: "Expired At" },
    { name: "Created At" },
    { name: "Status" },
  ];

  const tableCellStylesSmall = {
    sx: { minWidth: "150px" },
    className: "max-w-[200px] truncate",
  };

  const tableCellStyles = {
    sx: { minWidth: "200px" },
    className: "max-w-[250px] truncate",
  };

  const handleVoucherStatus = (voucher) => {
    toggleVoucherStatus({ id: voucher?.id, is_active: !voucher?.is_active })
      .then(() => {
        toast.success("Voucher status updated successfully");
      })
      .catch((error) => {
        if (getApiErrorCode(error) === "already_used") {
          toast.info("This voucher has already been used: it can't be activated.");
        } else {
          toast.error(error?.message || "Failed to change voucher status");
        }
      })
      .finally(refreshVouchers);
  };

  const handleDeleteVoucher = () => {
    const voucher = openDelete?.data;
    setDeleting(true);

    DeleteVoucher(voucher?.id)
      .then(() => {
        toast.success("Voucher deleted successfully");
        // deleting the last row of a page moves back one page
        if (rows.length === 1 && searchQueries.page > 0) {
          setSearchQueries({ ...searchQueries, page: searchQueries.page - 1 });
        }
      })
      .catch((error) => {
        const code = getApiErrorCode(error);
        if (code === "voucher_used") {
          // used meanwhile: the refresh below shows it as used
          toast.info("Cannot delete voucher — it has already been used.");
        } else if (error?.response?.status === 404) {
          toast.info("This voucher was already deleted.");
        } else {
          toast.error(error?.message || "Failed to delete voucher");
        }
      })
      .finally(() => {
        setDeleting(false);
        setOpenDelete({ data: null, open: false });
        refreshVouchers();
      });
  };

  const handleOpenDeleteModal = (el) => {
    if (el?.is_used) {
      toast.error("Cannot delete voucher — it has already been used.");
      return;
    }
    setOpenDelete({ data: el, open: true });
  };

  return (
    <Card className="page-card">
      <Filters
        onReset={resetFilters}
        onApply={applyFilter}
        applyDisable={!search || search === ""}
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
        </Grid2>
      </Filters>

      {/* actions sit above the status tabs */}
      <TableToolbar
        onAdd={canWrite ? () => setModalCtx({ open: true, data: null }) : undefined}
      />

      <Tabs
        value={searchQueries.status}
        onChange={(_, status) =>
          setSearchQueries({ ...searchQueries, status, page: 0 })
        }
        aria-label="Voucher status"
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
        loading={isFetching && !data}
        dataPerPage={searchQueries?.pageSize}
        tableData={rows}
        noDataFound={"No vouchers"}
        tableHeaders={tableHeaders}
        actions={true}
      >
        {rows.map((el) => (
          <RowComponent
            key={el?.id}
            actions={true}
            onDelete={
              canWrite && !el?.is_used
                ? () => handleOpenDeleteModal(el)
                : undefined
            }
            extraActions={
              <Tooltip title={"Copy code"} placement={"top"}>
                <IconButton
                  color="primary"
                  aria-label={`copy code ${el?.code}`}
                  onClick={() =>
                    copyToClipboard(el?.code || "", "Code copied")
                  }
                >
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            }
          >
            <TableCell {...tableCellStylesSmall}>
              {el?.code || "N/A"}
            </TableCell>
            <TableCell {...tableCellStylesSmall}>
              {el?.currency || DefaultCurrency}{" "}
              <CountUp
                start={0}
                end={Number(el?.amount) || 0}
                duration={1.5}
                separator=","
                decimals={2}
              />
            </TableCell>
            <TableCell {...tableCellStylesSmall}>
              {el?.used_by?.email || el?.used_by_user?.email || "N/A"}
            </TableCell>
            <TableCell {...tableCellStyles}>
              {el?.expired_at
                ? dayjs(el?.expired_at).format("DD-MM-YYYY")
                : "N/A"}
              {isExpired(el) && (
                <Chip
                  size="small"
                  color="error"
                  variant="outlined"
                  label="Expired"
                  className="ml-2"
                />
              )}
            </TableCell>
            <TableCell {...tableCellStyles}>
              {el?.created_at
                ? dayjs(el?.created_at).format("DD-MM-YYYY HH:mm")
                : "N/A"}
            </TableCell>

            <TableCell sx={{ minWidth: "100px" }}>
              {el?.is_used ? (
                // a used voucher cannot be re-activated (409 already_used)
                <Chip size="small" label="Used" />
              ) : (
                <Switch
                  color="success"
                  checked={!!el?.is_active}
                  disabled={!canWrite}
                  onChange={() => handleVoucherStatus(el)}
                  name="is_active"
                  inputProps={{ "aria-label": `Toggle ${el?.code}` }}
                />
              )}
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

      {openDelete?.open && (
        <VoucherDeleteModal
          setOpenDelete={setOpenDelete}
          openDelete={openDelete}
          handleDeleteVoucher={handleDeleteVoucher}
          deleting={deleting}
        />
      )}
      {modalCtx?.open && (
        <VoucherFormModal
          voucher={modalCtx?.data}
          open={modalCtx?.open}
          onClose={() => setModalCtx({ open: false, data: null })}
          // the form then shows the new code with Copy; Done closes it
          onSuccess={refreshVouchers}
        />
      )}
    </Card>
  );
}
