import {
  Box,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import NoData from "../NoData";
import Dropdown from "../Dropdown";
import { ArrowDropDownRounded, ArrowDropUpRounded } from "@mui/icons-material";
import LoadingIcon from "@/assets/Icons/LoadingIcon";
import { drawerWidth } from "@/styles/theme";

interface DataTableProps {
  columns: string[];
  data: any[];
  hasAction?: boolean;
  actionColumn?: (index: number) => JSX.Element | JSX.Element[];
  actionText?: string;
  searchValue?: string;
  loading?: boolean;
}

const DataTable = ({
  columns,
  data,
  hasAction,
  actionColumn,
  actionText,
  searchValue,
  loading,
}: DataTableProps) => {
  const { t } = useTranslation("common");
  const [totalPage, setTotalPage] = useState(Math.ceil(data.length / 5));
  const [localData, setLocalData] = useState<any[]>([]);
  const [paginationOptions, setPaginationOptions] = useState({
    rowsPerPage: 5,
    page: 1,
    currentIndex: 0,
    asc: true,
    searchValue: "",
  });

  useEffect(() => {
    handleAllOperation();
  }, [paginationOptions, data]);

  useEffect(() => {
    setPaginationOptions({
      ...paginationOptions,
      searchValue: searchValue ?? "",
    });
  }, [searchValue]);

  const handleSorting = (tempData: any[]) => {
    const keysName = Object.keys(tempData[0]);
    const sort = {
      currentIndex: paginationOptions.currentIndex,
      asc: paginationOptions.asc,
    };

    const currentKeyName =
      keysName[sort.currentIndex] === "name"
        ? "hidden"
        : keysName[sort.currentIndex];

    tempData.sort((a: any, b: any) => {
      if (a[currentKeyName] < b[currentKeyName]) {
        return sort.asc ? -1 : 1;
      }
      if (a[currentKeyName] > b[currentKeyName]) {
        return sort.asc ? 1 : -1;
      }
      return 0;
    });
    return tempData;
  };

  const handleAllOperation = () => {
    const tempData = [...data];
    const page = paginationOptions.page;
    const rowsPerPage = paginationOptions.rowsPerPage;
    const searchValue = paginationOptions.searchValue;
    const offset = (page - 1) * rowsPerPage;

    const tempArray = tempData.filter((singleData) => {
      const keysName = Object.keys(singleData);
      let flag = false;

      keysName.map((key) => {
        const value: string = singleData[key].toString().toLowerCase();
        if (value.includes(searchValue.toLowerCase())) {
          flag = true;
        }
      });

      return flag;
    });

    const finalArray = tempArray.length > 0 ? handleSorting(tempArray) : [];
    const totalPageCount = Math.ceil(finalArray.length / rowsPerPage);

    setLocalData(finalArray.slice(offset, offset + rowsPerPage));
    setTotalPage(totalPageCount);
  };

  return (
    <>
      <TableContainer sx={{ mt: 2 }}>
        <Table sx={{ minWidth: 650 }} aria-label="simple table">
          <TableHead
            sx={{ "& th": { color: "text.primary", fontWeight: 700 } }}
          >
            <TableRow>
              {columns.map((item, i) => (
                <TableCell
                  key={item}
                  onClick={() =>
                    setPaginationOptions({
                      ...paginationOptions,
                      currentIndex: i,
                      asc: !paginationOptions.asc,
                    })
                  }
                  sx={{ cursor: "pointer" }}
                >
                  <Box
                    sx={{
                      whiteSpace: "nowrap",
                      display: "flex",
                      alignItems: "center",
                      cursor: "pointer",
                      width: "fit-content",
                    }}
                  >
                    {item}
                    {paginationOptions.currentIndex === i && (
                      <div>
                        {paginationOptions.asc ? (
                          <ArrowDropUpRounded />
                        ) : (
                          <ArrowDropDownRounded />
                        )}
                      </div>
                    )}
                  </Box>
                </TableCell>
              ))}
              {hasAction && <TableCell>{actionText ?? ""}</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody sx={{ width: "100%" }}>
            {loading ? (
              <TableRow
                sx={{
                  "&:last-child td": { border: 0, textAlign: "center" },
                }}
              >
                <TableCell colSpan={columns.length + 1}>
                  <Box
                    sx={{
                      height: "50vh",
                      maxHeight: "280px !important",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <LoadingIcon size={75} />
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              <>
                {localData.length > 0 ? (
                  localData.map((row, index) => {
                    const allDataKeys = Object.keys(row);
                    return (
                      <>
                        <TableRow sx={{ "&:last-child td": { border: 0 } }}>
                          {allDataKeys
                            .filter((k) => k !== "hidden" && k !== "id")
                            .map((key: any, localIndex) => (
                              <TableCell
                                sx={{
                                  textTransform:
                                    key === "email" ? "none" : "capitalize",
                                  whiteSpace: "nowrap",
                                  fontWeight: key === "amount" ? 600 : 400,
                                }}
                                key={`${row[key]}_${localIndex}`}
                              >
                                {Array.isArray(row[key])
                                  ? row[key].join(", ")
                                  : row[key] ?? "No Data"}
                              </TableCell>
                            ))}
                          {hasAction && (
                            <TableCell
                              sx={{ width: "480px", whiteSpace: "nowrap" }}
                            >
                              {actionColumn && actionColumn(index)}
                            </TableCell>
                          )}
                        </TableRow>
                      </>
                    );
                  })
                ) : (
                  <TableRow
                    sx={{
                      "&:last-child td": { border: 0, textAlign: "center" },
                    }}
                  >
                    <TableCell colSpan={columns.length + 1}>
                      <NoData />
                    </TableCell>
                  </TableRow>
                )}
              </>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <Box
        sx={{
          mt: 3,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography>{t("rowsPerPage", { defaultValue: "Rows per page:" })}</Typography>
          <Dropdown
            value={paginationOptions.rowsPerPage}
            getValue={(value: any) =>
              setPaginationOptions({
                ...paginationOptions,
                rowsPerPage: value,
                page: 1,
              })
            }
            menuItems={[
              { value: 5, label: 5 },
              { value: 10, label: 10 },
              { value: 15, label: 15 },
              { value: 20, label: 20 },
            ]}
          />
        </Box>
        <Pagination
          color="secondary"
          count={totalPage}
          page={paginationOptions.page}
          onChange={(e, page) =>
            setPaginationOptions({ ...paginationOptions, page })
          }
        />
      </Box>
    </>
  );
};

export default DataTable;
