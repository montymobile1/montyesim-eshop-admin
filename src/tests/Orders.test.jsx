import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { toast } from "react-toastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AuthLayout from "../Components/layout/AuthLayout";
import { getUsersLookup } from "../core/apis/lookupsAPI";
import { getAllOrders, getOrdersFilterUser } from "../core/apis/ordersAPI";
import OrdersPage from "../pages/orders/OrdersPage";
import { render, screen, waitFor, within } from "./utils/test-utils";

// these tests type into forms; a loaded CI machine needs more than the 5 s default
vi.setConfig({ testTimeout: 30000 });

// The location stays the real one: the list follows the URL both ways (TEOS-289 / TEOS-287),
// each test starts on /orders (beforeEach).

vi.mock("react-toastify", async () => {
  const actual = await vi.importActual("react-toastify");
  return {
    ...actual,
    toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
  };
});

vi.mock("../core/apis/ordersAPI", () => ({
  getAllOrders: vi.fn(),
  getOrdersFilterUser: vi.fn(),
}));

vi.mock("../core/apis/lookupsAPI", () => ({
  getUsersLookup: vi.fn(),
}));

vi.mock("../Components/form-component/FormComponent", async () => {
  const actual = await vi.importActual(
    "../Components/form-component/FormComponent"
  );
  return {
    ...actual,
    FormDateRange: ({ placeholder, onChange, helperText }) => (
      <div>
        <button
          type="button"
          onClick={() => onChange(["2026-01-01", "2026-01-31"])}
        >
          {placeholder}
        </button>
        <button
          type="button"
          onClick={() => onChange(["2026-02-01", "2026-01-31"])}
        >
          Inverted
        </button>
        <button
          type="button"
          onClick={() => onChange(["2024-01-01", "2026-01-31"])}
        >
          Too long
        </button>
        {helperText && <span>{helperText}</span>}
      </div>
    ),
  };
});

dayjs.extend(utc);

const FACETS = { all: 2, success: 1, pending: 1, canceled: 0, failed: 0 };

const listResponse = (rows, total = rows.length, facets = FACETS) => ({
  data: { data: { data: rows, total_count: total, facets } },
});

// TEOS-117 shape: bundle_name / bundle_code from the API, no bundle_data, no payment_intent_code
const ORDERS = [
  {
    id: "order-1",
    user_id: "u1",
    amount: 1999,
    currency: "EUR",
    order_type: "Assign",
    order_status: "success",
    payment_status: "success",
    bundle_name: "Europe 5GB",
    bundle_code: "EU-5GB",
    created_at: "2026-10-01T10:00:00",
    payment_time: "2026-10-01T10:05:00",
    user: { id: "u1", email: "jane@example.com", msisdn: "+96170000000" },
  },
  {
    id: "order-2",
    user_id: "gone",
    amount: 500,
    currency: "USD",
    order_type: "Assign",
    order_status: "pending",
    payment_status: "pending",
    bundle_name: null,
    bundle_code: null,
    created_at: "2026-09-01T10:00:00",
    user: null,
  },
];

const renderPage = () =>
  render(
    <AuthLayout>
      <OrdersPage />
    </AuthLayout>
  );

const lastCallParams = () => getAllOrders.mock.calls.at(-1)[0];

