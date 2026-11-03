import { useSelector } from "react-redux";

// Pure check, usable outside components (e.g. to filter menu items)
export const hasPermission = (permissions, permission) => {
  if (!permission) return true;
  return Array.isArray(permissions) && permissions.includes(permission);
};

/*
  usePermission("admin.users.ban") -> true when the signed in admin has it.
  Permissions come from the admin API (login, refresh, GET /auth/me).
*/
const usePermission = (permission) => {
  const permissions = useSelector(
    (state) => state.authentication?.user_info?.permissions
  );

  return hasPermission(permissions, permission);
};

export default usePermission;
