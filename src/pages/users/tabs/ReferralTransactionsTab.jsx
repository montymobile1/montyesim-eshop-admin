import React, { useEffect, useState } from "react";
import dayjs from "dayjs";
import { useParams } from "react-router-dom";
import { TableCell, TablePagination } from "@mui/material";
import { toast } from "react-toastify";

import RowComponent from "../../../Components/shared/table-component/RowComponent";
import TableComponent from "../../../Components/shared/table-component/TableComponent";
import { getAllReferralTransactions } from "../../../core/apis/usersAPI";
import CountUp from "react-countup";

export default function ReferralTransactionsTab() {
  const { id } = useParams();

  const [totalRows, setTotalRows] = useState(0);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQueries, setSearchQueries] = useState({
    pageSize: 10,
    page: 0,
  });

  const tableHeaders = [
    { name: "Refer Code" },
    { name: "Reward Amount" },
    { name: "From User Email" },
    { name: "To User Email" },
    { name: "Order Number" },
    { name: "Referral Date" },
    { name: "Purchased Date" },
  ];

  const tableCellStyles140 = {
    sx: { minWidth: 140 },
    className: "max-w-[220px] truncate",
  };

  const tableCellStyles140NoTruncate = {
    sx: { minWidth: 140 },
  };

  const tableCellStyles220 = {
    sx: { minWidth: 220 },
    className: "max-w-[260px] truncate",
  };

  const tableCellStyles160 = {
    sx: { minWidth: 160 },
    className: "max-w-[220px] truncate",
  };

  const tableCellStyles180 = {
    sx: { minWidth: 180 },
  };

  const getReferralTransactions = async () => {
    setLoading(true);
    try {
      const { page, pageSize } = searchQueries;

      const res = await getAllReferralTransactions(page, pageSize, id);
      if (res?.error) {
        throw res.error;
      }

      const rows = res?.data || [];

      setData(rows);
      setTotalRows(res?.count ?? 0);
    } catch (e) {
      console.error("Failed to load referral transactions:", e);
      toast.error(e?.message || "Failed to load referral transactions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getReferralTransactions();
  }, [searchQueries, id]);

  return (
    <>
      <TableComponent
        loading={loading}
        dataPerPage={searchQueries.pageSize}
        tableData={data}
        noDataFound={"No Referral Transactions Found"}
        tableHeaders={tableHeaders}
        actions={false}
      >
        {data?.map((el, idx) => (
          <RowComponent key={el?.id || idx} actions={false}>
            <TableCell {...tableCellStyles140}>
              {el?.referral_code || "N/A"}
            </TableCell>
            <TableCell {...tableCellStyles140NoTruncate}>
              {el?.currency}{" "}
              <CountUp
                start={0}
                end={el?.amount}
                duration={1.5}
                separator=","
                decimals={2}
              />
            </TableCell>

            <TableCell {...tableCellStyles220}>
              {el?.from_user_email || "N/A"}
            </TableCell>

            <TableCell {...tableCellStyles220}>
              {el?.to_user_email || "N/A"}
            </TableCell>
            <TableCell {...tableCellStyles160}>
              {el?.id || el?.transaction_id || "N/A"}
            </TableCell>
            <TableCell {...tableCellStyles180}>
              {el?.created_at
                ? dayjs(el?.created_at).format("DD-MM-YYYY HH:mm")
                : "N/A"}
            </TableCell>
            <TableCell {...tableCellStyles180}>
              {el?.payment_time
                ? dayjs(el.payment_time).format("DD-MM-YYYY HH:mm")
                : "N/A"}
            </TableCell>
          </RowComponent>
        ))}
      </TableComponent>

      <TablePagination
        component="div"
        count={totalRows || 0}
        page={searchQueries.page}
        onPageChange={(_, newPage) => {
          setSearchQueries({ ...searchQueries, page: newPage });
        }}
        rowsPerPage={searchQueries.pageSize}
        onRowsPerPageChange={(e) => {
          setSearchQueries({
            ...searchQueries,
            pageSize: Number(e.target.value),
            page: 0,
          });
        }}
      />
    </>
  );
}
