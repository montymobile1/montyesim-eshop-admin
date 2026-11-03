import { useTheme } from "@mui/material";
import { useMemo } from "react";
import { AsyncPaginate } from "react-select-async-paginate";
import usePermission from "../../../core/hooks/usePermission";
import {
  lookupLoadOptions,
  lookupNoOptionsMessage,
  LOOKUP_PAGE_SIZE,
} from "./lookupLoadOptions";

/*
  MS-5078: async dropdown on an admin API lookup (GET /<resource>/lookup).

  <LookupSelect
    fetcher={getUsersLookup}            // from src/core/apis/lookupsAPI.jsx
    permission={PERMISSIONS.USERS_READ} // optional: disabled when the admin lacks it
    value={selected} onChange={setSelected}
    placeholder="Select User Email"
  />

  Same look and behaviour as the AsyncPaginate selects on the pages today (theme asyncPaginateStyles,
  300 ms debounce, clearable, searchable). Any other AsyncPaginate prop (isMulti, inputId,
  menuPortalTarget, isDisabled...) is passed through. valueKey picks the option value ("id" by default).
  minSearchLength: shorter typed searches send no request and the menu says why
  (users dropdowns pass USERS_LOOKUP_MIN_SEARCH, TEOS-147).
*/
const LookupSelect = ({
  fetcher,
  permission,
  valueKey = "id",
  pageSize = LOOKUP_PAGE_SIZE,
  minSearchLength = 0,
  isDisabled = false,
  styles,
  cacheUniqs = [],
  ...props
}) => {
  const theme = useTheme();
  const allowed = usePermission(permission);

  const loadOptions = useMemo(
    () => lookupLoadOptions(fetcher, { pageSize, valueKey, minSearchLength }),
    [fetcher, pageSize, valueKey, minSearchLength]
  );

  return (
    <AsyncPaginate
      isClearable
      isSearchable
      debounceTimeout={300}
      noOptionsMessage={lookupNoOptionsMessage(minSearchLength)}
      {...props}
      loadOptions={loadOptions}
      additional={{ page: 1 }}
      cacheUniqs={[fetcher, valueKey, ...cacheUniqs]}
      isDisabled={isDisabled || !allowed}
      styles={{ ...(theme?.asyncPaginateStyles || {}), ...(styles || {}) }}
    />
  );
};

export default LookupSelect;
