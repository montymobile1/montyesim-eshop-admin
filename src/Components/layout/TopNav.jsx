import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";
import { Box, IconButton, Menu, MenuItem, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import clsx from "clsx";
import { useState } from "react";
import { LazyLoadImage } from "react-lazy-load-image-component";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { userSignout } from "../../core/apis/usersAPI";
import { SignOut } from "../../Redux/reducers/AuthReducer";
import { toggleSidebar } from "../../Redux/reducers/SidebarReducer";

export default function TopNav() {
  const isSmall = useMediaQuery("(max-width: 1024px)");

  const { isAuthenticated } = useSelector((state) => state.authentication);
  const theme = useTheme();
  const dispatch = useDispatch();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  // Menu state
  const [anchorEl, setAnchorEl] = useState(null);

  const open = Boolean(anchorEl);

  // Handle menu open
  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  // Handle menu close
  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleSignOut = async () => {
    await userSignout().then((res) => {
      if (res?.error) {
        toast.error("Failed to signout");
      } else {
        dispatch(SignOut());
      }
    });
  };

  return (
    <Box
      className={clsx("w-full shadow-md sm:p-4  h-[80px] fixed top-0 z-10")}
      sx={{ backgroundColor: theme.palette.background.paper }}
    >
      <div className="flex items-center w-full h-[100%] justify-between">
        {isAuthenticated && isSmall && (
          <IconButton
            onClick={() => {
              dispatch(toggleSidebar());
            }}
          >
            <MenuIcon fontSize="medium" color="primary" />{" "}
          </IconButton>
        )}
        {!isAuthenticated && (
          <button
            onClick={() => navigate("/signin")}
            className="flex items-center"
          >
            <LazyLoadImage
              alt={import.meta.env.VITE_APP_PROJECT_TITLE}
              src={"/logo/logo.png"}
              className="h-full w-auto object-cover"
            />
          </button>
        )}

        <div className="flex-1" />

        <div className="flex items-center gap-4">
          {isAuthenticated && (
            <IconButton onClick={handleMenuOpen}>
              <AccountCircleIcon fontSize="medium" color="primary" />
            </IconButton>
          )}
        </div>
      </div>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleMenuClose}
        onMouseLeave={handleMenuClose} // Close on mouse leave
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
      >
        <MenuItem onClick={handleSignOut}>
          <LogoutIcon fontSize="small" sx={{ mr: 1 }} /> Logout
        </MenuItem>
      </Menu>
    </Box>
  );
}
