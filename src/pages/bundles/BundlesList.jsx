import { Edit, Visibility } from "@mui/icons-material";
import LayersIcon from "@mui/icons-material/Layers";
import SearchIcon from "@mui/icons-material/Search";
import ToggleOffIcon from "@mui/icons-material/ToggleOff";
import ToggleOnIcon from "@mui/icons-material/ToggleOn";
import {
  Button,
  Card,
  Chip,
  FormControl,
  Grid2,
  IconButton,
  TableCell,
  TablePagination,
  TextField,
  Tooltip,
} from "@mui/material";
import { useTheme } from "@mui/styles";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AsyncPaginate } from "react-select-async-paginate";
import { toast } from "react-toastify";
import Filters from "../../Components/Filters/Filters";
import ActivateAllBundles from "../../Components/page-component/bundles/ActivateAllBundles";
import BundleDetail from "../../Components/page-component/bundles/BundleDetail";
import DeactivateAllBundles from "../../Components/page-component/bundles/DeactivateAllBundles";
import ToggleBundleStatus from "../../Components/page-component/bundles/ToggleBundleStatus";
import UpdateBundleName from "../../Components/page-component/bundles/UpdateBundleName";
import { FormDropdownList } from "../../Components/form-component/FormComponent";
import RowComponent from "../../Components/shared/table-component/RowComponent";
import TableComponent from "../../Components/shared/table-component/TableComponent";
import { getAllBundles } from "../../core/apis/bundlesAPI";
import { getAllBundleTags } from "../../core/apis/tagsAPI";
import useIsSuperAdmin from "../../core/hooks/useIsSuperAdmin";

