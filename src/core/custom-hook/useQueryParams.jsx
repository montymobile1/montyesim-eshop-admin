import { useLocation, useNavigate } from "react-router-dom";
import { useCallback } from "react";

const useQueryParams = (filters) => {
  const location = useLocation();
  const navigate = useNavigate();

  let { pathname, search } = location;

  // Parsing the query string
  const query = new URLSearchParams(search);

  const handleQueryParams = useCallback(() => {
    const params = new URLSearchParams();

    // Clear existing parameters if they're no longer valid
    query.forEach((value, key) => {
      if (pathname?.includes(`[${key}]`)) {
        // For pathname that includes ids to be replaced by the id value
        pathname = pathname.replace(`[${key}]`, value);
      }
      if (
        !Object.prototype.hasOwnProperty.call(filters, key) ||
        filters[key] === "" ||
        filters[key] === null ||
        (Array.isArray(filters[key]) && filters[key].length === 0)
      ) {
        params.delete(key);
      }
    });

    // Add new parameters, ensuring no duplicates for arrays
    Object.entries(filters).forEach(([key, value]) => {
      if (
        value !== "" &&
        value !== null &&
        value !== undefined &&
        !(Array.isArray(value) && value.length === 0)
      ) {
        if (Array.isArray(value)) {
          const uniqueItems = new Set(value); // Create a set to remove duplicates
          uniqueItems.forEach((item) => params.append(key, item));
        } else {
          params.set(key, value.toString());
        }
      }
    });

    // Construct the new URL with the non-empty parameters
    const newUrl = params.toString()
      ? `${pathname}?${params.toString()}`
      : pathname;

    // Update the URL in the browser using navigate
    navigate(newUrl, { state: location?.state });
  }, [filters, pathname, query, navigate]);

  return handleQueryParams;
};

export default useQueryParams;
