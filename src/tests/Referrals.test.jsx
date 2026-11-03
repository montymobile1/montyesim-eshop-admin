import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import { saveAs } from "file-saver";
import { toast } from "react-toastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignIn, SignOut } from "../Redux/reducers/AuthReducer";
import { store } from "../Redux/store";
import { getUsersLookup } from "../core/apis/lookupsAPI";
import { PERMISSIONS } from "../core/vairables/Permissions";
import Referrals from "../pages/referral/Referrals";
import { render, screen, waitFor } from "./utils/test-utils";

vi.mock("react-countup", () => ({ default: ({ end }) => <span>{end}</span> }));
vi.mock("file-saver", () => ({ saveAs: vi.fn() }));

vi.mock("react-toastify", async () => {
  const actual = await vi.importActual("react-toastify");
  return {
    ...actual,
    toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  };
});

vi.mock("../core/apis/referralsAPI", async () => {
  const actual = await vi.importActual("../core/apis/referralsAPI");
  return {
    ...actual, // real readExportError, exportFileName, getApiErrorCode
    getAllReferrals: vi.fn(),
    exportReferrals: vi.fn(),
    getReferralsFilterUser: vi.fn(),
  };
});

vi.mock("../core/apis/lookupsAPI", () => ({
  getUsersLookup: vi.fn(),
}));

import * as referralsAPI from "../core/apis/referralsAPI";

const signInWith = (permissions) =>
  store.dispatch(
    SignIn({
      access_token: "token",
      refresh_token: "refresh",
      expires_in: 3600,
      user: { id: "id", email: "a@example.com", role: "admin", permissions },
    })
  );

const listResponse = (rows, total = rows.length) => ({
  data: { data: { data: rows, total_count: total } },
});

const ROWS = [
  {
    id: "order-1",
    created_at: "2026-10-20T10:00:00",
    payment_time: "2026-10-20T10:05:00",
    referral_code: "ABC123",
    amount: 2.5,
    currency: "EUR",
    modified_amount: 9.5,
    order_status: "success",
    status: "completed",
    referrer: { id: "r1", email: "owner@example.com" },
    referred: { id: "u1", email: "buyer@example.com" },
  },
  {
    id: "order-2",
    created_at: "2026-10-19T10:00:00",
    payment_time: null,
    referral_code: "XYZ",
    amount: 1,
    currency: "USD",
    modified_amount: null,
    order_status: "success",
    status: "pending",
    referrer: null,
    referred: { id: "u2", email: null },
  },
];

const apiError = (status, body) =>
  Object.assign(new Error("Request failed"), {
    response: { status, data: body },
  });

const lastListParams = () => referralsAPI.getAllReferrals.mock.calls.at(-1)[0];

