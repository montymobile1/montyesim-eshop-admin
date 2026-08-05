import { Check, Close } from "@mui/icons-material";
import LockIcon from "@mui/icons-material/Lock";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import SearchIcon from "@mui/icons-material/Search";
import {
  Card,
  Chip,
  FormControl,
  IconButton,
  TableCell,
  TablePagination,
  TextField,
  Tooltip,
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import Filters from "../../Components/Filters/Filters";
import { FormDropdownList } from "../../Components/form-component/FormComponent";
import BanUser from "../../Components/page-component/users/BanUser";
import RowComponent from "../../Components/shared/table-component/RowComponent";
import TableComponent from "../../Components/shared/table-component/TableComponent";
import { BAN_STATUS, getAllUsers } from "../../core/apis/usersAPI";
import useIsSuperAdmin from "../../core/hooks/useIsSuperAdmin";

const banStatusOptions = [
  { id: BAN_STATUS.banned, name: "Banned" },
  { id: BAN_STATUS.active, name: "Active" },
];

function UsersPage() {
  const navigate = useNavigate();
  const isSuperAdmin = useIsSuperAdmin();
  const [loading, setLoading] = useState(null);
  const [openBan, setOpenBan] = useState({ open: false, data: null });
  const [searchQueries, setSearchQueries] = useState({
    name: "",
    banStatus: null,
    pageSize: 10,
    page: 0,
  });

  const [search, setSearch] = useState("");
  const [selectedBanStatus, setSelectedBanStatus] = useState(null);
  const [totalRows, setTotalRows] = useState(0);
  const [data, setData] = useState([]);

  const getUsers = () => {
    setLoading(true);

    const { name, banStatus, page, pageSize } = searchQueries;
    getAllUsers({
      page,
      pageSize,
      name,
      banStatus,
    })
      .then((res) => {
        if (res?.error) {
          toast.error(res?.error);
          setLoading(false);
          setData([]);
          setTotalRows(0);
        } else {
          setTotalRows(res?.count || 0);
          setData(
            res?.data?.map((el) => ({
              ...el,
              ...el?.metadata,
            })),
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
    getUsers();
  }, [searchQueries]);

  const resetFilters = () => {
    setSearchQueries({ name: "", banStatus: null, pageSize: 10, page: 0 });
    setSearch("");
    setSelectedBanStatus(null);
  };

  const applyFilter = () => {
    // Back to the first page: the filtered list is shorter, so the page being
    // read may not exist any more.
    setSearchQueries({
      ...searchQueries,
      name: search,
      banStatus: selectedBanStatus?.id || null,
      page: 0,
    });
  };

  // Banning is a super admin only action, so is the column that goes with it.
  const tableHeaders = [
    { name: "Name" },
    { name: "Email" },
    { name: "MSISDN" },
    { name: "Email Verified" },
    { name: "Phone Verified" },
    { name: "Should Notify" },
    { name: "Ban Status" },
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
        // Either filter on its own is enough to apply.
        applyDisable={!search?.trim() && !selectedBanStatus}
      >
        <Grid container size={{ xs: 12 }} spacing={2}>
          <Grid item size={{ xs: 12, sm: 3 }}>
            <FormControl fullWidth>
              <label className="mb-2" htmlFor="search-input">
                Search
              </label>
              <TextField
                id="search-input"
                fullWidth
                required
                size="small"
                placeholder="Search By Email"
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
          </Grid>
          <Grid item size={{ xs: 12, sm: 3 }}>
            <FormControl fullWidth>
              <label className="mb-2" htmlFor="ban-status-input">
                Ban Status
              </label>
              <FormDropdownList
                id="ban-status-input"
                placeholder={"Select Ban Status"}
                value={selectedBanStatus}
                data={banStatusOptions}
                accessName={"name"}
                onChange={(value) => setSelectedBanStatus(value)}
              />
            </FormControl>
          </Grid>
        </Grid>
      </Filters>

      <TableComponent
        loading={loading}
        dataPerPage={searchQueries?.pageSize}
        tableData={data}
        noDataFound={"No Users Found"}
        tableHeaders={tableHeaders}
        actions={true}
      >
        {data?.map((el) => (
          <RowComponent
            key={el?.id}
            actions={true}
            onView={() => navigate(`/users/${el?.id}`)}
            /*
              Banning sits next to the eye icon, and only for super admins.
              A closed padlock bans, an open one lifts the ban.
            */
            extraActions={
              isSuperAdmin ? (
                <Tooltip
                  title={el?.is_banned ? "Unban User" : "Ban User"}
                  placement={"top"}
                >
                  <IconButton
                    color={el?.is_banned ? "primary" : "error"}
                    aria-label={el?.is_banned ? "unban" : "ban"}
                    onClick={() => setOpenBan({ open: true, data: el })}
                  >
                    {el?.is_banned ? (
                      <LockOpenIcon fontSize="small" />
                    ) : (
                      <LockIcon fontSize="small" />
                    )}
                  </IconButton>
                </Tooltip>
              ) : null
            }
          >
            <TableCell {...tableCellStyles}>
              {el?.first_name || el?.last_name
                ? `${el?.first_name || ""} ${el?.last_name || ""}`
                : "N/A"}
            </TableCell>
            <TableCell {...tableCellStyles}>{el?.email || "N/A"}</TableCell>
            <TableCell {...tableCellStyles}>{el?.msisdn || "N/A"}</TableCell>
            <TableCell>
              {el?.email_verified ? (
                <Check color="success" />
              ) : (
                <Close color="error" />
              )}
            </TableCell>
            <TableCell>
              {el?.phone_verified ? (
                <Check color="success" />
              ) : (
                <Close color="error" />
              )}
            </TableCell>
            <TableCell>
              {el?.should_notify ? (
                <Check color="success" />
              ) : (
                <Close color="error" />
              )}
            </TableCell>

            <TableCell sx={{ minWidth: "200px" }}>
              <div className={"flex flex-row items-center gap-[0.5rem]"}>
                <Chip
                  size="small"
                  label={el?.is_banned ? "Banned" : "Active"}
                  color={el?.is_banned ? "error" : "success"}
                />
                {el?.is_banned && el?.banned_until && (
                  <span className={"text-xs whitespace-nowrap"}>
                    {`until ${dayjs(el?.banned_until).format(
                      "DD-MM-YYYY HH:mm",
                    )}`}
                  </span>
                )}
              </div>
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

      {openBan?.open && (
        <BanUser
          user={openBan?.data || null}
          onClose={() => setOpenBan({ open: false, data: null })}
          onSuccess={getUsers}
        />
      )}
    </Card>
  );
}

export default UsersPage;
