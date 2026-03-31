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
import { handleTableResponse } from "../../core/helpers/utilFunctions";
import { getAllUsersDropdown, getUserById } from "../../core/apis/usersAPI";
import useQueryParams from "../../core/custom-hook/useQueryParams";
import { useSearchParams } from "react-router-dom";
import { FormDropdownList } from "../../Components/form-component/FormComponent";

function OrdersPage() {
  const theme = useTheme();

  const asyncPaginateStyles = theme?.asyncPaginateStyles || {};
  const [searchParams] = useSearchParams();
  const supportPromo = import.meta.env.VITE_SUPPORT_PROMO == "true";
  const supportReferral = import.meta.env.VITE_APP_REFER_AND_EARN == "true";

  const [loading, setLoading] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [totalRows, setTotalRows] = useState(0);
  const [data, setData] = useState([]);
  const [searchQueries, setSearchQueries] = useState({
    pageSize: searchParams.get("pageSize") || 10,
    page: searchParams.get("page") || 0,
    user: searchParams.get("user") || null,
    status: searchParams.get("status") || null,
    sortBy: searchParams.get("sortBy") || "created_at",
    sortDirection: searchParams.get("sortDirection") || "desc",
  });

  const statusOptions = [
    { id: "pending", name: "Pending" },
    { id: "success", name: "Success" },
    { id: "canceled", name: "Canceled" },
  ];

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

  const requestSort = (key) => {
    let direction = "desc";

    // toggle direction if sorting on same column
    if (searchQueries.sortBy === key && searchQueries.sortDirection === "asc") {
      direction = "desc";
    }

    setSearchQueries({
      ...searchQueries,
      sortBy: key,
      sortDirection: direction,
      page: 0,
    });
  };

  const getOrders = async () => {
    setLoading(true);

    const { page, pageSize, user, status, sortBy, sortDirection } =
      searchQueries;
    getAllOrders({
      page,
      pageSize,
      user,
      status,
      sortBy,
      sortDirection,
    })
      .then((res) => {
        handleTableResponse(res, setData, setTotalRows, setLoading);
      })
      .catch(() => {
        toast.error("Failed to load orders");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const handleQueryParams = useQueryParams(searchQueries);

  useEffect(() => {
    getOrders();
  }, [searchQueries]);

  const initSelectedUser = async () => {
    if (searchQueries.user && !selectedUser) {
      const user = await getUserById(searchQueries?.user);
      if (user) {
        setSelectedUser({
          value: user?.data?.id,
          label: user?.data?.email || user?.data?.metadata?.email,
        });
      }
    }
  };

  useEffect(() => {
    handleQueryParams();
    initSelectedUser();
  }, [searchQueries]);

  const resetFilters = () => {
    setSearchQueries({
      pageSize: 10,
      page: 0,
      user: null,
      status: null,
    });
    setSelectedUser(null);
    setSelectedStatus(null);
  };

  const applyFilter = () => {
    setSearchQueries({
      ...searchQueries,
      user: selectedUser?.id,
      status: selectedStatus?.id,
      page: 0,
    });
  };

  const tableHeaders = [
    { name: "Order ID" },
    { name: "User Email" },
    { name: "User Phone" },
    { name: "Bundle Name" },
    { name: "Amount", sorted: "amount" },
    ...(supportPromo ? [{ name: "Promo Code" }] : []),
    ...(supportReferral ? [{ name: "Referral Code" }] : []),

    { name: "Order Type" },
    { name: "Order Status" },
    { name: "Payment Status" },

    { name: "Created At", sorted: "created_at" },
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
        applyDisable={!selectedUser && !selectedStatus}
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
          <Grid item size={{ xs: 12, sm: 3 }}>
            <FormControl fullWidth>
              <label className="mb-2" htmlFor="status-input">
                Order Status
              </label>
              <FormDropdownList
                placeholder={"Select Status"}
                value={selectedStatus}
                data={statusOptions || []}
                accessName={"name"}
                onChange={(value) => setSelectedStatus(value)}
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
        requestSort={requestSort}
        sortedBy={searchQueries?.sortBy}
        sortDirection={searchQueries?.sortDirection}
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
            {supportPromo && (
              <TableCell {...tableCellStyles}>
                {el?.promo_code || "N/A"}
              </TableCell>
            )}
            {supportReferral && (
              <TableCell {...tableCellStyles}>
                {el?.referral_code || "N/A"}
              </TableCell>
            )}

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
