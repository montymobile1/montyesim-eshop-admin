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
  Tab,
  TableCell,
  TablePagination,
  Tabs,
  TextField,
  Tooltip,
} from "@mui/material";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import Filters from "../../Components/Filters/Filters";
import ActivateAllBundles from "../../Components/page-component/bundles/ActivateAllBundles";
import BundleDetail from "../../Components/page-component/bundles/BundleDetail";
import DeactivateAllBundles from "../../Components/page-component/bundles/DeactivateAllBundles";
import ToggleBundleStatus from "../../Components/page-component/bundles/ToggleBundleStatus";
import UpdateBundleName from "../../Components/page-component/bundles/UpdateBundleName";
import ActionsMenu, {
  ActionItem,
} from "../../Components/shared/actions-menu/ActionsMenu";
import LookupSelect from "../../Components/shared/lookup-select/LookupSelect";
import RowComponent from "../../Components/shared/table-component/RowComponent";
import TableComponent, {
  TableToolbar,
} from "../../Components/shared/table-component/TableComponent";
import { getAllBundles } from "../../core/apis/bundlesAPI";
import { getTagsLookup } from "../../core/apis/lookupsAPI";
import useUrlQueries, {
  useLastValidPage,
} from "../../core/custom-hook/useUrlQueries";
import usePermission from "../../core/hooks/usePermission";
import { PERMISSIONS } from "../../core/vairables/Permissions";

const STATUS_TABS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

const DEFAULT_QUERIES = {
  search: "",
  tag_ids: [],
  status: "all",
  pageSize: 10,
  page: 0,
};

const toNumber = (value, fallback) => {
  const number = Number.parseInt(value, 10);
  return Number.isNaN(number) || number < 0 ? fallback : number;
};

const readQueries = (searchParams) => {
  const status = searchParams.get("status");
  return {
    search: searchParams.get("search") || "",
    tag_ids: searchParams.getAll("tag_ids").filter(Boolean),
    status: STATUS_TABS.some((tab) => tab.value === status) ? status : "all",
    pageSize: toNumber(searchParams.get("pageSize"), 10) || 10,
    page: toNumber(searchParams.get("page"), 0),
  };
};

const toTagOption = (item) => ({ ...item, value: item?.id, label: item?.label });

