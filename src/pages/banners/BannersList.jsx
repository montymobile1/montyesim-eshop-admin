import SearchIcon from "@mui/icons-material/Search";
import {
  Card,
  FormControl,
  Grid2,
  TableCell,
  TablePagination,
  TextField,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import Filters from "../../Components/Filters/Filters";
import MuiModal from "../../Components/Modals/MuiModal";
import RowComponent from "../../Components/shared/table-component/RowComponent";
import TableComponent from "../../Components/shared/table-component/TableComponent";
import { deleteBanner, getAllBanners } from "../../core/apis/bannersAPI";

const BundleList = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [openDelete, setOpenDelete] = useState({ open: false, data: null });
  const [data, setData] = useState([]);
  const [search, setSearch] = useState("");
  const [totalRows, setTotalRows] = useState(0);
  const [searchQueries, setSearchQueries] = useState({
    name: "",
    pageSize: 10,
    page: 0,
  });

  const handleDeleteBanner = (banner) => {
    deleteBanner(banner?.id)
      .then((res) => {
        if (res?.status >= 200 && res?.status < 300) {
          toast.success("Banner deleted successfully");
          getBanners();
        } else {
          toast.error(res?.error);
        }
      })
      .catch((error) => {
        toast.error(error?.message || "Failed to delete banner");
      })
      .finally(() => {
        setOpenDelete({ data: null, open: false });
      });
  };

  const getBanners = async () => {
    setLoading(true);

    const { name, page, pageSize } = searchQueries;

    getAllBanners(page, pageSize, name)
      .then((res) => {
        if (res?.error) {
          toast.error(res?.error);
          setLoading(false);
          setData([]);
          setTotalRows(0);
        } else {
          setTotalRows(res?.count);
          setData(
            res?.data?.map((el) => ({
              ...el,
              ...el?.metadata,
            }))
          );
        }
      })
      .catch((e) => {
        toast.error(e?.message || "Fail to display data");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    getBanners();
  }, [searchQueries]);

  const resetFilters = () => {
    setSearchQueries({ ...searchQueries, name: "" });
    setSearch("");
  };

  const applyFilter = () => {
    setSearchQueries({
      ...searchQueries,
      name: search,
    });
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
        loading={loading}
        dataPerPage={searchQueries?.pageSize}
        tableData={data}
        tableHeaders={tableHeaders}
        actions={true}
        onAdd={() => navigate("/banners/add")}
      >
        {data?.map((el) => (
          <RowComponent
            key={el?.id}
            actions={true}
            onEdit={() => {
              navigate(`/banners/${el?.id}`);
            }}
            onDelete={() => setOpenDelete({ data: el, open: true })}
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
        count={totalRows || 0}
        page={searchQueries?.page}
        onPageChange={(value, page) =>
          setSearchQueries({ ...searchQueries, page: page })
        }
        rowsPerPage={searchQueries?.pageSize}
        onRowsPerPageChange={(e) => {
          setSearchQueries({ ...searchQueries, pageSize: e.target.value });
        }}
      />
      {openDelete?.open && (
        <MuiModal
          open={true}
          onClose={() => setOpenDelete({ data: null, open: false })}
          title={"Notice!"}
          onConfirm={() => handleDeleteBanner(openDelete?.data)}
        >
          <p className={"text-center"}>
            Are you sure you want to delete this banner?
          </p>
        </MuiModal>
      )}
    </Card>
  );
};

export default BundleList;
