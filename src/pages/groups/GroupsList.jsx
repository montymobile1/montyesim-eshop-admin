import SearchIcon from "@mui/icons-material/Search";
import ViewListIcon from "@mui/icons-material/ViewList";
import {
  Card,
  Chip,
  FormControl,
  Grid2,
  Switch,
  Tab,
  TableCell,
  TablePagination,
  Tabs,
  TextField,
} from "@mui/material";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import Filters from "../../Components/Filters/Filters";
import { FormDropdownList } from "../../Components/form-component/FormComponent";
import MuiModal from "../../Components/Modals/MuiModal";
import GroupDeleteNotice from "../../Components/page-component/groups/GroupDeleteNotice";
import ActionsMenu, {
  ActionItem,
} from "../../Components/shared/actions-menu/ActionsMenu";
import RowComponent from "../../Components/shared/table-component/RowComponent";
import TableComponent, {
  TableToolbar,
} from "../../Components/shared/table-component/TableComponent";
import {
  deleteGroup,
  getAllGroups,
  getApiErrorCode,
  getApiErrorDetails,
  toggleGroupStatus,
} from "../../core/apis/groupsAPI";
import useUrlQueries, {
  useLastValidPage,
} from "../../core/custom-hook/useUrlQueries";
import usePermission from "../../core/hooks/usePermission";
import { displayTypes, groupTypes } from "../../core/vairables/EnumData";
import { PERMISSIONS } from "../../core/vairables/Permissions";

const STATUS_TABS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

const DEFAULT_QUERIES = {
  name: "",
  status: "all",
  type: null,
  category: null,
  pageSize: 10,
  page: 0,
};

// TEOS-174: the Type / Category filters keep only the values the API accepts
const typeFrom = (value) =>
  displayTypes.find((option) => String(option.id) === value)?.id ?? null;
const categoryFrom = (value) =>
  groupTypes.find((option) => option.id === value)?.id ?? null;

const toNumber = (value, fallback) => {
  const number = Number.parseInt(value, 10);
  return Number.isNaN(number) || number < 0 ? fallback : number;
};

const readQueries = (searchParams) => {
  const status = searchParams.get("status");
  return {
    name: searchParams.get("name") || "",
    status: STATUS_TABS.some((tab) => tab.value === status) ? status : "all",
    type: typeFrom(searchParams.get("type")),
    category: categoryFrom(searchParams.get("category")),
    pageSize: toNumber(searchParams.get("pageSize"), 10) || 10,
    page: toNumber(searchParams.get("page"), 0),
  };
};

const typeOption = (type) =>
  displayTypes.find((option) => option.id === type) || null;
const categoryOption = (category) =>
  groupTypes.find((option) => option.id === category) || null;