const BundleList = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canWrite = usePermission(PERMISSIONS.BUNDLES_WRITE);
  const canBulk = usePermission(PERMISSIONS.BUNDLES_BULK);
  // TEOS-287: the table follows the URL on Back / Forward, the filter inputs too
  // (a tag already picked keeps its label, a new id shows the id)
  const [searchQueries, setSearchQueries] = useUrlQueries(readQueries, {
    onUrlChange: (next) => {
      setSearch(next.search);
      setSelectedTags((current) =>
        next.tag_ids.map(
          (id) =>
            current.find((tag) => String(tag?.id) === id) || {
              id,
              value: id,
              label: id,
            }
        )
      );
    },
  });
  const [search, setSearch] = useState(searchQueries.search);
  // Tag ids from the URL have no label until the lookup answers (see below).
  const [selectedTags, setSelectedTags] = useState(() =>
    searchQueries.tag_ids.map((id) => ({ id, value: id, label: id }))
  );
  const initialTagIds = useRef(searchQueries.tag_ids);
  const [openDetail, setOpenDetail] = useState({ open: false, data: null });
  const [openUpdate, setOpenUpdate] = useState({ open: false, data: null });
  const [openDeactivateAll, setOpenDeactivateAll] = useState(false);
  const [openActivateAll, setOpenActivateAll] = useState(false);
  const [openToggle, setOpenToggle] = useState({ open: false, data: null });

  const { data, isFetching, isError, error } = useQuery({
    queryKey: ["bundles", searchQueries],
    queryFn: () =>
      getAllBundles({
        page: searchQueries.page + 1,
        page_size: searchQueries.pageSize,
        status: searchQueries.status,
        search: searchQueries.search?.trim() || undefined,
        tag_ids: searchQueries.tag_ids.length ? searchQueries.tag_ids : undefined,
      }).then((res) => res?.data?.data),
    placeholderData: keepPreviousData,
  });

  // After a reload the tag filter only has ids: ?id= on the lookup gives each one its label.
  const { data: restoredTags } = useQuery({
    queryKey: ["tags", "lookup", "restore", initialTagIds.current],
    queryFn: () =>
      Promise.all(
        initialTagIds.current.map((id) =>
          getTagsLookup({ id })
            .then((res) => res?.data?.data?.data?.[0] || null)
            .catch(() => null)
        )
      ),
    enabled: initialTagIds.current.length > 0,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!restoredTags) return;
    setSelectedTags((previous) =>
      previous.map((option) => {
        const found = restoredTags.find((tag) => tag?.id === option?.id);
        return found ? toTagOption(found) : option;
      })
    );
  }, [restoredTags]);

  useEffect(() => {
    if (isError && !error?.isForbidden) toast.error("Fail to display data");
  }, [isError]);

  const rows = isError ? [] : data?.data || [];
  const totalRows = data?.total_count || 0;
  const facets = data?.facets;
  const totals = data?.totals;

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

  const refreshBundles = () =>
    queryClient.invalidateQueries({ queryKey: ["bundles"] });

  // TEOS-167: after a bulk change the list goes back to page 1 of the current tab.
  // Off page 1, the cached pages are only marked stale: the page-1 query loads fresh.
  const refreshAfterBulk = () => {
    if (searchQueries.page === 0) return refreshBundles();
    queryClient.invalidateQueries({ queryKey: ["bundles"], refetchType: "none" });
    setSearchQueries({ ...searchQueries, page: 0 });
  };

  const resetFilters = () => {
    setSearchQueries({ ...DEFAULT_QUERIES, status: searchQueries.status });
    setSearch("");
    setSelectedTags([]);
  };

  const applyFilter = () => {
    setSearchQueries({
      ...searchQueries,
      search,
      tag_ids: (selectedTags || []).map((tag) => tag?.value).filter(Boolean),
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
    if (totals?.inactive_count > 0) {
      setOpenActivateAll(true);
    } else {
      toast.info("All bundles are already active.");
    }
  };

  const handleDeactivateAll = () => {
    if (totals?.active_count > 0) {
      setOpenDeactivateAll(true);
    } else {
      toast.info("All bundles are already inactive.");
    }
  };

  const handleNavigateAssignGroups = (el) => {
    if (!el?.id) {
      return;
    }
    navigate(`/bundles/${el?.id}/assign`);
  };

  return (
    <Card className="page-card">
      <Filters
        onReset={resetFilters}
        onApply={applyFilter}
        applyDisable={(!search || search === "") && selectedTags?.length === 0}
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
              <LookupSelect
                inputId="tags-select"
                isMulti
                fetcher={getTagsLookup}
                permission={PERMISSIONS.TAGS_READ}
                value={selectedTags}
                placeholder={"Select Tags"}
                onChange={(value) => setSelectedTags(value || [])}
              />
            </FormControl>
          </Grid2>
        </Grid2>
      </Filters>

      {/* actions sit above the status tabs */}
      {canBulk && (
        <TableToolbar>
          {totals && (
            <span className={"text-sm mr-auto"}>
              {`${totals?.active_count ?? 0} active / ${
                totals?.inactive_count ?? 0
              } inactive`}
            </span>
          )}
          <Button
            variant="outlined"
            color="primary"
            disabled={isFetching || !totals}
            onClick={handleActivateAll}
          >
            Activate All Bundles
          </Button>
          <Button
            variant="contained"
            color="secondary"
            disabled={isFetching || !totals}
            onClick={handleDeactivateAll}
          >
            Deactivate All Bundles
          </Button>
        </TableToolbar>
      )}

      <Tabs
        value={searchQueries.status}
        onChange={(_, status) =>
          setSearchQueries({ ...searchQueries, status, page: 0 })
        }
        aria-label="Bundle status"
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
        tableHeaders={tableHeaders}
        actions={false}
      >
        {rows.map((el) => (
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
                  Admins with the bundle status permission (super admins, as
                  before the migration) get the toggle, which shows the status
                  by its own state. Everyone else reads it from a chip.
                */}
                {canBulk ? (
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

            <TableCell align={"right"}>
              <ActionsMenu
                label={`Actions for ${el?.bundle_name || el?.data?.bundle_name || el?.id}`}
                view
                onView={() => setOpenDetail({ open: true, data: el })}
                viewDescription={"See the bundle's details"}
                edit={canWrite}
                editLabel={"Edit display name"}
                onEdit={() => setOpenUpdate({ open: true, data: el })}
                editDescription={"Change the name shown in the app"}
              >
                {canWrite && (
                  <ActionItem
                    icon={<LayersIcon fontSize="small" />}
                    label={"Assign to groups"}
                    description={"Choose the groups and tags the bundle appears under"}
                    onClick={() => handleNavigateAssignGroups(el)}
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

      {openUpdate?.open && (
        <UpdateBundleName
          onClose={() => setOpenUpdate({ open: false, data: null })}
          data={openUpdate?.data || null}
          refetchData={refreshBundles}
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
          activeCount={totals?.active_count ?? 0}
          onClose={() => setOpenDeactivateAll(false)}
          onSuccess={refreshAfterBulk}
        />
      )}
      {openActivateAll && (
        <ActivateAllBundles
          inactiveCount={totals?.inactive_count ?? 0}
          onClose={() => setOpenActivateAll(false)}
          onSuccess={refreshAfterBulk}
        />
      )}
      {openToggle?.open && (
        <ToggleBundleStatus
          bundle={openToggle?.data || null}
          onClose={() => setOpenToggle({ open: false, data: null })}
          onSuccess={refreshBundles}
        />
      )}
    </Card>
  );
};

export default BundleList;
