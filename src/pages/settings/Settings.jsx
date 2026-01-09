//UTILITIES
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
//COMPONENT
import { Card, TableCell } from "@mui/material";
import { useNavigate } from "react-router-dom";
import RowComponent from "../../Components/shared/table-component/RowComponent";
import TableComponent from "../../Components/shared/table-component/TableComponent";
import TablePaginationComponent from "../../Components/shared/table-component/TablePaginationComponent";
import { getAllSettings } from "../../core/apis/settingsAPI";
import { handleTableResponse } from "../../core/helpers/utilFunctions";

function Settings() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(null);
  const [totalRows, setTotalRows] = useState(0);
  const [data, setData] = useState([]);

  const [searchQueries, setSearchQueries] = useState({
    pageSize: 10,
    page: 0,
  });

  const getOrders = async () => {
    setLoading(true);

    getAllSettings({ ...searchQueries })
      .then((res) => {
        handleTableResponse(res, setData, setTotalRows, setLoading);
      })
      .catch(() => {
        toast.error("Failed to load settings");

        setLoading(false);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    getOrders();
  }, [searchQueries]);

  const tableHeaders = [
    { name: "Key" },
    { name: "Value" },
    { name: "Created At" },
  ];

  const tableCellStyles = {
    sx: { minWidth: "200px" },
    className: "max-w-[250px] truncate",
  };

  return (
    <Card className="page-card">
      <TableComponent
        loading={loading}
        dataPerPage={searchQueries?.pageSize}
        tableData={data}
        noDataFound={"No Setting Params Found"}
        tableHeaders={tableHeaders}
        actions={true}
        onEdit={() => navigate("/settings/edit")}
        onLogs={() => navigate("/settings/logs")}
      >
        {data?.map((el) => (
          <RowComponent key={el?.id} actions={true}>
            <TableCell {...tableCellStyles}>
              {el?.key || "N/A"}
            </TableCell>
            <TableCell {...tableCellStyles}>
              {el?.value || "N/A"}
            </TableCell>

            <TableCell {...tableCellStyles}>
              {el?.created_at
                ? dayjs(el?.created_at).format("DD-MM-YYYY HH:mm")
                : "N/A"}
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
}

export default Settings;
