import React, { useEffect, useMemo, useRef, useState } from "react";

import MuiSideNavigation from "./sidebar/MuiSideNavigation ";
import { Box, CssBaseline, IconButton } from "@mui/material";
import TopNav from "./TopNav";
import useRouteName from "../../core/hooks/useRouteName";
import { useLocation, useNavigate } from "react-router-dom";
import ArrowBackIosIcon from "@mui/icons-material/ArrowBackIos";
import { backTarget } from "../../core/helpers/backTarget";

const AuthLayout = ({ children }) => {
  const routeName = useRouteName();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const current = useRef(`${pathname}${search}`);
  const [previous, setPrevious] = useState(null);

  // Remembers the last URL of the page we came from, filters included.
  useEffect(() => {
    if (current.current.split("?")[0] !== pathname) {
      setPrevious(current.current);
    }
    current.current = `${pathname}${search}`;
  }, [pathname, search]);

  const routeLength = useMemo(() => {
    return pathname?.split("/")?.length;
  }, [pathname]);
  return (
    <Box sx={{ display: "flex", flexFlow: "row nowrap", gap: "2px" }}>
      <CssBaseline />

      <MuiSideNavigation />
      <TopNav />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          height: "100vh",
          overflow: "hidden",
          overflowY: "auto",
        }}
      >
        <div className="mt-[80px] p-3 sm:p-6 h-[calc(100vh-80px)]">
          <div className={"flex flex-row items-center gap-1 mb-4"}>
            {routeLength > 2 && (
              <IconButton
                aria-label="Back"
                // read by useLeaveGuard, so a page with unsaved changes can hold it
                data-leave-target={backTarget(pathname, previous)}
                onClick={() => navigate(backTarget(pathname, previous))}
              >
                <ArrowBackIosIcon fontSize="small" color="primary" />
              </IconButton>
            )}
            <h1>{routeName}</h1>
          </div>
          {children}
        </div>
      </Box>
    </Box>
  );
};

export default AuthLayout;
