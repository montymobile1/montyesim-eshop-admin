import SearchIcon from "@mui/icons-material/Search";
import {
  Card,
  FormControl,
  Grid2,
  TableCell,
  TablePagination,
  TextField,
} from "@mui/material";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import Filters from "../../Components/Filters/Filters";
import MuiModal from "../../Components/Modals/MuiModal";
import { FormDropdownList } from "../../Components/form-component/FormComponent";
import RuleHandle from "../../Components/page-component/rules/RuleHandle";
import ActionsMenu from "../../Components/shared/actions-menu/ActionsMenu";
import RowComponent from "../../Components/shared/table-component/RowComponent";
import TableComponent from "../../Components/shared/table-component/TableComponent";
import {
  deleteRule,
  getAllRules,
  getApiErrorCode,
} from "../../core/apis/rulesAPI";
import useUrlQueries, {
  useLastValidPage,
} from "../../core/custom-hook/useUrlQueries";
import usePermission from "../../core/hooks/usePermission";
import { beneficiaryData } from "../../core/vairables/EnumData";
import { PERMISSIONS } from "../../core/vairables/Permissions";
import { toNumber } from "../promotions/promotionHelpers";
import { useRuleActions, useRuleEvents } from "./useRuleOptions";

const DEFAULT_QUERIES = {
  search: "",
  action_id: "",
  event_id: "",
  pageSize: 10,
  page: 0,
};

const byId = (list, id) =>
  id ? list?.find((item) => String(item?.id) === String(id)) || null : null;

const readQueries = (searchParams) => ({
  search: searchParams.get("search") || "",
  action_id: searchParams.get("action_id") || "",
  event_id: searchParams.get("event_id") || "",
  pageSize: toNumber(searchParams.get("pageSize"), 10) || 10,
  page: toNumber(searchParams.get("page"), 0),
});

