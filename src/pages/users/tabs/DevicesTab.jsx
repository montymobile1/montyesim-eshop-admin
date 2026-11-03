//UTILITIES
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
//component
import { TableCell } from "@mui/material";
import { toast } from "react-toastify";
import RowComponent from "../../../Components/shared/table-component/RowComponent";
import TableComponent from "../../../Components/shared/table-component/TableComponent";
import TablePaginationComponent from "../../../Components/shared/table-component/TablePaginationComponent";
import { getUserDevices } from "../../../core/apis/usersAPI";

// Devices of one user: GET /users/{id}/devices, paged server-side (MS-5080).
// TEOS-153: a 404 (user_not_found) is not a load error: the page shows "User not found".
export default function DevicesTab({ onNotFound }) {
  const { id } = useParams();
  const [searchQueries, setSearchQueries] = useState({ pageSize: 10, page: 0 });

  const { data, isFetching, isError, error } = useQuery({
    queryKey: ["users", id, "devices", searchQueries],
    queryFn: () =>
      getUserDevices(id, {
        page: searchQueries.page + 1,
        page_size: searchQueries.pageSize,
      }).then((res) => res?.data?.data),
    placeholderData: keepPreviousData,
    enabled: !!id,
  });

  const notFound = error?.response?.status === 404;

  useEffect(() => {
    if (!isError || error?.isForbidden) return;
    if (notFound) onNotFound?.();
    else toast.error("Failed to load user devices");
  }, [isError]);

  const rows = isError ? [] : data?.data || [];
  const totalRows = data?.total_count || 0;

  const tableHeaders = [
    { name: "Deviced ID" },
    { name: "Manufacturer" },
    { name: "Device Model" },
    { name: "IP Location" },
    { name: "LoggedIn At" },
    { name: "LoggedOut At" },
  ];

  return (
    <>
      <TableComponent
        loading={isFetching && !data}
        dataPerPage={searchQueries?.pageSize}
        tableData={rows}
        noDataFound={"No Devices Found"}
        tableHeaders={tableHeaders}
        actions={true}
      >
        {rows.map((el) => (
          <RowComponent key={el?.id} actions={true}>
            <TableCell
              sx={{ minWidth: "200px" }}
              className={"max-w-[250px] truncate"}
            >
              {el?.id || "N/A"}
            </TableCell>
            <TableCell
              sx={{ minWidth: "200px" }}
              className={"max-w-[250px] truncate"}
            >
              {el?.manufacturer || "N/A"}
            </TableCell>
            <TableCell
              sx={{ minWidth: "200px" }}
              className={"max-w-[250px] truncate"}
            >
              {el?.device_model || "N/A"}
            </TableCell>
            <TableCell>{el?.ip_location || "N/A"}</TableCell>
            <TableCell>
              {el?.timestamp_login
                ? dayjs(el?.timestamp_login).format("DD-MM-YYYY HH:mm")
                : "N/A"}
            </TableCell>
            <TableCell>
              {el?.timestamp_logout
                ? dayjs(el?.timestamp_logout).format("DD-MM-YYYY HH:mm")
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
          setSearchQueries({ page: 0, pageSize: Number(e.target.value) });
        }}
      />
    </>
  );
}
