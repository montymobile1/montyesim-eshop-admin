import "@testing-library/jest-dom";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import useUrlQueries, {
  lastValidPage,
  toSearchString,
  useLastValidPage,
} from "../core/custom-hook/useUrlQueries";

/*
  TEOS-286 / TEOS-287: the shared URL <-> list state hook and the last-valid-page clamp.
  MemoryRouter keeps its own history, so Back / Forward are navigate(-1) / navigate(1)
  and the entry count is read from the history index.
*/

const read = (searchParams) => ({
  search: searchParams.get("search") || "",
  pageSize: Number(searchParams.get("pageSize")) || 10,
  page: Number(searchParams.get("page")) || 0,
});

let api;
const Probe = ({ onUrlChange }) => {
  const [queries, setQueries] = useUrlQueries(read, { onUrlChange });
  const location = useLocation();
  const navigate = useNavigate();
  api = { queries, setQueries, navigate };
  return (
    <>
      <span data-testid="url">{location.pathname + location.search}</span>
      <span data-testid="page">{queries.page}</span>
      <span data-testid="key">{location.key}</span>
    </>
  );
};

const renderProbe = (entries, props = {}) =>
  render(
    <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
      <Probe {...props} />
    </MemoryRouter>
  );

const url = () => screen.getByTestId("url").textContent;
const page = () => screen.getByTestId("page").textContent;

describe("toSearchString", () => {
  it("leaves out empty values and repeats array keys once per value", () => {
    expect(
      toSearchString({ a: "", b: null, c: undefined, d: [], e: 0, f: ["x", "x", "y"], g: "z" })
    ).toBe("?e=0&f=x&f=y&g=z");
    expect(toSearchString({ a: "" })).toBe("");
  });
});

describe("lastValidPage", () => {
  it("is the last page index, never below 0", () => {
    expect(lastValidPage(21, 10)).toBe(2);
    expect(lastValidPage(20, 10)).toBe(1);
    expect(lastValidPage(0, 10)).toBe(0);
  });
});

describe("useUrlQueries (TEOS-287)", () => {
  it("reads the URL on mount and replaces it with the normalised one (no new entry)", async () => {
    renderProbe(["/list", "/list?page=2"]);
    await waitFor(() => expect(url()).toBe("/list?pageSize=10&page=2"));
    expect(page()).toBe("2");

    // Back still goes to the entry before, not to the un-normalised URL
    act(() => api.navigate(-1));
    await waitFor(() => expect(url()).toBe("/list?pageSize=10&page=0"));
  });

  it("a page change pushes, Back and Forward make the state follow the URL", async () => {
    const onUrlChange = vi.fn();
    renderProbe(["/other", "/list?pageSize=10&page=0"], { onUrlChange });

    act(() => api.setQueries({ ...api.queries, page: 1 }));
    await waitFor(() => expect(url()).toBe("/list?pageSize=10&page=1"));

    act(() => api.navigate(-1));
    await waitFor(() => expect(page()).toBe("0"));
    expect(url()).toBe("/list?pageSize=10&page=0");
    expect(onUrlChange).toHaveBeenLastCalledWith({ search: "", pageSize: 10, page: 0 });

    act(() => api.navigate(1));
    await waitFor(() => expect(page()).toBe("1"));
    expect(url()).toBe("/list?pageSize=10&page=1");

    // two Backs: the list entry, then /other (the page change added exactly one entry)
    act(() => api.navigate(-2));
    // (the probe also normalises /other)
    await waitFor(() => expect(url()).toBe("/other?pageSize=10&page=0"));
  });

  it("following the URL writes nothing back (no loop, no extra entry)", async () => {
    renderProbe(["/list?pageSize=10&page=0"]);
    act(() => api.setQueries({ ...api.queries, page: 1 }));
    await waitFor(() => expect(page()).toBe("1"));
    act(() => api.navigate(-1));
    await waitFor(() => expect(page()).toBe("0"));
    const key = screen.getByTestId("key").textContent;

    // let any effect run: the location must stay the same entry
    await act(async () => {});
    expect(screen.getByTestId("key").textContent).toBe(key);
    act(() => api.navigate(1));
    await waitFor(() => expect(page()).toBe("1"));
  });

  it("setQueries with replace swaps the current entry instead of adding one", async () => {
    renderProbe(["/other", "/list?pageSize=10&page=9"]);
    act(() => api.setQueries({ ...api.queries, page: 2 }, { replace: true }));
    await waitFor(() => expect(url()).toBe("/list?pageSize=10&page=2"));

    act(() => api.navigate(-1));
    // the entry before the bad URL (the probe also normalises /other)
    await waitFor(() => expect(url()).toBe("/other?pageSize=10&page=0"));
  });
});

describe("useLastValidPage (TEOS-286)", () => {
  const run = (props) => {
    const onChange = vi.fn();
    renderHook(() => useLastValidPage({ pageSize: 10, onChange, ...props }));
    return onChange;
  };

  it("moves an empty page past the end to the last page", () => {
    expect(run({ page: 99, totalRows: 21, rowCount: 0, isFetching: false })).toHaveBeenCalledWith(2);
  });

  it("waits for the request, and leaves pages with rows, empty lists, page 1 and errors", () => {
    expect(run({ page: 99, totalRows: 21, rowCount: 0, isFetching: true })).not.toHaveBeenCalled();
    expect(run({ page: 1, totalRows: 21, rowCount: 10, isFetching: false })).not.toHaveBeenCalled();
    expect(run({ page: 3, totalRows: 0, rowCount: 0, isFetching: false })).not.toHaveBeenCalled();
    expect(run({ page: 0, totalRows: 21, rowCount: 0, isFetching: false })).not.toHaveBeenCalled();
    expect(
      run({ page: 5, totalRows: 21, rowCount: 0, isFetching: false, isError: true })
    ).not.toHaveBeenCalled();
  });
});