const GroupsList = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canWrite = usePermission(PERMISSIONS.GROUPS_WRITE);
  const canReorder = import.meta.env.VITE_GROUP_TAG_ORDERING == "true";
  // TEOS-287: the table follows the URL on Back / Forward, the filter inputs too
  const [searchQueries, setSearchQueries] = useUrlQueries(readQueries, {
    onUrlChange: (next) => {
      setSearch(next.name);
      setSelectedType(typeOption(next.type));
      setSelectedCategory(categoryOption(next.category));
    },
  });
  const [search, setSearch] = useState(searchQueries.name);
  const [selectedType, setSelectedType] = useState(() =>
    typeOption(searchQueries.type)
  );
  const [selectedCategory, setSelectedCategory] = useState(() =>
    categoryOption(searchQueries.category)
  );
  const [openDelete, setOpenDelete] = useState({ open: false, data: null });
  const [openNotice, setOpenNotice] = useState({ open: false, data: null });
  const [deleting, setDeleting] = useState(false);
  const [openStatus, setOpenStatus] = useState({ open: false, data: null });
  const [togglingStatus, setTogglingStatus] = useState(false);

  const { data, isFetching, isError, error } = useQuery({
    queryKey: ["groups", searchQueries],
    queryFn: () =>
      getAllGroups({
        page: searchQueries.page + 1,
        page_size: searchQueries.pageSize,
        status: searchQueries.status,
        search: searchQueries.name?.trim() || undefined,
        type: searchQueries.type || undefined,
        group_category: searchQueries.category || undefined,
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

  const refreshGroups = () =>
    queryClient.invalidateQueries({ queryKey: ["groups"] });

  const resetFilters = () => {
    setSearchQueries({ ...DEFAULT_QUERIES, status: searchQueries.status });
    setSearch("");
    setSelectedType(null);
    setSelectedCategory(null);
  };

  const applyFilter = () => {
    setSearchQueries({
      ...searchQueries,
      name: search,
      type: selectedType?.id ?? null,
      category: selectedCategory?.id ?? null,
      page: 0,
    });
  };

  const tableHeaders = [
    { name: "Name" },
    { name: "Type" },
    { name: "Category" },
    { name: "Tags" },
    { name: "Bundles" },
    { name: "Is Active" },
    { name: "Created At" },
  ];

  const handleDeleteGroup = () => {
    if (deleting) return;
    const group = openDelete?.data;
    setDeleting(true);
    deleteGroup(group?.id)
      .then(() => {
        toast.success("Group deleted successfully");
        // deleting the last row of a page moves back one page
        if (rows.length === 1 && searchQueries.page > 0) {
          setSearchQueries({ ...searchQueries, page: searchQueries.page - 1 });
        }
      })
      .catch((error) => {
        const status = error?.response?.status;
        if (status === 409 && getApiErrorCode(error) === "linked_bundles") {
          setOpenNotice({
            open: true,
            data: getApiErrorDetails(error)?.bundle_count ?? 0,
          });
        } else if (status === 404) {
          toast.info("This group was already deleted.");
        } else {
          toast.error(error?.message || "Failed to delete group");
        }
      })
      .finally(() => {
        setDeleting(false);
        setOpenDelete({ open: false, data: null });
        refreshGroups();
      });
  };

  // The switch only opens a confirmation; the change is sent on Confirm.
  const handleGroupStatus = () => {
    if (togglingStatus) return;
    const group = openStatus?.data;
    setTogglingStatus(true);
    toggleGroupStatus({ id: group?.id, is_active: !group?.is_active })
      .then(() => {
        toast.success("Group status updated successfully");
      })
      .catch((error) => {
        // 409 no_change: another admin already switched it; the refresh shows the real state
        if (getApiErrorCode(error) !== "no_change") {
          toast.error(error?.message || "Failed to change group status");
        }
      })
      .finally(() => {
        setTogglingStatus(false);
        setOpenStatus({ open: false, data: null });
        refreshGroups();
      });
  };

  return (
    <>
      <Card className="page-card">
        <Filters
          onReset={resetFilters}
          onApply={applyFilter}
          applyDisable={!search && !selectedType && !selectedCategory}
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
                  placeholder="Search By Name"
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
                <label className="mb-2">Type</label>
                <FormDropdownList
                  placeholder={"Select Type"}
                  value={selectedType}
                  data={displayTypes}
                  accessName={"title"}
                  onChange={(value) => setSelectedType(value)}
                />
              </FormControl>
            </Grid2>
            <Grid2 item size={{ xs: 12, sm: 3 }}>
              <FormControl fullWidth>
                <label className="mb-2">Category</label>
                <FormDropdownList
                  placeholder={"Select Category"}
                  value={selectedCategory}
                  data={groupTypes}
                  accessName={"title"}
                  onChange={(value) => setSelectedCategory(value)}
                />
              </FormControl>
            </Grid2>
          </Grid2>
        </Filters>

        {/* actions sit above the status tabs */}
        <TableToolbar
          onAdd={canWrite ? () => navigate("/groups/add") : undefined}
        />

        <Tabs
          value={searchQueries.status}
          onChange={(_, status) =>
            setSearchQueries({ ...searchQueries, status, page: 0 })
          }
          aria-label="Group status"
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
          noDataFound={"No Groups Found"}
          tableHeaders={tableHeaders}
          actions={true}
        >
          {rows.map((el) => (
            <RowComponent key={el?.id} actions={false}>
              <TableCell
                sx={{ minWidth: "200px" }}
                className={"max-w-[250px] truncate"}
              >
                {el?.name}
              </TableCell>
              <TableCell>
                {displayTypes?.find((s) => s?.id === el?.type)?.title || "N/A"}
              </TableCell>
              <TableCell>
                {groupTypes.find((s) => s?.id === el?.group_category)?.title ||
                  "N/A"}
              </TableCell>
              <TableCell>{el?.tag_count ?? 0}</TableCell>
              {/* TEOS-173: distinct bundles using any tag of the group */}
              <TableCell>{el?.bundle_count ?? 0}</TableCell>
              <TableCell
                sx={{ minWidth: "150px" }}
                className={"max-w-[200px] truncate"}
              >
                {/* TEOS-178: the state is written out, not shown by the switch alone */}
                <div className="flex items-center gap-[0.25rem]">
                  <Switch
                    color="success"
                    checked={!!el?.is_active}
                    disabled={!canWrite}
                    onChange={() => setOpenStatus({ open: true, data: el })}
                    name="is_active"
                    inputProps={{ "aria-label": `status of ${el?.name}` }}
                  />
                  <Chip
                    size="small"
                    variant="outlined"
                    label={el?.is_active ? "Active" : "Inactive"}
                    color={el?.is_active ? "success" : "default"}
                  />
                </div>
              </TableCell>
              <TableCell
                sx={{ minWidth: "200px" }}
                className={"max-w-[250px] truncate"}
              >
                {dayjs(el?.created_at).format("DD-MM-YYYY HH:mm")}
              </TableCell>
              <TableCell align={"right"}>
                <ActionsMenu
                  label={`Actions for ${el?.name}`}
                  edit={canWrite}
                  onEdit={() => navigate(`/groups/${el?.id}`)}
                  editDescription={"Change the group's name, type and tags"}
                  delete={canWrite}
                  onDelete={() => setOpenDelete({ open: true, data: el })}
                  deleteDescription={
                    "Remove the group and its tags (only when no bundle uses it)"
                  }
                >
                  {el?.type == 1 && canReorder && canWrite && (
                    <ActionItem
                      icon={<ViewListIcon fontSize="small" />}
                      label={"Reorder tags"}
                      description={"Set the order tags appear in the app"}
                      onClick={() => navigate(`/groups/${el?.id}/reorder`)}
                      color="primary"
                    />
                  )}
                </ActionsMenu>
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
          <MuiModal
            open={true}
            onClose={() => {
              if (!deleting) setOpenDelete({ open: false, data: null });
            }}
            title={"Notice!"}
            onConfirm={() => handleDeleteGroup()}
            submitting={deleting}
            submittingButtonName={"Deleting..."}
          >
            <p className={"text-center"}>
              Are you sure you want to delete{" "}
              <span className={"font-bold"}>
                {openDelete?.data?.name
                  ? `${openDelete?.data?.name}'s`
                  : "this"}{" "}
              </span>{" "}
              group?
            </p>
            {openDelete?.data?.bundle_count > 0 && (
              <p className={"text-center mt-2"}>
                It is used by {openDelete.data.bundle_count}{" "}
                {openDelete.data.bundle_count === 1 ? "bundle" : "bundles"}, so
                the delete will be refused.
              </p>
            )}
          </MuiModal>
        )}
        {openStatus?.open && (
          <MuiModal
            open={true}
            onClose={() => {
              if (!togglingStatus) setOpenStatus({ open: false, data: null });
            }}
            title={
              openStatus?.data?.is_active ? "Deactivate group" : "Activate group"
            }
            confirmButtonName={
              openStatus?.data?.is_active ? "Deactivate" : "Activate"
            }
            onConfirm={handleGroupStatus}
            submitting={togglingStatus}
            submittingButtonName={
              openStatus?.data?.is_active ? "Deactivating..." : "Activating..."
            }
          >
            <p className={"text-center"}>
              {openStatus?.data?.is_active
                ? "Are you sure you want to deactivate "
                : "Are you sure you want to activate "}
              <span className={"font-bold"}>{openStatus?.data?.name}</span>?
            </p>
          </MuiModal>
        )}
      </Card>
      {openNotice?.open && (
        <GroupDeleteNotice
          onClose={() => setOpenNotice({ open: false, data: null })}
          data={openNotice?.data ?? null}
        />
      )}
    </>
  );
};

export default GroupsList;
