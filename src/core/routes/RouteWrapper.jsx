import React, { useState } from "react";
import { useSelector } from "react-redux";
import {
  Navigate,
  Outlet,
  useLocation,
  useSearchParams,
} from "react-router-dom";
import MainLayout from "../../Components/layout/MainLayout";
import AuthLayout from "../../Components/layout/AuthLayout";
import { signInUrl } from "../apis/axios";

const RouteWrapper = ({
  shouldbeLoggedIn,
  element,
  isPrivate,
  isAuthRestricted,
}) => {
  const { isAuthenticated, signOutReason } = useSelector(
    (state) => state.authentication
  );

  const [open, setOpen] = useState(true);
  const location = useLocation();

  const [searchParams] = useSearchParams();
  const next = searchParams.get("next");
  if (shouldbeLoggedIn && !isAuthenticated) {
    return (
      <Navigate
        // TEOS-145: the reason of a forced sign-out goes along, so the sign-in page shows it
        to={
          location?.pathname
            ? signInUrl(location.pathname, signOutReason)
            : "signin"
        }
        replace
      />
    );
  } else if (!shouldbeLoggedIn && isAuthenticated) {
    return <Navigate to={next ? decodeURIComponent(next) : "/users"} />;
  }

  const Layout = isAuthenticated ? AuthLayout : MainLayout;

  return (
    <Layout
      isPublic={!isPrivate && !isAuthRestricted}
      isAuthRestricted={isAuthRestricted}
      open={open}
      setOpen={setOpen}
    >
      <Outlet />
    </Layout>
  );
};

export default RouteWrapper;