const BundleList = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const isSuperAdmin = useIsSuperAdmin();
  const asyncPaginateStyles = theme?.asyncPaginateStyles || {};
  const [loading, setLoading] = useState(false);
  const [openDetail, setOpenDetail] = useState({ open: false, data: null });
  const [openUpdate, setOpenUpdate] = useState({ open: false, data: null });
  const [openDeactivateAll, setOpenDeactivateAll] = useState(false);
  const [openActivateAll, setOpenActivateAll] = useState(false);
  const [openToggle, setOpenToggle] = useState({ open: false, data: null });
  const [statusSummary, setStatusSummary] = useState(null);
  const [data, setData] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [totalRows, setTotalRows] = useState(0);
  const [searchQueries, setSearchQueries] = useState({
    name: "",
    pageSize: 10,
    page: 0,
    tags: [],
    isActive: null,
  });

  const statusOptions = [
    { id: "active", name: "Active" },
    { id: "inactive", name: "Inactive" },
  ];

  const getBundles = async () => {
    setLoading(true);

    try {
      const { name, page, pageSize, tags, isActive } = searchQueries;

      getAllBundles(
        page,
        pageSize,
        name,
        tags?.map((el) => {
          return el?.id;
        }),
        isActive,
      )
        .then((res) => {
          setStatusSummary(res?.statusSummary || null);

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
              })),
            );
          }
        })
        .finally(() => {
          setLoading(false);
        });
    } catch (e) {
      toast.error(e?.message || "Fail to display data");
      setLoading(false);
    }
  };

  useEffect(() => {
    getBundles();
  }, [searchQueries]);

  const resetFilters = () => {
    setSearchQueries({
      ...searchQueries,
      name: "",
      tags: [],
      isActive: null,
      page: 0,
    });
    setSearch("");
    setSelectedTags([]);
    setSelectedStatus(null);
  };

  const applyFilter = () => {
    setSearchQueries({
      ...searchQueries,
      name: search,
      tags: selectedTags || [],
      // The dropdown speaks "active" / "inactive", the query speaks is_active.
      isActive: selectedStatus ? selectedStatus?.id === "active" : null,
      page: 0,
    });
  };

  const tableHeaders = [
    { name: "ID" },
    { name: "Code" },
    { name: "Name" },
    { name: "Display Name" },
    { name: "Status" },

    { name: "" },
  ];

  // Nothing to activate / deactivate is not an error, so we just tell the admin.
  const handleActivateAll = () => {
    if (statusSummary?.has_inactive) {
      setOpenActivateAll(true);
    } else {
      toast.info("All bundles are already active.");
    }
  };

  const handleDeactivateAll = () => {
    if (statusSummary?.has_active) {
      setOpenDeactivateAll(true);
    } else {
      toast.info("All bundles are already inactive.");
    }
  };

  const loadTagsOptions = async (search, loadedOptions, { page }) => {
    const pageSize = 10;

    const res = await getAllBundleTags({ page, pageSize, search });
    if (res?.error) {
      return {
        options: [...loadedOptions],
        hasMore: false,
        additional: {
          page: page,
        },
      };
    } else {
      return {
        options: res?.data?.map((item) => ({
          ...item,
          value: item.id,
          label: item.title,
        })),
        hasMore: res?.data?.length === pageSize,
        additional: {
          page: page + 1,
        },
      };
    }
  };

  const handleNavigateAssignGroups = (el) => {
    if (!el.id) {
      return;
    }
    navigate(`/bundles/${el?.id}/assign`);
  };

  return (
    <Card className="page-card">
      <Filters
        onReset={resetFilters}
        onApply={applyFilter}
        applyDisable={
          (!search || search === "") &&
          selectedTags?.length === 0 &&
          !selectedStatus
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
                placeholder="Search"
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
              <label className="mb-2" htmlFor="tags-select">
                Tags
              </label>
              <AsyncPaginate
                inputId="tags-select"
                isMulti={true}
                isClearable={true}
                value={selectedTags}
                loadOptions={loadTagsOptions}
                placeholder={"Select Tags"}
                onChange={(value) => {
                  if (value) {
                    setSelectedTags(value);
                  } else {
                    resetFilters();
                  }
                }}
                additional={{ page: 1 }}
                isSearchable
                debounceTimeout={300}
                styles={{
                  ...asyncPaginateStyles,
                }}
              />
            </FormControl>
          </Grid2>
          <Grid2 item size={{ xs: 12, sm: 3 }}>
            <FormControl fullWidth>
              <label className="mb-2" htmlFor="status-input">
                Status
              </label>
              <FormDropdownList
                placeholder={"Select Status"}
                value={selectedStatus}
                data={statusOptions}
                accessName={"name"}
                onChange={(value) => setSelectedStatus(value)}
              />
            </FormControl>
          </Grid2>
        </Grid2>
      </Filters>

      {isSuperAdmin && (
        <div
          className={
            "w-full flex flex-row flex-wrap justify-end items-center gap-[0.75rem]"
          }
        >
          {statusSummary && (
            <span className={"text-sm mr-auto"}>
              {`${statusSummary?.active_count ?? 0} active / ${
                statusSummary?.inactive_count ?? 0
              } inactive`}
            </span>
          )}
          <Button
            variant="outlined"
            color="primary"
            disabled={loading || !statusSummary}
            onClick={handleActivateAll}
          >
            Activate All Bundles
          </Button>
          <Button
            variant="contained"
            color="secondary"
            disabled={loading || !statusSummary}
            onClick={handleDeactivateAll}
          >
            Deactivate All Bundles
          </Button>
        </div>
      )}

      <TableComponent
        loading={loading}
        dataPerPage={searchQueries?.pageSize}
        tableData={data}
        tableHeaders={tableHeaders}
        actions={false}
      >
        {data?.map((el) => (
          <RowComponent key={el?.id} actions={false}>
            <TableCell
              sx={{ minWidth: "200px" }}
              className={"max-w-[250px] truncate"}
            >
              {el?.id}
            </TableCell>
            <TableCell
              sx={{ minWidth: "200px" }}
              className={"max-w-[250px] truncate"}
            >
              {el?.data?.bundle_info_code}
            </TableCell>
            <TableCell
              sx={{ minWidth: "200px" }}
              className={"max-w-[250px] truncate"}
            >
              {el?.data?.bundle_name || "N/A"}
            </TableCell>
            <TableCell
              sx={{ minWidth: "200px" }}
              className={"max-w-[250px] truncate"}
            >
              {el?.bundle_name || "N/A"}
            </TableCell>
            <TableCell sx={{ minWidth: "160px" }}>
              <div className={"flex flex-row items-center gap-[0.25rem]"}>
                {/*
                  Super admins get the toggle, which already shows the status by
                  its own state. Everyone else cannot change it, so they read it
                  from a chip instead of an empty cell.
                */}
                {isSuperAdmin ? (
                  <Tooltip
                    title={
                      el?.is_active ? "Deactivate Bundle" : "Activate Bundle"
                    }
                    placement={"top"}
                  >
                    <IconButton
                      color={el?.is_active ? "success" : "default"}
                      aria-label={el?.is_active ? "deactivate" : "activate"}
                      onClick={() => {
                        setOpenToggle({ open: true, data: el });
                      }}
                    >
                      {el?.is_active ? (
                        <ToggleOnIcon fontSize="large" />
                      ) : (
                        <ToggleOffIcon fontSize="large" />
                      )}
                    </IconButton>
                  </Tooltip>
                ) : (
                  <Chip
                    size="small"
                    label={el?.is_active ? "Active" : "Inactive"}
                    color={el?.is_active ? "success" : "error"}
                  />
                )}
              </div>
            </TableCell>

            <TableCell className={"whitespace-nowrap"}>
              <Tooltip title={"Assign Group"} placement={"top"}>
                <IconButton
                  color="primary"
                  aria-label="assign"
                  onClick={(event) => {
                    handleNavigateAssignGroups(el);
                  }}
                >
                  <LayersIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title={"Edit Display Name"} placement={"top"}>
                <IconButton
                  color="primary"
                  aria-label="edit"
                  onClick={(event) => {
                    setOpenUpdate({ open: true, data: el });
                  }}
                >
                  <Edit fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title={"View Detail"} placement={"top"}>
                <IconButton
                  color="primary"
                  aria-label="view"
                  onClick={() => {
                    setOpenDetail({ open: true, data: el });
                  }}
                >
                  <Visibility fontSize="small" />
                </IconButton>
              </Tooltip>
            </TableCell>
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
          setSearchQueries({
            ...searchQueries,
            page: 0,
            pageSize: e.target.value,
          });
        }}
      />

      {openUpdate?.open && (
        <UpdateBundleName
          onClose={() => setOpenUpdate({ open: false, data: null })}
          data={openUpdate?.data || null}
          refetchData={getBundles}
        />
      )}
      {openDetail?.open && (
        <BundleDetail
          onClose={() => setOpenDetail({ open: false, data: null })}
          bundle={openDetail?.data?.data}
        />
      )}
      {openDeactivateAll && (
        <DeactivateAllBundles
          onClose={() => setOpenDeactivateAll(false)}
          onSuccess={getBundles}
        />
      )}
      {openActivateAll && (
        <ActivateAllBundles
          inactiveCount={statusSummary?.inactive_count ?? 0}
          onClose={() => setOpenActivateAll(false)}
          onSuccess={getBundles}
        />
      )}
      {openToggle?.open && (
        <ToggleBundleStatus
          bundle={openToggle?.data || null}
          onClose={() => setOpenToggle({ open: false, data: null })}
          onSuccess={getBundles}
        />
      )}
    </Card>
  );
};

export default BundleList;
