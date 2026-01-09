import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { Card, IconButton, TableCell } from "@mui/material";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import RowComponent from "../../Components/shared/table-component/RowComponent";
import TableComponent from "../../Components/shared/table-component/TableComponent";
import TablePaginationComponent from "../../Components/shared/table-component/TablePaginationComponent";
import { getAllSettingsLogs } from "../../core/apis/settingsAPI";
import SettingsLogsDetail from "./SettingsLogsDetail";
import { handleTableResponse } from "../../core/helpers/utilFunctions";

const SettingsLogs = () => {
  const [loading, setLoading] = useState(false);
  const [totalRows, setTotalRows] = useState(0);
  const [data, setData] = useState([]);
  const [expand, setExpand] = useState(null);
  const [searchQueries, setSearchQueries] = useState({
    pageSize: 10,
    page: 0,
  });

  const tableHeaders = [{ name: "User" }, { name: "Updated At" }];

  const tableCellStyles = {
    sx: { minWidth: "200px" },
    className: "max-w-[250px] truncate",
  };

  const getLogs = async () => {
    setLoading(true);

    const { page, pageSize } = searchQueries;
    getAllSettingsLogs({
      page,
      pageSize,
    })
      .then((res) => {
        handleTableResponse(res, setData, setTotalRows, setLoading);
      })
      .catch((e) => {
        console.error("Failed to load devices:", e);
        toast.error("Failed to load devices");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    getLogs();
  }, [searchQueries]);
  return (
    <Card className="page-card">
      <TableComponent
        loading={loading}
        dataPerPage={searchQueries?.pageSize}
        tableData={data || []}
        noDataFound={"No logs found"}
        tableHeaders={tableHeaders}
        actions={true}
      >
        {data?.map((el) => (
          <RowComponent
            openCollapse={expand == el?.id}
            key={el?.id}
            actions={false}
            colSpan={3}
            row={el}
            collapseComponent={<SettingsLogsDetail data={el} />}
          >
            <TableCell {...tableCellStyles}>
              {el?.changed_by || "N/A"}
            </TableCell>

            <TableCell {...tableCellStyles}>
              {el?.changed_at
                ? dayjs(el?.changed_at).format("DD-MM-YYYY HH:mm")
                : "N/A"}
            </TableCell>
            <TableCell>
              <IconButton
                onClick={() => {
                  setExpand(expand == el?.id ? null : el?.id);
                }}
              >
                <KeyboardArrowDownIcon />
              </IconButton>
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
    </Card>
  );
};

export default SettingsLogs;
