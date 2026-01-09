//UTILITIES
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import CountUp from "react-countup";
import { AsyncPaginate } from "react-select-async-paginate";
import { toast } from "react-toastify";
//COMPONENT
import { Card, FormControl, TableCell, useTheme } from "@mui/material";
import Grid from "@mui/material/Grid2";
import Filters from "../../Components/Filters/Filters";
import RowComponent from "../../Components/shared/table-component/RowComponent";
import TableComponent from "../../Components/shared/table-component/TableComponent";
import TablePaginationComponent from "../../Components/shared/table-component/TablePaginationComponent";
import TagComponent from "../../Components/shared/tag-component/TagComponent";
import { getAllOrders } from "../../core/apis/ordersAPI";
import { getAllUsersDropdown } from "../../core/apis/usersAPI";
import { handleTableResponse } from "../../core/helpers/utilFunctions";

function OrdersPage() {
  const theme = useTheme();

  const asyncPaginateStyles = theme?.asyncPaginateStyles || {};

  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [totalRows, setTotalRows] = useState(0);
  const [data, setData] = useState([]);
  const [searchQueries, setSearchQueries] = useState({
    pageSize: 10,
    page: 0,
    user: null,
  });

  const loadOptions = async (search, loadedOptions, { page }) => {
    const pageSize = 10;
    const res = await getAllUsersDropdown({ page, pageSize, name: search });
    if (res?.error) {
      return {
        options: [...loadedOptions],
        hasMore: false,
        additional: {
          page: page,
        },
      };
    } else {
      return {
        options: res?.data?.map((item) => ({
          ...item,
          value: item.id,
          label: item.email || item?.metadata?.email,
        })),
        hasMore: res?.data?.length === pageSize,
        additional: {
          page: page + 1,
        },
      };
    }
  };

  const getOrders = async () => {
    setLoading(true);

    const { page, pageSize, user } = searchQueries;
    getAllOrders({
      page,
      pageSize,
      user,
    })
      .then((res) => {
        handleTableResponse(res, setData, setTotalRows, setLoading);
      })
      .catch(() => {
        toast.error("Failed to load devices");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    getOrders();
  }, [searchQueries]);

  const resetFilters = () => {
    setSearchQueries({
      pageSize: 10,
      page: 0,
      user: null,
    });
    setSelectedUser(null);
  };

  const applyFilter = () => {
    setSearchQueries({ ...searchQueries, user: selectedUser?.id });
  };

  const tableHeaders = [
    { name: "Order ID" },
    { name: "User Email" },
    { name: "User Phone" },
    { name: "Bundle Name" },
    { name: "Amount" },
    { name: "Promo Code" },
    { name: "Referral Code" },
    { name: "Order Type" },
    { name: "Order Status" },
    { name: "Payment Status" },

    { name: "Created At" },
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
        applyDisable={!selectedUser}
      >
        <Grid container size={{ xs: 12 }} spacing={2}>
          <Grid item size={{ xs: 12, sm: 3 }}>
            <FormControl fullWidth>
              <label className="mb-2" htmlFor="user-input">
                User
              </label>

              <AsyncPaginate
                id="user-input"
                isClearable={true}
                value={selectedUser}
                placeholder={"Select User Email"}
                loadOptions={loadOptions}
                onChange={(value) => setSelectedUser(value)}
                additional={{ page: 1 }}
                isSearchable
                debounceTimeout={300}
                styles={{
                  ...asyncPaginateStyles,
                }}
              />
            </FormControl>
          </Grid>
        </Grid>
      </Filters>
      <TableComponent
        loading={loading}
        dataPerPage={searchQueries?.pageSize}
        tableData={data}
        noDataFound={"No Orders Found"}
        tableHeaders={tableHeaders}
        actions={true}
      >
        {data?.map((el) => (
          <RowComponent key={el?.id} actions={true}>
            <TableCell {...tableCellStyles}>{el?.id || "N/A"}</TableCell>
            <TableCell {...tableCellStyles}>
              {el?.user?.metadata?.email || "N/A"}
            </TableCell>
            <TableCell {...tableCellStyles}>
              {el?.user?.metadata?.msisdn || "N/A"}
            </TableCell>
            <TableCell {...tableCellStyles}>
              {el?.bundle_data && el?.bundle_data !== "-"
                ? JSON.parse(el?.bundle_data)?.display_title
                : "N/A"}
            </TableCell>
            <TableCell {...tableCellStyles}>
              {el?.currency}{" "}
              <CountUp
                start={0}
                end={el?.amount / 100.0} //because the amount is from stripe by cent
                duration={1.5}
                separator=","
                decimals={2}
              />
            </TableCell>
            <TableCell {...tableCellStyles}>
              {el?.promo_code || "N/A"}
            </TableCell>
            <TableCell {...tableCellStyles}>
              {el?.referral_code || "N/A"}
            </TableCell>
            <TableCell {...tableCellStyles}>
              {el?.order_type || "N/A"}
            </TableCell>
            <TableCell {...tableCellStyles}>
              <TagComponent value={el?.order_status} />
            </TableCell>
            <TableCell {...tableCellStyles}>
              <TagComponent value={el?.payment_status} />
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

export default OrdersPage;
