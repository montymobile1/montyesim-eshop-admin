import {
  Button,
  Table,
  TableBody,
  TableContainer
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import ContentPasteSearchIcon from "@mui/icons-material/ContentPasteSearch";
import NoDataFound from "../fallbacks/no-data-found/NoDataFound";
import TableSkeletons from "../skeletons/TableSkeletons";
import TableCustomHeader from "./TableCustomHeader";
import DoDisturbIcon from "@mui/icons-material/DoDisturb";

/*
  Page-level actions (Add / Edit / View logs, plus any children such as a bulk
  ⋯ menu), right-aligned. A page with status tabs renders it itself, above the
  tabs; otherwise TableComponent renders it above the table.
*/
export const TableToolbar = ({
  children,
  onAdd,
  onEdit,
  onLogs,
  addLabel = "Add",
  editLabel = "Edit",
  logsLabel = "View logs",
}) => {
  if (!onAdd && !onEdit && !onLogs && !children) return null;

  return (
    <div
      className={"flex flex-row flex-wrap justify-end items-center gap-[0.5rem]"}
      data-testid="table-toolbar"
    >
      {children}
      {onLogs && (
        <Button
          variant="outlined"
          color="primary"
          startIcon={<ContentPasteSearchIcon />}
          onClick={() => onLogs()}
        >
          {logsLabel}
        </Button>
      )}
      {onEdit && (
        <Button
          variant="contained"
          color="primary"
          startIcon={<EditIcon />}
          onClick={() => onEdit()}
        >
          {editLabel}
        </Button>
      )}
      {onAdd && (
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => onAdd()}
        >
          {addLabel}
        </Button>
      )}
    </div>
  );
};

const TableComponent = (props) => {
  const {
    noDataFound = "No Data Found",
    tableHeaders = [],
    children,
    dataPerPage = 10,
    tableData = [],
    loading = false,
    requestSort,
    onAdd,
    onEdit,
    onLogs,
    addLabel,
    editLabel,
    logsLabel,
  } = props;

  const handleSortRequest = (value) => {
    requestSort(value);
  };

  return (
    <div className={"flex flex-col gap-[1rem]"}>
      <TableToolbar
        onAdd={onAdd}
        onEdit={onEdit}
        onLogs={onLogs}
        addLabel={addLabel}
        editLabel={editLabel}
        logsLabel={logsLabel}
      />
      <TableContainer aria-busy={loading}>
        <Table>
          <TableCustomHeader
            {...props}
            requestSort={handleSortRequest}
            headers={tableHeaders}
          />
          {!loading && tableData?.length !== 0 && (
            <TableBody>{children}</TableBody>
          )}
        </Table>
        {!loading && tableData?.length === 0 && (
          <div className="flex flex-row justify-center items-center h-[100px] break-all p-6">
            <NoDataFound
              height={200}
              width={200}
              row={true}
              text={noDataFound}
              image={<DoDisturbIcon fontSize="small" />}
            />
          </div>
        )}
        {loading && <TableSkeletons count={dataPerPage} />}
      </TableContainer>
    </div>
  );
};

export default TableComponent;
