//UTILITIES
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
//COMPONENT
import { Card, TableCell, TablePagination } from "@mui/material";
import { useNavigate } from "react-router-dom";
import RowComponent from "../../Components/shared/table-component/RowComponent";
import TableComponent from "../../Components/shared/table-component/TableComponent";
import { getAllSettings } from "../../core/apis/settingsAPI";

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
        if (res?.error) {
          toast.error(res?.error);
          setData([]);
          setTotalRows(0);
        } else {
          setTotalRows(res?.count || 0);
          setData(
            res?.data?.map((el) => ({
              ...el,
            }))
          );
        }
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
            <TableCell
              sx={{ minWidth: "200px" }}
              className={"max-w-[250px] truncate"}
            >
              {el?.key || "N/A"}
            </TableCell>
            <TableCell
              sx={{ minWidth: "200px" }}
              className={"max-w-[250px] truncate"}
            >
              {el?.value || "N/A"}
            </TableCell>

            <TableCell
              sx={{ minWidth: "200px" }}
              className={"max-w-[250px] truncate"}
            >
              {el?.created_at
                ? dayjs(el?.created_at).format("DD-MM-YYYY HH:mm")
                : "N/A"}
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
    </Card>
  );
}

export default Settings;
