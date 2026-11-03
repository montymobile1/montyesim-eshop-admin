import SearchIcon from "@mui/icons-material/Search";
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
  Tooltip,
} from "@mui/material";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { formatApiDate } from "../../core/helpers/apiDates";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import Filters from "../../Components/Filters/Filters";
import MuiModal from "../../Components/Modals/MuiModal";
import PromotionDetail from "../../Components/page-component/promotion/PromotionDetail";
import ActionsMenu from "../../Components/shared/actions-menu/ActionsMenu";
import LookupSelect from "../../Components/shared/lookup-select/LookupSelect";
import RowComponent from "../../Components/shared/table-component/RowComponent";
import TableComponent, {
  TableToolbar,
} from "../../Components/shared/table-component/TableComponent";
import {
  getBundlesLookup,
  getPromotionRulesLookup,
} from "../../core/apis/lookupsAPI";
import {
  deletePromotion,
  getAllPromotions,
  getApiErrorCode,
  getApiErrorDetails,
  togglePromotionStatus,
} from "../../core/apis/promotionsAPI";
import useUrlQueries, {
  useLastValidPage,
} from "../../core/custom-hook/useUrlQueries";
import usePermission from "../../core/hooks/usePermission";
import { PERMISSIONS } from "../../core/vairables/Permissions";
import {
  STATUS_TABS,
  statusLabel,
  toNumber,
  valueUnit,
} from "./promotionHelpers";

const DEFAULT_QUERIES = {
  search: "",
  status: "all",
  rule_ids: [],
  bundle_codes: [],
  pageSize: 10,
  page: 0,
};

const readQueries = (searchParams) => {
  const status = searchParams.get("status");
  return {
    search: searchParams.get("search") || "",
    status: STATUS_TABS.some((tab) => tab.value === status) ? status : "all",
    rule_ids: searchParams.getAll("rule_ids").filter(Boolean),
    bundle_codes: searchParams.getAll("bundle_codes").filter(Boolean),
    pageSize: toNumber(searchParams.get("pageSize"), 10) || 10,
    page: toNumber(searchParams.get("page"), 0),
  };
};

const bundleOption = (code) => ({
  value: code,
  label: code,
  bundle_code: code,
});

// TEOS-225: the bundle codes as chips (2 shown, the rest in a "+N" chip with a tooltip); none = "All".
const VISIBLE_BUNDLES = 2;

const BundleChips = ({ codes }) => {
  if (!codes?.length) return "All";
  const hidden = codes.slice(VISIBLE_BUNDLES);
  return (
    <div className="flex flex-wrap items-center gap-1">
      {codes.slice(0, VISIBLE_BUNDLES).map((code) => (
        <Chip key={code} size="small" variant="outlined" label={code} />
      ))}
      {hidden.length > 0 && (
        <Tooltip title={hidden.join(", ")}>
          <Chip
            size="small"
            label={`+${hidden.length}`}
            aria-label={`${hidden.length} more: ${hidden.join(", ")}`}
          />
        </Tooltip>
      )}
    </div>
  );
};

