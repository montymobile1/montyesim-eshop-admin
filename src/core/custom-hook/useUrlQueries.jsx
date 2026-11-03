import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/*
  TEOS-287: the list filters (page, page size, search...) kept in the URL, both ways.

  - The state is read from the URL on mount, and again whenever the URL changes without the
    page writing it (browser Back / Forward, a menu link to the same page), so the table
    follows the URL.
  - A state change writes the URL: a push by default (a page change, a filter), so Back goes
    to the previous page; setQueries(next, { replace: true }) replaces the entry instead (the
    page past the end moved to the last valid page). A URL that is only normalised (read from
    the URL, written back with the defaults) is replaced too, never pushed.
  - Nothing is written when the URL already matches, so URL -> state -> URL does not loop.

  readQueries(searchParams) turns the URL into the page's queries (unknown values fall back to
  the defaults). onUrlChange(queries) is called after a Back / Forward so the page can reset
  its filter inputs to the URL.
*/

// Same encoding as useQueryParams: empty values are left out, arrays repeat the key.
export const toSearchString = (queries) => {
  const params = new URLSearchParams();
  Object.entries(queries).forEach(([key, value]) => {
    if (
      value === "" ||
      value === null ||
      value === undefined ||
      (Array.isArray(value) && value.length === 0)
    ) {
      return;
    }
    if (Array.isArray(value)) {
      new Set(value).forEach((item) => params.append(key, item));
    } else {
      params.set(key, value.toString());
    }
  });
  const search = params.toString();
  return search ? `?${search}` : "";
};

const useUrlQueries = (readQueries, { onUrlChange } = {}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [queries, setQueriesState] = useState(() =>
    readQueries(new URLSearchParams(location.search))
  );

  const latestLocation = useRef(location);
  latestLocation.current = location;
  const onUrlChangeRef = useRef(onUrlChange);
  onUrlChangeRef.current = onUrlChange;
  // the search the state was last read from or written to
  const syncedSearch = useRef(location.search);
  // the queries whose URL replaces the current entry (read from the URL, or set with replace)
  const replaceFor = useRef(queries);

  // URL -> state: Back / Forward or a link changed the URL the page did not write.
  useEffect(() => {
    if (location.search === syncedSearch.current) return;
    syncedSearch.current = location.search;
    const next = readQueries(new URLSearchParams(location.search));
    replaceFor.current = next;
    setQueriesState(next);
    onUrlChangeRef.current?.(next);
  }, [location.search]);

  // state -> URL
  useEffect(() => {
    const { pathname, search, state } = latestLocation.current;
    const nextSearch = toSearchString(queries);
    const replace = replaceFor.current === queries;
    if (nextSearch === search || nextSearch === syncedSearch.current) return;
    syncedSearch.current = nextSearch;
    navigate(`${pathname}${nextSearch}`, { replace, state });
  }, [queries]);

  const setQueries = useCallback((next, { replace = false } = {}) => {
    if (replace) replaceFor.current = next;
    setQueriesState(next);
  }, []);

  return [queries, setQueries];
};

/*
  TEOS-286: a page past the end (stale URL, rows removed) moves to the last valid page.
  onChange(lastPage) is called once the request for the page is back with no rows while the
  list still has rows; the page then sets it with { replace: true } (TEOS-287).
*/
export const lastValidPage = (totalRows, pageSize) =>
  Math.max(0, Math.ceil(totalRows / pageSize) - 1);

export const useLastValidPage = ({
  page,
  pageSize,
  totalRows,
  rowCount,
  isFetching,
  isError = false,
  onChange,
}) => {
  useEffect(() => {
    if (isFetching || isError || rowCount > 0 || totalRows <= 0 || page <= 0) return;
    const last = lastValidPage(totalRows, pageSize);
    if (last !== page) onChange(last);
  }, [isFetching, isError, rowCount, totalRows, page, pageSize]);
};

export default useUrlQueries;
