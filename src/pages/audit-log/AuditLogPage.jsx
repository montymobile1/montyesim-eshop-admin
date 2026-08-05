import SearchIcon from "@mui/icons-material/Search";
import { Card, FormControl, Grid2, TableCell, TextField } from "@mui/material";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import Filters from "../../Components/Filters/Filters";
import RowComponent from "../../Components/shared/table-component/RowComponent";
import TableComponent from "../../Components/shared/table-component/TableComponent";
import TablePaginationComponent from "../../Components/shared/table-component/TablePaginationComponent";
import { getAllAuditLogs } from "../../core/apis/auditLogAPI";
import AuditLogDetail from "./AuditLogDetail";

const AuditLogPage = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [totalRows, setTotalRows] = useState(0);
  const [search, setSearch] = useState("");
  const [openDetail, setOpenDetail] = useState({ open: false, data: null });
  const [searchQueries, setSearchQueries] = useState({
    tableName: "",
    pageSize: 10,
    page: 0,
  });

  const tableHeaders = [
    { name: "Table Name" },
    { name: "Operation" },
    { name: "Changed By" },
    { name: "Changed At" },
    { name: "Rows Affected" },
    { name: "Reason" },
    { name: "IP Address" },
  ];

  const tableCellStyles = {
    sx: { minWidth: "150px" },
    className: "max-w-[250px] truncate",
  };

  const getLogs = async () => {
    setLoading(true);

    const { page, pageSize, tableName } = searchQueries;

    getAllAuditLogs({ page, pageSize, tableName })
      .then((res) => {
        if (res?.error) {
          toast.error(res?.error);
          setData([]);
          setTotalRows(0);
        } else {
          setTotalRows(res?.count || 0);
          setData(res?.data || []);
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
    getLogs();
  }, [searchQueries]);

  const resetFilters = () => {
    setSearch("");
    setSearchQueries({ ...searchQueries, tableName: "", page: 0 });
  };

  const applyFilter = () => {
    setSearchQueries({ ...searchQueries, tableName: search, page: 0 });
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
              <label className="mb-2" htmlFor="table-name-input">
                Table Name
              </label>
              <TextField
                id="table-name-input"
                fullWidth
                size="small"
                placeholder="Search By Table Name"
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
        noDataFound={"No logs found"}
        tableHeaders={tableHeaders}
        actions={true}
      >
        {data?.map((el) => (
          <RowComponent
            key={el?.id}
            row={el}
            actions={true}
            onView={() => setOpenDetail({ open: true, data: el })}
          >
            <TableCell {...tableCellStyles}>
              {el?.table_name || "N/A"}
            </TableCell>
            <TableCell {...tableCellStyles}>{el?.operation || "N/A"}</TableCell>
            <TableCell {...tableCellStyles}>
              {el?.changed_by_label || "N/A"}
            </TableCell>
            <TableCell {...tableCellStyles}>
              {el?.changed_at
                ? dayjs.utc(el?.changed_at).local().format("DD-MM-YYYY HH:mm")
                : "N/A"}
            </TableCell>
            <TableCell sx={{ minWidth: "120px" }}>
              {el?.rows_affected ?? "N/A"}
            </TableCell>
            <TableCell {...tableCellStyles}>{el?.reason || "N/A"}</TableCell>
            <TableCell {...tableCellStyles}>
              {el?.ip_address || "N/A"}
            </TableCell>
          </RowComponent>
        ))}
      </TableComponent>

      <TablePaginationComponent
        totalRows={totalRows}
        page={searchQueries?.page}
        pageSize={searchQueries?.pageSize}
        onPageChange={(e, newPage) => {
          setSearchQueries({ ...searchQueries, page: newPage });
        }}
        onRowsPerPageChange={(e) => {
          setSearchQueries({
            ...searchQueries,
            page: 0,
            pageSize: e.target.value,
          });
        }}
      />

      {openDetail?.open && (
        <AuditLogDetail
          log={openDetail?.data}
          onClose={() => setOpenDetail({ open: false, data: null })}
        />
      )}
    </Card>
  );
};

export default AuditLogPage;