describe("Referrals page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, "", "/referrals");
    referralsAPI.getAllReferrals.mockResolvedValue(listResponse(ROWS, 2));
    referralsAPI.getReferralsFilterUser.mockResolvedValue(listResponse([]));
    getUsersLookup.mockResolvedValue(listResponse([]));
  });

  afterEach(() => {
    store.dispatch(SignOut());
  });

  it("loads page 1 from the API and shows the joined emails", async () => {
    signInWith([PERMISSIONS.REFERRALS_READ]);
    render(<Referrals />);

    expect(await screen.findByText("ABC123")).toBeInTheDocument();
    expect(screen.getByText("buyer@example.com")).toBeInTheDocument();
    expect(screen.getByText("owner@example.com")).toBeInTheDocument();
    expect(screen.getByText("order-1")).toBeInTheDocument();
    expect(screen.getAllByText("N/A").length).toBeGreaterThan(0);
    expect(referralsAPI.getAllReferrals).toHaveBeenCalledWith({
      page: 1,
      page_size: 10,
      user_id: undefined,
      search: undefined,
      from_email: undefined,
      date: undefined,
    });
  });

  it("without the export permission there is no Export button", async () => {
    signInWith([PERMISSIONS.REFERRALS_READ]);
    render(<Referrals />);
    await screen.findByText("ABC123");

    expect(screen.queryByRole("button", { name: /export/i })).not.toBeInTheDocument();
  });

  it("restores the filters from the URL and shows the To User email", async () => {
    signInWith([PERMISSIONS.REFERRALS_READ]);
    window.history.pushState(
      {},
      "",
      "/referrals?user=u9&from_email=buyer%40example.com&search=abc&date=2026-10-20&page=1&pageSize=25"
    );
    referralsAPI.getReferralsFilterUser.mockResolvedValue(
      listResponse([{ id: "u9", label: "picked@example.com", email: "picked@example.com" }])
    );
    render(<Referrals />);

    await waitFor(() => expect(referralsAPI.getAllReferrals).toHaveBeenCalled());
    expect(lastListParams()).toEqual({
      page: 2,
      page_size: 25,
      user_id: "u9",
      search: "abc",
      from_email: "buyer@example.com",
      date: "2026-10-20",
    });
    expect(referralsAPI.getReferralsFilterUser).toHaveBeenCalledWith("u9");
    expect(await screen.findByText("picked@example.com")).toBeInTheDocument();
  });

  it("Apply sends the search and the date from page 1 and writes them to the URL", async () => {
    signInWith([PERMISSIONS.REFERRALS_READ]);
    window.history.pushState({}, "", "/referrals?page=3");
    render(<Referrals />);
    await screen.findByText("ABC123");

    await userEvent.type(screen.getByPlaceholderText("Search by code"), "abc");
    await userEvent.type(document.querySelector("input[type=date]"), "2026-10-20");
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() =>
      expect(lastListParams()).toEqual(
        expect.objectContaining({ page: 1, search: "abc", date: "2026-10-20" })
      )
    );
    expect(window.location.search).toContain("search=abc");
    expect(window.location.search).toContain("date=2026-10-20");
    expect(window.location.search).not.toContain("page=3");
  });

  it("Export posts the current filters and saves the file", async () => {
    signInWith([PERMISSIONS.REFERRALS_READ, PERMISSIONS.REFERRALS_EXPORT]);
    window.history.pushState({}, "", "/referrals?search=abc&user=u9&date=2026-10-20");
    const blob = new Blob(["xlsx"]);
    referralsAPI.exportReferrals.mockResolvedValue({ data: blob });
    render(<Referrals />);
    await screen.findByText("ABC123");

    await userEvent.click(screen.getByRole("button", { name: "Export" }));

    await waitFor(() => expect(saveAs).toHaveBeenCalled());
    expect(referralsAPI.exportReferrals).toHaveBeenCalledTimes(1);
    expect(referralsAPI.exportReferrals).toHaveBeenCalledWith({
      user_id: "u9",
      search: "abc",
      from_email: undefined,
      date: "2026-10-20",
    });
    const [saved, name] = saveAs.mock.calls[0];
    expect(saved).toBe(blob);
    expect(name).toMatch(/^referrals-\d{4}-\d{2}-\d{2}-\d{6}\.xlsx$/);
    expect(toast.success).toHaveBeenCalledWith("Exported Successfully");
  });

  it("422 too_many_rows on export shows the narrow-the-filters message", async () => {
    signInWith([PERMISSIONS.REFERRALS_READ, PERMISSIONS.REFERRALS_EXPORT]);
    referralsAPI.exportReferrals.mockRejectedValue(
      apiError(422, {
        message: "Validation failed",
        developerMessage: JSON.stringify({ code: "too_many_rows", total: 60000, cap: 50000 }),
      })
    );
    render(<Referrals />);
    await screen.findByText("ABC123");

    await userEvent.click(screen.getByRole("button", { name: "Export" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Too many rows, narrow the filters")
    );
    expect(saveAs).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Export" })).toBeEnabled();
  });

  it("a failed list shows an error toast and the table's empty row, no Retry", async () => {
    signInWith([PERMISSIONS.REFERRALS_READ]);
    referralsAPI.getAllReferrals.mockRejectedValue(new Error("boom"));
    render(<Referrals />);

    expect(await screen.findByText("No Referral Transactions Found")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith("Failed to load referral transactions");
  });

  it("TEOS-236: after Apply the table shows only the new rows, even when an order has two usage rows", async () => {
    // a referral order has one usage row per rewarded side (sender and receiver), so `id` repeats
    const usageRows = (orderIds, code) =>
      orderIds.flatMap((orderId) =>
        ["sender@example.com", "receiver@example.com"].map((email) => ({
          ...ROWS[0],
          id: orderId,
          referral_code: code,
          referrer: { id: email, email },
        }))
      );
    signInWith([PERMISSIONS.REFERRALS_READ]);
    referralsAPI.getAllReferrals.mockResolvedValueOnce(
      listResponse(usageRows(["order-a", "order-b", "order-c"], "OLD1"), 6)
    );
    referralsAPI.getAllReferrals.mockResolvedValue(
      listResponse(usageRows(["order-b", "order-d"], "0CF9"), 4)
    );
    render(<Referrals />);
    await waitFor(() => expect(screen.getAllByText("OLD1")).toHaveLength(6));

    await userEvent.type(screen.getByPlaceholderText("Search by code"), "0CF9");
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => expect(screen.getAllByText("0CF9")).toHaveLength(4));
    expect(screen.queryByText("OLD1")).not.toBeInTheDocument();
    expect(document.querySelectorAll("tbody tr")).toHaveLength(4);
  });

  it("a page past the end moves to the last valid page (TEOS-237)", async () => {
    signInWith([PERMISSIONS.REFERRALS_READ]);
    window.history.pushState({}, "", "/referrals?pageSize=10&page=9");
    referralsAPI.getAllReferrals.mockImplementation(async (params) =>
      params.page === 3 ? listResponse(ROWS, 24) : listResponse([], 24)
    );
    render(<Referrals />);

    await waitFor(() => expect(lastListParams()).toEqual(expect.objectContaining({ page: 3 })));
    expect(await screen.findByText("ABC123")).toBeInTheDocument();
    await waitFor(() => expect(window.location.search).toContain("page=2"));
  });

  it("the clamp replaces the out-of-range URL, so Back skips it (TEOS-287)", async () => {
    signInWith([PERMISSIONS.REFERRALS_READ]);
    window.history.pushState({}, "", "/referrals?pageSize=10&page=9");
    const entries = window.history.length;
    referralsAPI.getAllReferrals.mockImplementation(async (params) =>
      params.page === 3 ? listResponse(ROWS, 24) : listResponse([], 24)
    );
    render(<Referrals />);

    await waitFor(() => expect(window.location.search).toContain("page=2"));
    expect(await screen.findByText("ABC123")).toBeInTheDocument();
    expect(window.history.length).toBe(entries);

    // Back goes to the entry before the bad URL (here /referrals, then page 1 of the list)
    window.history.back();
    await waitFor(() => expect(window.location.search).toContain("page=0"));
    expect(window.location.search).not.toContain("page=9");
  });

  it("Back after a page change shows the earlier page again (TEOS-287)", async () => {
    signInWith([PERMISSIONS.REFERRALS_READ]);
    referralsAPI.getAllReferrals.mockImplementation(async (params) =>
      listResponse(
        [{ ...ROWS[0], id: `order-p${params.page}`, referral_code: `CODE-P${params.page}` }],
        24
      )
    );
    render(<Referrals />);
    expect(await screen.findByText("CODE-P1")).toBeInTheDocument();
    const entries = window.history.length;

    // a page change by the user pushes a new entry
    await userEvent.click(screen.getByRole("button", { name: /next page/i }));
    expect(await screen.findByText("CODE-P2")).toBeInTheDocument();
    expect(window.location.search).toContain("page=1");
    expect(window.history.length).toBe(entries + 1);

    window.history.back();
    expect(await screen.findByText("CODE-P1")).toBeInTheDocument();
    expect(window.location.search).toContain("page=0");
    expect(lastListParams()).toEqual(expect.objectContaining({ page: 1 }));

    window.history.forward();
    expect(await screen.findByText("CODE-P2")).toBeInTheDocument();
    expect(window.history.length).toBe(entries + 1); // following the URL writes nothing
  });

  it("Back restores the search box with the filters of the earlier URL (TEOS-287)", async () => {
    signInWith([PERMISSIONS.REFERRALS_READ]);
    render(<Referrals />);
    await screen.findByText("ABC123");

    await userEvent.type(screen.getByPlaceholderText("Search by code"), "abc");
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(window.location.search).toContain("search=abc"));

    window.history.back();
    await waitFor(() => expect(lastListParams()).toEqual(expect.objectContaining({ search: undefined })));
    expect(screen.getByPlaceholderText("Search by code")).toHaveValue("");
  });

  it("shows the empty state", async () => {
    signInWith([PERMISSIONS.REFERRALS_READ]);
    referralsAPI.getAllReferrals.mockResolvedValue(listResponse([], 0));
    render(<Referrals />);

    expect(await screen.findByText("No Referral Transactions Found")).toBeInTheDocument();
  });
});
