import { Outlet } from "react-router-dom";
import MainLayout from "../../Components/layout/MainLayout";

/*
  TEOS-307: layout of /reset-password. Unlike RouteWrapper it never redirects:
  the page must open from the email link whether this browser is signed in or not.
  Always the public layout (no sidebar): the reset is about the account in the link.
*/
const ResetPasswordWrapper = () => (
  <MainLayout>
    <Outlet />
  </MainLayout>
);

export default ResetPasswordWrapper;
