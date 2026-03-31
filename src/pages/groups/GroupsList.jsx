import SearchIcon from "@mui/icons-material/Search";
import {
  Card,
  FormControl,
  Grid2,
  IconButton,
  Switch,
  TableCell,
  TablePagination,
  TextField,
  Tooltip,
} from "@mui/material";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import ViewListIcon from "@mui/icons-material/ViewList";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import Filters from "../../Components/Filters/Filters";
import MuiModal from "../../Components/Modals/MuiModal";
import GroupDeleteNotice from "../../Components/page-component/groups/GroupDeleteNotice";
import RowComponent from "../../Components/shared/table-component/RowComponent";
import TableComponent from "../../Components/shared/table-component/TableComponent";
import {
  deleteGroup,
  getAllGroups,
  toggleGroupStatus,
} from "../../core/apis/groupsAPI";
import { displayTypes, groupTypes } from "../../core/vairables/EnumData";
import { set } from "react-hook-form";
import { DragHandle } from "@mui/icons-material";

const GroupsList = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const canReorder = import.meta.env.VITE_GROUP_TAG_ORDERING == "true";
  const [openDelete, setOpenDelete] = useState({ open: false, data: null });
  const [openNotice, setOpenNotice] = useState({ open: false, data: null });
  const [data, setData] = useState([]);
  const [search, setSearch] = useState("");
  const [totalRows, setTotalRows] = useState(0);
  const [searchQueries, setSearchQueries] = useState({
    name: "",
    pageSize: 10,
    page: 0,
  });

  const getGroups = async () => {
    setLoading(true);

    try {
      const { name, page, pageSize } = searchQueries;

      const { data, error, count } = await getAllGroups(page, pageSize, name);

      if (error) {
        toast.error(error?.message);
        setLoading(false);
        setData([]);
        setTotalRows(0);
      } else {
        setTotalRows(count);
        setData(
          data?.map((el) => ({
            ...el,
            ...el?.metadata,
          })),
        );
        setLoading(false);
      }
    } catch (e) {
      toast.error(e?.message || "Fail to display data");
      setLoading(false);
    }
  };

  useEffect(() => {
    getGroups();
  }, [searchQueries]);

  const resetFilters = () => {
    setSearchQueries({ ...searchQueries, name: "" });
    setSearch("");
  };

  const applyFilter = () => {
    setSearchQueries({ ...searchQueries, name: search });
  };

  const tableHeaders = [
    { name: "Name" },
    { name: "Type" },
    { name: "Category" },
    { name: "Is Active" },
    { name: "Created At" },
  ];

  const handleDeleteGroup = () => {
    deleteGroup(openDelete?.data?.id).then((res) => {
      if (res?.error) {
        if (res?.data?.code === "linked-bundles") {
          setOpenDelete({ open: false, data: null });
          setOpenNotice({ data: res?.data?.bundle_count, open: true });
        }
        toast.error(res?.error);
      } else {
        getGroups();
        setOpenDelete({ open: false, data: null });
      }
    });
  };

  const handleGroupStatus = (group) => {
    toggleGroupStatus({ id: group?.id, currentValue: group?.is_active }).then(
      (res) => {
        if (!res?.error) {
          getGroups();
        }
      },
    );
  };

  const canChangeOrder = () => {};
  return (
    <>
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
          </Grid2>
        </Filters>

        <TableComponent
          loading={loading}
          dataPerPage={searchQueries?.pageSize}
          tableData={data}
          noDataFound={"No Groups Found"}
          tableHeaders={tableHeaders}
          actions={true}
          onAdd={() => navigate("/groups/add")}
        >
          {data?.map((el) => (
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
              <TableCell
                sx={{ minWidth: "150px" }}
                className={"max-w-[200px] truncate"}
              >
                <Switch
                  color="success"
                  checked={el?.is_active}
                  onChange={() => handleGroupStatus(el)}
                  name="is_active"
                />
              </TableCell>
              <TableCell
                sx={{ minWidth: "200px" }}
                className={"max-w-[250px] truncate"}
              >
                {dayjs(el?.created_at).format("DD-MM-YYYY HH:mm")}
              </TableCell>
              <TableCell align={"right"}>
                {el?.type == 1 && canReorder && (
                  <Tooltip title={"Reorder"} placement={"top"}>
                    <IconButton
                      color="primary"
                      aria-label="reorder"
                      onClick={(event) => {
                        navigate(`/groups/${el?.id}/reorder`);
                      }}
                    >
                      <ViewListIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title={"Edit"} placement={"top"}>
                  <IconButton
                    color="primary"
                    aria-label="edit"
                    onClick={() => {
                      navigate(`/groups/${el?.id}`);
                    }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title={"Delete"} placement={"top"}>
                  <IconButton
                    color="error"
                    aria-label="delete"
                    onClick={(event) => {
                      setOpenDelete({ open: true, data: el });
                    }}
                  >
                    <DeleteIcon fontSize="small" />
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
          onPageChange={(e, newPage) => {
            setSearchQueries({ ...searchQueries, page: newPage });
          }}
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
            onClose={() => setOpenDelete({ open: false, data: null })}
            title={"Notice!"}
            onConfirm={() => handleDeleteGroup()}
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
          </MuiModal>
        )}
      </Card>
      {openNotice?.open && (
        <GroupDeleteNotice
          onClose={() => setOpenNotice({ open: false, data: null })}
          data={openNotice?.data || null}
        />
      )}
    </>
  );
};

export default GroupsList;
