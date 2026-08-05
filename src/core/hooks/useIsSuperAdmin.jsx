import { useSelector } from "react-redux";

/*
  Same rule as the WithSuperAdmins route guard, exposed as a hook so pages can
  hide super-admin-only actions instead of hiding a whole route.
*/
const useIsSuperAdmin = () => {
  const user = useSelector((state) => state.authentication);

  return user?.user_info?.email?.toLowerCase()?.includes("superadmin") || false;
};

export default useIsSuperAdmin;
