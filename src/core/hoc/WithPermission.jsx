import NoPermission from "../../Components/shared/fallbacks/no-permission/NoPermission";
import usePermission from "../hooks/usePermission";

/*
  Route / section guard. Renders the "access denied" fallback when the admin
  lacks the permission (TEOS-222: no longer "page not found", which is kept for
  URLs that do not exist), or the given fallback (pass fallback={null} to
  render nothing).
*/
export function WithPermission({ permission, fallback, children }) {
  const allowed = usePermission(permission);

  if (!allowed) {
    return fallback === undefined ? <NoPermission /> : fallback;
  }

  return children;
}
