//UTILITIES
import dayjs from "dayjs";
import { useEffect, useState } from "react";
//COMPONENT
import SearchIcon from "@mui/icons-material/Search";
import { Card, FormControl, TableCell, TextField } from "@mui/material";
import Grid from "@mui/material/Grid2";
import { toast } from "react-toastify";
import Filters from "../../Components/Filters/Filters";
import ContactUsDetail from "../../Components/page-component/contact-us/ContactUsDetail";
import RowComponent from "../../Components/shared/table-component/RowComponent";
import TableComponent from "../../Components/shared/table-component/TableComponent";
import TablePaginationComponent from "../../Components/shared/table-component/TablePaginationComponent";
import { getAllMessages } from "../../core/apis/contactusAPI";
import { handleTableResponse } from "../../core/helpers/utilFunctions";

function ContactusPage() {
  const [loading, setLoading] = useState(null);
  const [searchQueries, setSearchQueries] = useState({
    name: "",
    pageSize: 10,
    page: 0,
  });
  const [search, setSearch] = useState("");
  const [totalRows, setTotalRows] = useState(0);
  const [data, setData] = useState([]);
  const [openDetail, setOpenDetail] = useState({ id: null, details: null });

  const tableHeaders = [
    { name: "Email" },
    { name: "Content" },
    { name: "Created At" },
  ];

  const tableCellStyles = {
    sx: { minWidth: "200px" },
    className: "max-w-[250px] truncate",
  };

  const getContactus = async () => {
    setLoading(true);

    const { page, pageSize, name } = searchQueries;
    getAllMessages({
      page,
      pageSize,
      name,
    })
      .then((res) => {
        handleTableResponse(res, setData, setTotalRows, setLoading);
      })
      .catch((e) => {
        toast.error("Failed to load messages");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    getContactus();
  }, [searchQueries]);

  const resetFilters = () => {
    setSearchQueries({ name: "", pageSize: 10, page: 0 });
    setSearch("");
  };

  const applyFilter = () => {
    setSearchQueries({ ...searchQueries, name: search });
  };

  return (
    <Card className="page-card">
      <Filters
        onReset={resetFilters}
        onApply={applyFilter}
        applyDisable={!search}
      >
        <Grid container size={{ xs: 12 }} spacing={2}>
          <Grid item size={{ xs: 12, sm: 3 }}>
            <FormControl fullWidth>
              <label className="mb-2" htmlFor="email-input">
                Email
              </label>
              <TextField
                id="email-input"
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
        </Grid>
      </Filters>
      <TableComponent
        loading={loading}
        dataPerPage={searchQueries?.pageSize}
        tableData={data}
        noDataFound={"No Messages Found"}
        tableHeaders={tableHeaders}
        actions={true}
      >
        {data?.map((el) => (
          <RowComponent
            key={el?.id}
            actions={true}
            onView={() =>
              setOpenDetail({
                id: el?.id,
                details: el,
              })
            }
          >
            <TableCell {...tableCellStyles}>{el?.email || "N/A"}</TableCell>
            <TableCell {...tableCellStyles}>{el?.content || "N/A"}</TableCell>
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

      {openDetail?.id && (
        <ContactUsDetail
          onClose={() => setOpenDetail(null)}
          data={openDetail?.details || ""}
        />
      )}
    </Card>
  );
}

export default ContactusPage;