const PromotionsList = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canWrite = usePermission(PERMISSIONS.PROMOTIONS_WRITE);
  // TEOS-287: the table follows the URL on Back / Forward, the filter inputs too
  // (a rule already picked keeps its label, a new id shows the id)
  const [searchQueries, setSearchQueries] = useUrlQueries(readQueries, {
    onUrlChange: (next) => {
      setSearch(next.search);
      setSelectedRule((current) =>
        next.rule_ids.map(
          (id) =>
            current.find((rule) => String(rule.id) === id) || {
              value: id,
              label: id,
              id,
            }
        )
      );
      setSelectedBundle(next.bundle_codes.map(bundleOption));
    },
  });
  const [search, setSearch] = useState(searchQueries.search);
  const [selectedRule, setSelectedRule] = useState(() =>
    searchQueries.rule_ids.map((id) => ({ value: id, label: id, id }))
  );
  const [selectedBundle, setSelectedBundle] = useState(() =>
    searchQueries.bundle_codes.map(bundleOption)
  );
  const [openDelete, setOpenDelete] = useState({ open: false, data: null });
  const [deleting, setDeleting] = useState(false);
  const [openDetail, setOpenDetail] = useState({ open: false, data: null });

  // after a reload the URL only holds rule ids: ask the lookup for their labels (?id=)
  useEffect(() => {
    const ids = searchQueries.rule_ids;
    if (!ids.length) return;
    let cancelled = false;
    Promise.all(
      ids.map((id) =>
        getPromotionRulesLookup({ id })
          .then((res) => res?.data?.data?.data?.[0])
          .catch(() => null)
      )
    ).then((items) => {
      if (cancelled) return;
      setSelectedRule(
        ids.map((id, index) => ({
          ...(items[index] || {}),
          id,
          value: id,
          label: items[index]?.label || id,
        }))
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const { data, isFetching, isError, error } = useQuery({
    queryKey: ["promotions", "list", searchQueries],
    queryFn: () =>
      getAllPromotions({
        page: searchQueries.page + 1,
        page_size: searchQueries.pageSize,
        status: searchQueries.status,
        search: searchQueries.search?.trim() || undefined,
        rule_ids: searchQueries.rule_ids.length
          ? searchQueries.rule_ids
          : undefined,
        bundle_codes: searchQueries.bundle_codes.length
          ? searchQueries.bundle_codes
          : undefined,
        // as before the migration, a bundle filter also lists the promotions open to every bundle
        include_global: searchQueries.bundle_codes.length ? true : undefined,
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

  const refreshPromotions = () =>
    queryClient.invalidateQueries({ queryKey: ["promotions"] });

  const resetFilters = () => {
    setSearchQueries({
      ...DEFAULT_QUERIES,
      status: searchQueries.status,
      pageSize: searchQueries.pageSize,
    });
    setSearch("");
    setSelectedRule([]);
    setSelectedBundle([]);
  };

  const applyFilter = () => {
    setSearchQueries({
      ...searchQueries,
      search,
      rule_ids: (selectedRule || []).map((el) => el?.value).filter(Boolean),
      bundle_codes: (selectedBundle || [])
        .map((el) => el?.value)
        .filter(Boolean),
      page: 0,
    });
  };

  const tableHeaders = [
    { name: "Name" },
    { name: "Code" },
    { name: "Rule" },
    { name: "Value" },
    { name: "From" },
    { name: "To" },
    { name: "Bundles" },
    { name: "Times Used" },
    { name: "Status" },
  ];

  const tableCellStyles = {
    sx: { minWidth: "200px" },
    className: "max-w-[250px] truncate",
  };

  const handlePromotionStatus = (promotion) => {
    togglePromotionStatus({
      id: promotion?.id,
      is_active: !promotion?.is_active,
    })
      .then(() => {
        toast.success("Promotion status updated successfully");
      })
      .catch((error) => {
        if (getApiErrorCode(error) !== "no_change") {
          toast.error(error?.message || "Failed to change promotion status");
        }
      })
      .finally(refreshPromotions);
  };

  const handleDeletePromotion = () => {
    const promotion = openDelete?.data;
    if (!promotion || deleting) return;
    setDeleting(true);
    deletePromotion(promotion?.id)
      .then(() => {
        toast.success("Promotion deleted successfully");
        // deleting the last row of a page moves back one page
        if (rows.length === 1 && searchQueries.page > 0) {
          setSearchQueries({ ...searchQueries, page: searchQueries.page - 1 });
        }
      })
      .catch((error) => {
        const details = getApiErrorDetails(error);
        if (details?.code === "promotion_used") {
          toast.info(
            `Used ${details?.times_used ?? ""} times; deactivate it instead`.replace(
              "  ",
              " "
            )
          );
        } else if (error?.response?.status === 404) {
          toast.info("This promotion was already deleted.");
        } else {
          toast.error(error?.message || "Failed to delete promotion");
        }
      })
      .finally(() => {
        setDeleting(false);
        setOpenDelete({ data: null, open: false });
        refreshPromotions();
      });
  };

  return (
    <Card className="page-card">
      <Filters
        onReset={resetFilters}
        onApply={applyFilter}
        applyDisable={
          (!search || search === "") &&
          selectedRule?.length === 0 &&
          selectedBundle?.length === 0
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
                placeholder="Search by name or code"
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
          <Grid2 item size={{ xs: 12, sm: 3 }}>
            <FormControl fullWidth>
              <label className="mb-2" htmlFor="rules-select">
                Rules
              </label>
              <LookupSelect
                inputId="rules-select"
                isMulti
                fetcher={getPromotionRulesLookup}
                permission={PERMISSIONS.RULES_READ}
                value={selectedRule}
                placeholder={"Select Rules"}
                onChange={(value) => setSelectedRule(value || [])}
              />
            </FormControl>
          </Grid2>
          <Grid2 item size={{ xs: 12, sm: 3 }}>
            <FormControl fullWidth>
              <label className="mb-2" htmlFor="bundles-select">
                Bundles
              </label>
              <LookupSelect
                inputId="bundles-select"
                isMulti
                fetcher={getBundlesLookup}
                valueKey="bundle_code"
                permission={PERMISSIONS.BUNDLES_READ}
                value={selectedBundle}
                placeholder={"Select Bundles"}
                onChange={(value) => setSelectedBundle(value || [])}
              />
            </FormControl>
          </Grid2>
        </Grid2>
      </Filters>

      {/* actions sit above the status tabs */}
      <TableToolbar
        onAdd={canWrite ? () => navigate("/promotions/add") : undefined}
      />

      <Tabs
        value={searchQueries.status}
        onChange={(_, status) =>
          setSearchQueries({ ...searchQueries, status, page: 0 })
        }
        aria-label="Promotion status"
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
        noDataFound={"No promotions"}
        tableHeaders={tableHeaders}
        actions={true}
      >
        {rows.map((el) => (
          <RowComponent key={el?.id} actions={false}>
            <TableCell sx={{ minWidth: "200px" }}>
              {/* the date window is shown here, apart from the active switch */}
              <div className="flex items-center gap-[0.5rem]">
                <span className="max-w-[250px] truncate">{el?.name || "N/A"}</span>
                {(el?.status === "expired" || el?.status === "scheduled") && (
                  <Chip
                    size="small"
                    variant="outlined"
                    label={statusLabel(el?.status)}
                    color={el?.status === "expired" ? "error" : "info"}
                  />
                )}
              </div>
            </TableCell>
            <TableCell {...tableCellStyles}>{el?.code || "N/A"}</TableCell>
            <TableCell {...tableCellStyles}>
              {el?.rule?.name || "N/A"}
            </TableCell>
            <TableCell {...tableCellStyles}>
              {el?.amount != null
                ? `${el?.amount} ${valueUnit(el?.rule)}`
                : "N/A"}
            </TableCell>
            <TableCell {...tableCellStyles}>
              {formatApiDate(el?.valid_from)}
            </TableCell>
            <TableCell {...tableCellStyles}>
              {formatApiDate(el?.valid_to)}
            </TableCell>
            <TableCell {...tableCellStyles}>
              <BundleChips codes={el?.bundle_codes} />
            </TableCell>
            <TableCell sx={{ minWidth: "100px" }}>
              {el?.times_used ?? 0}
            </TableCell>
            <TableCell sx={{ minWidth: "140px" }}>
              {/* only the active switch: expired / scheduled are dates, shown by the name */}
              <div className="flex items-center gap-1">
                <Switch
                  color="success"
                  checked={!!el?.is_active}
                  disabled={!canWrite}
                  onChange={() => handlePromotionStatus(el)}
                  name="is_active"
                  inputProps={{ "aria-label": `Toggle ${el?.code}` }}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  label={el?.is_active ? "Active" : "Inactive"}
                  color={el?.is_active ? "success" : "default"}
                />
              </div>
            </TableCell>
            <TableCell align={"right"}>
              <ActionsMenu
                label={`Actions for ${el?.name || el?.code}`}
                view
                onView={() => setOpenDetail({ data: el?.id, open: true })}
                viewDescription={"See the promotion's details and usage"}
                edit={canWrite}
                onEdit={() => navigate(`/promotions/${el?.id}`)}
                editDescription={"Change the promotion's value, dates and bundles"}
                delete={canWrite}
                onDelete={() => setOpenDelete({ data: el, open: true })}
                deleteDescription={"Remove the promotion (only when it was never used)"}
              />
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
          onClose={() => setOpenDelete({ data: null, open: false })}
          title={"Notice!"}
          onConfirm={handleDeletePromotion}
          submitting={deleting}
          submittingButtonName={"Deleting..."}
        >
          <p className={"text-center"}>
            Are you sure you want to delete{" "}
            <span className={"font-bold"}>
              {openDelete?.data?.name ? `${openDelete?.data?.name}'s` : "this"}{" "}
            </span>{" "}
            promotion?
          </p>
        </MuiModal>
      )}

      {openDetail?.open && (
        <PromotionDetail
          onClose={() => setOpenDetail({ data: null, open: false })}
          id={openDetail?.data}
        />
      )}
    </Card>
  );
};

export default PromotionsList;
