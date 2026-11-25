import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import LogoutIcon from "@mui/icons-material/Logout";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import MenuIcon from "@mui/icons-material/Menu";
import { Box, IconButton, Menu, MenuItem, useMediaQuery } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import clsx from "clsx";
import { useState } from "react";
import { LazyLoadImage } from "react-lazy-load-image-component";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { logout } from "../../core/apis/authAPI";
import { queryClient } from "../../core/apis/ReactQueryInstance";
import { SignOut } from "../../Redux/reducers/AuthReducer";
import { toggleSidebar } from "../../Redux/reducers/SidebarReducer";

export default function TopNav() {
  const isSmall = useMediaQuery("(max-width: 1024px)");

  const { isAuthenticated } = useSelector((state) => state.authentication);
  const theme = useTheme();
  const dispatch = useDispatch();
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
    handleMenuClose();
    // Best effort: the local session is cleared even if the API call fails
    try {
      await logout();
    } catch (e) {
      console.error("Failed to revoke the session:", e?.message);
    }
    dispatch(SignOut());
    queryClient.clear();
  };

  return (
    <Box
      className={clsx("w-full sm:p-4  h-[80px] fixed top-0 z-10")}
      sx={{
        backgroundColor: alpha(theme.palette.background.paper, 0.85),
        backdropFilter: "saturate(180%) blur(8px)",
        borderBottom: `1px solid ${theme.palette.divider}`,
      }}
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
        <MenuItem
          onClick={() => {
            handleMenuClose();
            navigate("/profile");
          }}
        >
          <PersonOutlineIcon fontSize="small" sx={{ mr: 1 }} /> Profile
        </MenuItem>
        <MenuItem onClick={handleSignOut}>
          <LogoutIcon fontSize="small" sx={{ mr: 1 }} /> Logout
        </MenuItem>
      </Menu>
    </Box>
  );
}
