import SearchIcon from "@mui/icons-material/Search";
import {
  Button,
  Card,
  FormControl,
  Grid2,
  TableCell,
  TablePagination,
  TextField,
} from "@mui/material";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import Filters from "../../Components/Filters/Filters";
import MuiModal from "../../Components/Modals/MuiModal";
import RowComponent from "../../Components/shared/table-component/RowComponent";
import TableComponent from "../../Components/shared/table-component/TableComponent";
import { deleteBanner, getAllBanners } from "../../core/apis/bannersAPI";
import useUrlQueries, {
  useLastValidPage,
} from "../../core/custom-hook/useUrlQueries";
import usePermission from "../../core/hooks/usePermission";
import { PERMISSIONS } from "../../core/vairables/Permissions";

const DEFAULT_QUERIES = { name: "", pageSize: 10, page: 0 };

const toNumber = (value, fallback) => {
  const number = Number.parseInt(value, 10);
  return Number.isNaN(number) || number < 0 ? fallback : number;
};

const readQueries = (searchParams) => ({
  name: searchParams.get("name") || "",
  pageSize: toNumber(searchParams.get("pageSize"), 10) || 10,
  page: toNumber(searchParams.get("page"), 0),
});

const BannersList = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canWrite = usePermission(PERMISSIONS.BANNERS_WRITE);
  // TEOS-289: the URL is the source of truth (TEOS-287): the table follows Back / Forward,
  // the search box too
  const [searchQueries, setSearchQueries] = useUrlQueries(readQueries, {
    onUrlChange: (next) => setSearch(next.name),
  });
  const [search, setSearch] = useState(searchQueries.name);
  const [openDelete, setOpenDelete] = useState({ open: false, data: null });
  const [deleting, setDeleting] = useState(false);

  const { data, isFetching, isError, error } = useQuery({
    queryKey: ["banners", searchQueries],
    queryFn: () =>
      getAllBanners({
        page: searchQueries.page + 1,
        page_size: searchQueries.pageSize,
        search: searchQueries.name?.trim() || undefined,
      }).then((res) => res?.data?.data),
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (isError && !error?.isForbidden) toast.error("Fail to display data");
  }, [isError]);

  const rows = isError ? [] : data?.data || [];
  const totalRows = data?.total_count || 0;

  // TEOS-289: a page past the end (stale URL, rows removed) moves to the last valid page,
  // replacing the out-of-range URL (TEOS-286 / TEOS-287).
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

  const handleDeleteBanner = (banner) => {
    if (deleting) return;
    setDeleting(true);
    deleteBanner(banner?.id)
      .then(() => {
        toast.success("Banner deleted successfully");
        // deleting the last row of a page moves back one page
        if (rows.length === 1 && searchQueries.page > 0) {
          setSearchQueries({ ...searchQueries, page: searchQueries.page - 1 });
        }
      })
      .catch((error) => {
        if (error?.response?.status === 404) {
          toast.info("This banner was already deleted.");
        } else {
          toast.error(error?.message || "Failed to delete banner");
        }
      })
      .finally(() => {
        setDeleting(false);
        setOpenDelete({ data: null, open: false });
        queryClient.invalidateQueries({ queryKey: ["banners"] });
      });
  };

  const resetFilters = () => {
    setSearchQueries(DEFAULT_QUERIES);
    setSearch("");
  };

  const applyFilter = () => {
    setSearchQueries({ ...searchQueries, name: search, page: 0 });
  };

  const tableHeaders = [
    { name: "Title" },
    { name: "Description" },
    { name: "Platform" },
    { name: "Action" },
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
                placeholder="Search by title"
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
        </Grid2>
      </Filters>

      <TableComponent
        loading={isFetching && !data}
        dataPerPage={searchQueries?.pageSize}
        tableData={rows}
        tableHeaders={tableHeaders}
        actions={true}
        onAdd={canWrite ? () => navigate("/banners/add") : undefined}
      >
        {rows.map((el) => (
          <RowComponent
            key={el?.id}
            actions={true}
            onEdit={canWrite ? () => navigate(`/banners/${el?.id}`) : undefined}
            onDelete={
              canWrite ? () => setOpenDelete({ data: el, open: true }) : undefined
            }
          >
            <TableCell {...tableCellStyles}>{el?.title}</TableCell>
            <TableCell {...tableCellStyles}>{el?.description}</TableCell>
            <TableCell {...tableCellStyles}>{el?.platform || "N/A"}</TableCell>
            <TableCell {...tableCellStyles}>{el?.action || "N/A"}</TableCell>
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
        <MuiModal
          open={true}
          onClose={() => setOpenDelete({ data: null, open: false })}
          title={"Notice!"}
          onConfirm={() => handleDeleteBanner(openDelete?.data)}
          // MS-5059: the confirm button is disabled while the delete runs
          buttonChildren={
            <>
              <Button
                variant="outlined"
                onClick={() => setOpenDelete({ data: null, open: false })}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={() => handleDeleteBanner(openDelete?.data)}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Confirm"}
              </Button>
            </>
          }
        >
          <p className={"text-center"}>
            Are you sure you want to delete this banner?
          </p>
        </MuiModal>
      )}
    </Card>
  );
};

export default BannersList;