describe("Orders Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, "", "/orders");
    getAllOrders.mockResolvedValue(listResponse(ORDERS, 2));
    getUsersLookup.mockResolvedValue(listResponse([]));
  });

  it("renders page components", () => {
    renderPage();

    expect(
      screen.getByRole("heading", { name: /Orders/i, level: 1 })
    ).toBeInTheDocument();
  });

  it("shows Created At and Payment Time in local time (API sends UTC without an offset)", async () => {
    renderPage();

    expect(await screen.findByText("jane@example.com")).toBeInTheDocument();
    expect(screen.getByText("Payment Time")).toBeInTheDocument();
    const local = (value) => dayjs.utc(value).local().format("DD-MM-YYYY HH:mm");
    expect(screen.getByText(local("2026-10-01T10:00:00"))).toBeInTheDocument();
    expect(screen.getByText(local("2026-10-01T10:05:00"))).toBeInTheDocument();
  });

  it("opens on All, page 1, newest first", async () => {
    renderPage();

    await waitFor(() => expect(getAllOrders).toHaveBeenCalled());
    expect(lastCallParams()).toEqual({
      page: 1,
      page_size: 10,
      status: "all",
      user_id: undefined,
      payment_status: undefined,
      search: undefined,
      from: undefined,
      to: undefined,
      sort: "created_at",
      dir: "desc",
    });
  });

  it("shows the joined user email and phone, N/A when the user is gone", async () => {
    renderPage();

    expect(await screen.findByText("jane@example.com")).toBeInTheDocument();
    expect(screen.getByText("+96170000000")).toBeInTheDocument();
    const secondRow = screen.getByText("order-2").closest("tr");
    expect(within(secondRow).getAllByText("N/A").length).toBeGreaterThanOrEqual(3);
  });

  it("Bundle Name column shows bundle_name from the API, N/A when null", async () => {
    renderPage();

    const firstRow = (await screen.findByText("order-1")).closest("tr");
    expect(within(firstRow).getByText("Europe 5GB")).toBeInTheDocument();
    const secondRow = screen.getByText("order-2").closest("tr");
    const bundleIndex = screen
      .getAllByRole("columnheader")
      .findIndex((cell) => cell.textContent.includes("Bundle Name"));
    expect(bundleIndex).toBeGreaterThan(-1);
    expect(within(secondRow).getAllByRole("cell")[bundleIndex]).toHaveTextContent(
      "N/A"
    );
  });

  it("tabs show the counts from facets", async () => {
    renderPage();

    expect(await screen.findByRole("tab", { name: "All (2)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Success (1)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Pending (1)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Canceled (0)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Failed (0)" })).toBeInTheDocument();
  });

  it("the Failed tab requests status=failed from page 1 and the URL reflects it", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/orders?page=3");
    renderPage();
    await screen.findByText("jane@example.com");

    await user.click(screen.getByRole("tab", { name: "Failed (0)" }));

    await waitFor(() =>
      expect(lastCallParams()).toMatchObject({ status: "failed", page: 1 })
    );
    expect(window.location.search).toContain("status=failed");
  });

  it("clicking Amount sorts ascending, clicking again descending", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("jane@example.com");

    await user.click(screen.getByText("Amount"));
    await waitFor(() =>
      expect(lastCallParams()).toMatchObject({
        sort: "amount",
        dir: "asc",
        page: 1,
      })
    );

    await user.click(screen.getByText("Amount"));
    await waitFor(() =>
      expect(lastCallParams()).toMatchObject({
        sort: "amount",
        dir: "desc",
      })
    );
    expect(window.location.search).toContain("sortBy=amount");
    expect(window.location.search).toContain("sortDirection=desc");
  });

  it("Order Status is sortable, Bundle Name is not", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("jane@example.com");
    const calls = getAllOrders.mock.calls.length;

    await user.click(screen.getByText("Bundle Name"));
    expect(getAllOrders.mock.calls.length).toBe(calls);

    await user.click(screen.getByText("Order Status"));
    await waitFor(() =>
      expect(lastCallParams()).toMatchObject({ sort: "order_status", dir: "asc" })
    );
  });

  it("restores tab, filters, sort and page from the URL and shows the user email", async () => {
    window.history.pushState(
      {},
      "",
      "/orders?user=u1&status=success&paymentStatus=failed&search=EU-5GB&from=2026-01-01&to=2026-01-31&sortBy=amount&sortDirection=asc&page=2&pageSize=25"
    );
    getOrdersFilterUser.mockResolvedValue({
      data: { data: { data: [{ id: "u1", label: "jane@example.com", email: "jane@example.com" }], total_count: 1 } },
    });

    renderPage();

    await waitFor(() => expect(getAllOrders).toHaveBeenCalled());
    expect(getAllOrders.mock.calls[0][0]).toEqual({
      page: 3,
      page_size: 25,
      status: "success",
      user_id: "u1",
      payment_status: "failed",
      search: "EU-5GB",
      from: "2026-01-01",
      to: "2026-01-31",
      sort: "amount",
      dir: "asc",
    });
    expect(getOrdersFilterUser).toHaveBeenCalledWith("u1");
    // the label of the user filter is rehydrated (also shown in the table)
    await waitFor(() =>
      expect(screen.getAllByText("jane@example.com").length).toBeGreaterThan(1)
    );
  });

  it("ignores unknown sort, status, payment status and an inverted range from the URL", async () => {
    window.history.pushState(
      {},
      "",
      "/orders?sortBy=id;drop&sortDirection=up&status=foo&paymentStatus=paid&from=2026-02-01&to=2026-01-01"
    );

    renderPage();

    await waitFor(() => expect(getAllOrders).toHaveBeenCalled());
    expect(getAllOrders.mock.calls[0][0]).toMatchObject({
      status: "all",
      payment_status: undefined,
      from: undefined,
      to: undefined,
      sort: "created_at",
      dir: "desc",
    });
  });

  it("search, user and date range are applied together from page 1", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/orders?page=3");
    getUsersLookup.mockResolvedValue(
      listResponse([{ id: "u9", label: "picked@example.com", email: "picked@example.com" }])
    );
    renderPage();
    await screen.findByText("jane@example.com");

    await user.type(
      screen.getByPlaceholderText("Order ID, bundle code or promo code"),
      "PROMO,)%"
    );
    await user.click(screen.getByLabelText("User"));
    await user.click(await screen.findByText("picked@example.com"));
    await user.click(screen.getByRole("button", { name: "Select dates" }));
    await user.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() =>
      expect(lastCallParams()).toMatchObject({
        user_id: "u9",
        search: "PROMO,)%",
        from: "2026-01-01",
        to: "2026-01-31",
        status: "all",
        page: 1,
      })
    );
    expect(getUsersLookup).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, page_size: 10 })
    );
    expect(window.location.search).toContain("from=2026-01-01");
    expect(window.location.search).toContain("to=2026-01-31");
  });

  it.each([
    ["Inverted", "The end date must be after the start date"],
    ["Too long", "The range is at most 366 days"],
  ])("a %s date range shows a message, Apply is disabled and nothing is requested", async (button, message) => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("jane@example.com");
    const calls = getAllOrders.mock.calls.length;

    await user.click(screen.getByRole("button", { name: button }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
    expect(getAllOrders.mock.calls.length).toBe(calls);
  });

  it("a 422 from a stale URL restores the defaults with a notice", async () => {
    window.history.pushState({}, "", "/orders?status=pending&search=x");
    getAllOrders.mockRejectedValueOnce({ response: { status: 422 } });

    renderPage();

    await waitFor(() =>
      expect(toast.warning).toHaveBeenCalledWith(
        "Some filters were not valid; the defaults are restored",
        { toastId: "orders-stale-url" }
      )
    );
    await waitFor(() =>
      expect(lastCallParams()).toMatchObject({ status: "all", search: undefined, page: 1 })
    );
  });

  it("a 422 for a page size the API refuses also resets the page size and reloads (TEOS-164)", async () => {
    window.history.pushState({}, "", "/orders?pageSize=500");
    getAllOrders.mockRejectedValueOnce({ response: { status: 422 } });

    renderPage();

    await waitFor(() => expect(getAllOrders).toHaveBeenCalledTimes(2));
    expect(getAllOrders.mock.calls[0][0]).toMatchObject({ page_size: 500 });
    expect(lastCallParams()).toMatchObject({ page_size: 10, page: 1, status: "all" });
    await waitFor(() => expect(window.location.search).not.toContain("pageSize=500"));
  });

  it("a stale URL value replaced before any request is announced too (TEOS-164)", async () => {
    window.history.pushState({}, "", "/orders?status=foo");

    renderPage();

    await waitFor(() =>
      expect(toast.warning).toHaveBeenCalledWith(
        "Some filters were not valid; the defaults are restored",
        { toastId: "orders-stale-url" }
      )
    );
  });

  it.each(["from=2026-99-99", "to=2026-99-99", "from=2026-13-01"])(
    "an impossible date in the URL (%s) shows the notice and the default list, not a blank page (TEOS-274)",
    async (query) => {
      window.history.pushState({}, "", `/orders?${query}`);

      renderPage();

      await waitFor(() =>
        expect(toast.warning).toHaveBeenCalledWith(
          "Some filters were not valid; the defaults are restored",
          { toastId: "orders-stale-url" }
        )
      );
      await waitFor(() => expect(getAllOrders).toHaveBeenCalled());
      expect(lastCallParams().from).toBeUndefined();
      expect(lastCallParams().to).toBeUndefined();
      expect(window.location.search).not.toContain("2026-");
    }
  );

  it("a clean URL shows no stale-URL notice", async () => {
    window.history.pushState({}, "", "/orders?status=pending");

    renderPage();

    await waitFor(() => expect(getAllOrders).toHaveBeenCalled());
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it("a page past the end moves to the last valid page and replaces the URL (TEOS-289)", async () => {
    window.history.pushState({}, "", "/orders?pageSize=10&page=800");
    const entries = window.history.length;
    getAllOrders.mockImplementation(async (params) =>
      listResponse(params.page === 795 ? ORDERS : [], 7946)
    );

    renderPage();

    // two requests in a row (the empty page, then the last one): more time under load
    expect(await screen.findByText("jane@example.com", {}, { timeout: 5000 })).toBeInTheDocument();
    expect(getAllOrders.mock.calls[0][0]).toMatchObject({ page: 801 });
    expect(lastCallParams()).toMatchObject({ page: 795, page_size: 10 });
    await waitFor(() => expect(window.location.search).toContain("page=794"));
    expect(screen.getByText(/7941.7946 of 7946/)).toBeInTheDocument();
    // the out-of-range URL is replaced, not pushed (TEOS-287)
    expect(window.history.length).toBe(entries);
  });

  // the page change and Back / Forward each wait for a request: more time under load
  const SLOW_FIND = { timeout: 5000 };

  it("Back after a page change shows the earlier page again, filters included (TEOS-289)", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/orders?search=EU");
    getAllOrders.mockImplementation(async (params) =>
      listResponse([{ ...ORDERS[0], id: `order-p${params.page}` }], 40)
    );
    renderPage();
    expect(await screen.findByText("order-p1", {}, SLOW_FIND)).toBeInTheDocument();
    const entries = window.history.length;

    await user.click(screen.getByRole("button", { name: /next page/i }));
    expect(await screen.findByText("order-p2", {}, SLOW_FIND)).toBeInTheDocument();
    expect(window.history.length).toBe(entries + 1);

    window.history.back();
    expect(await screen.findByText("order-p1", {}, SLOW_FIND)).toBeInTheDocument();
    expect(window.location.search).toContain("page=0");
    expect(lastCallParams()).toMatchObject({ page: 1, search: "EU" });
    expect(screen.getByPlaceholderText("Order ID, bundle code or promo code")).toHaveValue("EU");

    window.history.forward();
    expect(await screen.findByText("order-p2", {}, SLOW_FIND)).toBeInTheDocument();
    expect(window.history.length).toBe(entries + 1); // following the URL writes nothing
  });

  it("shows the empty state", async () => {
    getAllOrders.mockResolvedValue(listResponse([], 0));

    renderPage();

    expect(await screen.findByText("No Orders Found")).toBeInTheDocument();
  });
});
