import { TableCell } from "@mui/material";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import CountUp from "react-countup";
import { useParams } from "react-router-dom";
import { toast } from "react-toastify";

import RowComponent from "../../../Components/shared/table-component/RowComponent";
import TableComponent from "../../../Components/shared/table-component/TableComponent";
import TablePaginationComponent from "../../../Components/shared/table-component/TablePaginationComponent";
import TagComponent from "../../../Components/shared/tag-component/TagComponent";
import { getUserWalletTransactions } from "../../../core/apis/usersAPI";

// Wallet transactions of one user: GET /users/{id}/wallet-transactions, with the
// true total from the API (the legacy RPC returned the page length as the count).
// TEOS-153: a 404 (user_not_found) is not a load error: the page shows "User not found".
export default function WalletTransactionsTab({ onNotFound }) {
  const { id } = useParams();
  const [searchQueries, setSearchQueries] = useState({ pageSize: 10, page: 0 });

  const { data, isFetching, isError, error } = useQuery({
    queryKey: ["users", id, "wallet-transactions", searchQueries],
    queryFn: () =>
      getUserWalletTransactions(id, {
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
    else toast.error("Failed to load wallet transactions");
  }, [isError]);

  const rows = isError ? [] : data?.data || [];
  const totalRows = data?.total_count || 0;

  const tableHeaders = [
    { name: "Source" },
    { name: "Amount" },
    { name: "Status" },
    { name: "Created At" },
  ];

  return (
    <>
      <TableComponent
        loading={isFetching && !data}
        dataPerPage={searchQueries.pageSize}
        tableData={rows}
        noDataFound={"No Wallet Transactions Found"}
        tableHeaders={tableHeaders}
        actions={false}
      >
        {rows.map((el, idx) => (
          <RowComponent key={el?.id || idx} actions={false}>
            <TableCell
              sx={{ minWidth: 180 }}
              className="max-w-[240px] truncate"
            >
              {el?.source || "N/A"}
            </TableCell>

            <TableCell sx={{ minWidth: 140 }}>
              {el?.currency}{" "}
              <CountUp
                start={0}
                end={Number(el?.amount) || 0}
                duration={1.5}
                separator=","
                decimals={2}
              />
            </TableCell>
            <TableCell sx={{ minWidth: 120 }}>
              <TagComponent value={el?.status || "N/A"} />
            </TableCell>
            <TableCell sx={{ minWidth: 180 }}>
              {el?.created_at
                ? dayjs(el.created_at).format("DD-MM-YYYY HH:mm")
                : "N/A"}
            </TableCell>
          </RowComponent>
        ))}
      </TableComponent>

      <TablePaginationComponent
        totalRows={totalRows}
        page={searchQueries.page}
        pageSize={searchQueries.pageSize}
        onPageChange={(_, newPage) => {
          setSearchQueries({ ...searchQueries, page: newPage });
        }}
        onRowsPerPageChange={(e) => {
          setSearchQueries({ page: 0, pageSize: Number(e.target.value) });
        }}
      />
    </>
  );
}