function RulesList() {
  const queryClient = useQueryClient();
  const canWrite = usePermission(PERMISSIONS.RULES_WRITE);
  // TEOS-287: the table follows the URL on Back / Forward, the filter inputs too
  const [searchQueries, setSearchQueries] = useUrlQueries(readQueries, {
    onUrlChange: (next) => {
      setSearch(next.search);
      setSelectedAction(byId(actions, next.action_id));
      setSelectedEvent(byId(events, next.event_id));
    },
  });
  const [search, setSearch] = useState(searchQueries.search);
  const [selectedAction, setSelectedAction] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [openDelete, setOpenDelete] = useState({ data: null, open: false });
  const [deleting, setDeleting] = useState(false);
  const [addRule, setAddRule] = useState({ data: null, open: false });

  // actions and events: fetched once, shared with the modal
  const { data: actions = [] } = useRuleActions();
  const { data: events = [] } = useRuleEvents();

  // restore the filter labels from the URL once the lists are known
  useEffect(() => {
    if (searchQueries.action_id && !selectedAction) {
      setSelectedAction(byId(actions, searchQueries.action_id));
    }
  }, [actions]);
  useEffect(() => {
    if (searchQueries.event_id && !selectedEvent) {
      setSelectedEvent(byId(events, searchQueries.event_id));
    }
  }, [events]);

  const { data, isFetching, isError, error } = useQuery({
    queryKey: ["promotion-rules", "list", searchQueries],
    queryFn: () =>
      getAllRules({
        page: searchQueries.page + 1,
        page_size: searchQueries.pageSize,
        search: searchQueries.search?.trim() || undefined,
        action_id: searchQueries.action_id || undefined,
        event_id: searchQueries.event_id || undefined,
      }).then((res) => res?.data?.data),
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (isError && !error?.isForbidden) toast.error("Fail to display data");
  }, [isError]);

  const rows = isError ? [] : data?.data || [];
  const totalRows = data?.total_count || 0;

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

  const refreshRules = () =>
    queryClient.invalidateQueries({ queryKey: ["promotion-rules", "list"] });

  const handleDeleteRule = () => {
    const id = openDelete?.data;
    if (!id || deleting) return;
    setDeleting(true);
    deleteRule(id)
      .then(() => {
        toast.success("Rule deleted successfully");
        if (rows.length === 1 && searchQueries.page > 0) {
          setSearchQueries({ ...searchQueries, page: searchQueries.page - 1 });
        }
      })
      .catch((error) => {
        if (getApiErrorCode(error) === "rule_in_use") {
          toast.info(
            "This rule cannot be deleted because it is already linked to an existing promotion"
          );
        } else if (error?.response?.status === 404) {
          toast.info("This rule was already deleted.");
        } else {
          toast.error(error?.message || "Failed to delete rule");
        }
      })
      .finally(() => {
        setDeleting(false);
        setOpenDelete({ data: null, open: false });
        refreshRules();
      });
  };

  const tableHeaders = [
    { name: "ID" },
    { name: "Action" },
    { name: "Event" },
    { name: "Max usage" },
    { name: "Beneficiary" },
    { name: "Promotions" },
  ];

  const tableCellStyles = {
    sx: { minWidth: "200px" },
    className: "max-w-[250px] truncate",
  };

  const resetFilters = () => {
    setSearchQueries({ ...DEFAULT_QUERIES, pageSize: searchQueries.pageSize });
    setSearch("");
    setSelectedAction(null);
    setSelectedEvent(null);
  };

  const applyFilter = () => {
    setSearchQueries({
      ...searchQueries,
      search,
      action_id: selectedAction?.id ?? "",
      event_id: selectedEvent?.id ?? "",
      page: 0,
    });
  };

  return (
    <Card className="page-card">
      <Filters
        onReset={resetFilters}
        onApply={applyFilter}
        applyDisable={
          (!search || search === "") &&
          selectedAction === null &&
          selectedEvent === null
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
                placeholder="Search by ID"
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
              <label className="mb-2" htmlFor="action-select">
                Action
              </label>
              <FormDropdownList
                placeholder={"Select Action"}
                value={selectedAction}
                data={actions || []}
                accessName={"name"}
                onChange={(value) => setSelectedAction(value)}
              />
            </FormControl>
          </Grid2>
          <Grid2 item size={{ xs: 12, sm: 3 }}>
            <FormControl fullWidth>
              <label className="mb-2" htmlFor="event-select">
                Event
              </label>
              <FormDropdownList
                placeholder={"Select Event"}
                value={selectedEvent}
                data={events || []}
                accessName={"name"}
                onChange={(value) => setSelectedEvent(value)}
              />
            </FormControl>
          </Grid2>
        </Grid2>
      </Filters>

      <TableComponent
        loading={isFetching && !data}
        dataPerPage={searchQueries?.pageSize}
        tableData={rows}
        noDataFound={"No Rules Found"}
        tableHeaders={tableHeaders}
        actions={true}
        onAdd={
          canWrite ? () => setAddRule({ data: null, open: true }) : undefined
        }
      >
        {rows.map((el) => (
          <RowComponent key={el?.id} actions={false}>
            <TableCell {...tableCellStyles}>{el?.id || "N/A"}</TableCell>
            <TableCell {...tableCellStyles}>
              {el?.action?.name || "N/A"}
            </TableCell>
            <TableCell {...tableCellStyles}>
              {el?.event?.name || "N/A"}
            </TableCell>
            <TableCell {...tableCellStyles}>{el?.max_usage || "N/A"}</TableCell>
            <TableCell>
              {beneficiaryData?.find((bf) => bf?.id == el?.beneficiary)
                ?.title || "N/A"}
            </TableCell>
            {/* TEOS-210: promotions using the rule */}
            <TableCell>{el?.promotion_count ?? 0}</TableCell>
            <TableCell align={"right"}>
              <ActionsMenu
                label={`Actions for rule ${el?.id}`}
                edit={canWrite}
                onEdit={() => setAddRule({ data: el, open: true })}
                editDescription={"Change the rule's beneficiary"}
                delete={canWrite}
                onDelete={() => setOpenDelete({ data: el?.id, open: true })}
                // TEOS-210: a rule used by promotions cannot be deleted (409 rule_in_use stays the fallback)
                deleteDisabled={el?.promotion_count > 0}
                deleteDescription={
                  el?.promotion_count > 0
                    ? `Used by ${el.promotion_count} ${el.promotion_count === 1 ? "promotion" : "promotions"}`
                    : "Remove the rule (only when no promotion uses it)"
                }
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

      {addRule?.open && (
        <RuleHandle
          data={addRule?.data}
          onClose={() => {
            setAddRule({ data: null, open: false });
          }}
          refetch={refreshRules}
        />
      )}

      {openDelete?.open && (
        <MuiModal
          open={true}
          onClose={() => setOpenDelete({ data: null, open: false })}
          title={"Notice!"}
          onConfirm={handleDeleteRule}
          submitting={deleting}
          submittingButtonName={"Deleting..."}
        >
          <p className={"text-center"}>
            Are you sure you want to delete this rule?
          </p>
        </MuiModal>
      )}
    </Card>
  );
}

export default RulesList;
