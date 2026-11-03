import { toast } from "react-toastify";

/*
  MS-5078: loadOptions for react-select-async-paginate on top of a lookup fetcher
  (src/core/apis/lookupsAPI.jsx).

  fetcher({ search, page, page_size }) -> res.data.data = { data: [{ id, label, ...extra }], total_count }

  - options keep every field of the item and add `value` (the item's `valueKey`, "id" by default;
    pages that filter by bundle code pass valueKey: "bundle_code");
  - hasMore = page * page_size < total_count (no extra empty request on the last page);
  - on error: the options already loaded stay, hasMore is false and one toast is shown.

  - minSearchLength: a typed search shorter than this sends no request and returns no options
    (an empty search still loads the list); pair it with lookupNoOptionsMessage.

  Use with additional={{ page: 1 }} on AsyncPaginate (LookupSelect does it for you).
*/
export const LOOKUP_PAGE_SIZE = 10;

// The users lookup takes an empty search or at least 2 characters (TEOS-147).
export const USERS_LOOKUP_MIN_SEARCH = 2;

export const isSearchTooShort = (search, minSearchLength = 0) => {
  const length = search?.trim()?.length || 0;
  return length > 0 && length < minSearchLength;
};

// noOptionsMessage for AsyncPaginate: explains why nothing loads while the search is too short.
export const lookupNoOptionsMessage =
  (minSearchLength = 0) =>
  ({ inputValue }) =>
    isSearchTooShort(inputValue, minSearchLength)
      ? `Search should be more than ${minSearchLength - 1} character${minSearchLength > 2 ? "s" : ""}`
      : "No options";

export const toLookupOption = (item, valueKey = "id") => ({
  ...item,
  value: item?.[valueKey],
  label: item?.label ?? "",
});

export const lookupLoadOptions =
  (fetcher, { pageSize = LOOKUP_PAGE_SIZE, valueKey = "id", minSearchLength = 0 } = {}) =>
  async (search, loadedOptions, additional) => {
    const page = additional?.page || 1;
    if (isSearchTooShort(search, minSearchLength)) {
      return { options: [], hasMore: false, additional: { page } };
    }
    try {
      const res = await fetcher({
        search: search?.trim() ? search.trim() : undefined,
        page,
        page_size: pageSize,
      });
      const items = res?.data?.data?.data || [];
      const total = res?.data?.data?.total_count || 0;
      return {
        options: items.map((item) => toLookupOption(item, valueKey)),
        hasMore: page * pageSize < total,
        additional: { page: page + 1 },
      };
    } catch (error) {
      toast.error(error?.message || "Failed to load options");
      return {
        options: [],
        hasMore: false,
        additional: { page },
      };
    }
  };
