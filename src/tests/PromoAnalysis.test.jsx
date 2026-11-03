import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import { toast } from "react-toastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// these tests type into forms; a loaded CI machine needs more than the 5 s default
vi.setConfig({ testTimeout: 30000 });
import { SignIn, SignOut } from "../Redux/reducers/AuthReducer";
import { store } from "../Redux/store";
import { PERMISSIONS } from "../core/vairables/Permissions";
import PromoAnalysis, { dateRangeError } from "../pages/promotions/PromoAnalysis";
import { render, screen, waitFor } from "./utils/test-utils";

vi.mock("react-toastify", async () => {
  const actual = await vi.importActual("react-toastify");
  return {
    ...actual,
    toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
  };
});

vi.mock("../core/apis/promotionsAPI", async () => {
  const actual = await vi.importActual("../core/apis/promotionsAPI");
  return {
    getApiErrorCode: actual.getApiErrorCode,
    getApiErrorDetails: actual.getApiErrorDetails,
    getAllPromotionsUsage: vi.fn(),
    getPromotionById: vi.fn(),
  };
});

vi.mock("../core/apis/lookupsAPI", () => ({
  getUsersLookup: vi.fn(),
  getBundlesLookup: vi.fn(),
  getPromotionRulesLookup: vi.fn(),
}));

vi.mock("../Components/shared/lookup-select/LookupSelect", () => ({
  default: ({ placeholder, onChange, isMulti }) => (
    <button
      type="button"
      onClick={() =>
        onChange(
          isMulti
            ? [{ value: "b1", id: "b1", label: "Europe (EU5)", bundle_code: "EU5" }]
            : { value: "u1", id: "u1", label: "jane@example.com" }
        )
      }
    >
      {placeholder}
    </button>
  ),
}));

vi.mock("../Components/form-component/FormComponent", async () => {
  const actual = await vi.importActual("../Components/form-component/FormComponent");
  return {
    ...actual,
    FormDateRange: ({ placeholder, onChange, helperText }) => (
      <div>
        <button type="button" onClick={() => onChange(["2026-01-01", "2026-01-31"])}>
          {placeholder}
        </button>
        <button type="button" onClick={() => onChange(["2024-01-01", "2026-01-31"])}>
          Too long
        </button>
        {helperText && <span>{helperText}</span>}
      </div>
    ),
  };
});

import * as promotionsAPI from "../core/apis/promotionsAPI";

const signInWith = (permissions) =>
  store.dispatch(
    SignIn({
      access_token: "token",
      refresh_token: "refresh",
      expires_in: 3600,
      user: { id: "id", email: "a@example.com", role: "admin", permissions },
    })
  );

const ROWS = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    created_at: "2026-10-20T10:00:00",
    promotion_code: "SUMMER10",
    promotion: { id: "p1", code: "SUMMER10", name: "Summer" },
    user: { id: "u1", email: "jane@example.com", msisdn: "+96170000000" },
    bundle_id: "b1",
    bundle_code: "EU5",
    order_id: "o1",
    discount_amount: 2.5,
    currency: "EUR",
    status: "completed",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    created_at: "2026-10-19T10:00:00",
    promotion_code: "GONE",
    promotion: null,
    user: null,
    bundle_id: null,
    bundle_code: null,
    order_id: null,
    discount_amount: 1,
    currency: null,
    status: "pending",
  },
];

// totals deliberately differ from what the rows on screen would give
const usageResponse = {
  data: {
    data: {
      data: ROWS,
      total_count: 40,
      totals: {
        uses: 40,
        distinct_users: 17,
        discount_amount: [
          { currency: "EUR", amount: 120.5 },
          { currency: null, amount: 9 },
        ],
      },
    },
  },
};

describe("dateRangeError", () => {
  it("accepts an empty or valid range and refuses inverted or over-366-day ranges", () => {
    expect(dateRangeError([null, null])).toBe("");
    expect(dateRangeError(["2026-01-01", "2026-12-31"])).toBe("");
    expect(dateRangeError(["2026-02-01", "2026-01-01"])).toMatch(/after the start date/);
    expect(dateRangeError(["2025-01-01", "2026-01-02"])).toMatch(/366 days/);
    expect(dateRangeError(["2025-01-01", "2026-01-01"])).toBe("");
  });
});

describe("Promo analysis page", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/promo-analysis");
    vi.clearAllMocks();
    promotionsAPI.getAllPromotionsUsage.mockResolvedValue(usageResponse);
  });

  afterEach(() => {
    store.dispatch(SignOut());
  });

  it("opens on page 1 with the table only (no summary tiles)", async () => {
    signInWith([PERMISSIONS.PROMOTIONS_READ]);
    render(<PromoAnalysis />);

    expect(await screen.findByText("jane@example.com")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Usage totals" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Total uses")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Distinct users")).not.toBeInTheDocument();
    expect(screen.queryByText("Total discount")).not.toBeInTheDocument();
    expect(promotionsAPI.getAllPromotionsUsage).toHaveBeenCalledWith({
      page: 1,
      page_size: 10,
      code: undefined,
      user_id: undefined,
      bundle_ids: undefined,
      from: undefined,
      to: undefined,
    });
  });

  it("a page past the end moves to the last valid page and replaces the URL (TEOS-232, TEOS-290)", async () => {
    signInWith([PERMISSIONS.PROMOTIONS_READ]);
    window.history.pushState({}, "", "/promo-analysis?pageSize=10&page=3");
    window.history.pushState({}, "", "/promo-analysis?pageSize=10&page=99");
    const entries = window.history.length;
    const page = (rows) => ({ data: { data: { data: rows, total_count: 317, totals: null } } });
    promotionsAPI.getAllPromotionsUsage.mockImplementation(async (params) =>
      params.page === 32 ? page(ROWS) : page([])
    );
    render(<PromoAnalysis />);

    await waitFor(() =>
      expect(promotionsAPI.getAllPromotionsUsage).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 32, page_size: 10 })
      )
    );
    expect(await screen.findByText("jane@example.com")).toBeInTheDocument();
    await waitFor(() => expect(window.location.search).toContain("page=31"));
    // TEOS-290: the clamp adds no history entry, so Back skips the out-of-range URL
    expect(window.history.length).toBe(entries);
    window.history.back();
    await waitFor(() => expect(window.location.search).toContain("page=3"));
    expect(window.location.search).not.toContain("page=99");
  });

  it("Back / Forward make the table follow the URL (TEOS-290)", async () => {
    signInWith([PERMISSIONS.PROMOTIONS_READ]);
    promotionsAPI.getAllPromotionsUsage.mockImplementation(async (params) => ({
      data: {
        data: {
          data: [{ ...ROWS[0], promotion_code: `CODE-P${params.page}`, promotion: null }],
          total_count: 40,
        },
      },
    }));
    render(<PromoAnalysis />);
    expect(await screen.findByText("CODE-P1 (Deleted promotion)")).toBeInTheDocument();
    const entries = window.history.length;

    // a page change by the user pushes a new entry
    await userEvent.click(screen.getByRole("button", { name: /next page/i }));
    expect(await screen.findByText("CODE-P2 (Deleted promotion)")).toBeInTheDocument();
    expect(window.location.search).toContain("page=1");
    expect(window.history.length).toBe(entries + 1);

    window.history.back();
    expect(await screen.findByText("CODE-P1 (Deleted promotion)")).toBeInTheDocument();
    expect(window.location.search).toContain("page=0");
    expect(promotionsAPI.getAllPromotionsUsage).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, page_size: 10 })
    );

    window.history.forward();
    expect(await screen.findByText("CODE-P2 (Deleted promotion)")).toBeInTheDocument();
    expect(window.history.length).toBe(entries + 1); // following the URL writes nothing
  });

  it("Back restores the search box and the dates of the earlier URL (TEOS-290)", async () => {
    signInWith([PERMISSIONS.PROMOTIONS_READ]);
    window.history.pushState({}, "", "/promo-analysis?code=OLD&from=2026-10-01&to=2026-10-20");
    render(<PromoAnalysis />);
    await screen.findByText("jane@example.com");
    const box = screen.getByPlaceholderText("Search by promo code");
    expect(box).toHaveValue("OLD");

    await userEvent.clear(box);
    await userEvent.type(box, "NEW");
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(window.location.search).toContain("code=NEW"));

    window.history.back();
    await waitFor(() => expect(box).toHaveValue("OLD"));
    expect(promotionsAPI.getAllPromotionsUsage).toHaveBeenLastCalledWith(
      expect.objectContaining({ code: "OLD", from: "2026-10-01", to: "2026-10-20", page: 1 })
    );
  });

  it.each([
    "from=2026-13-01",
    "to=2026-99-99",
    "from=2026-05-10&to=2026-05-01", // TEOS-288: from after to
  ])(
    "an invalid date or range in the URL (%s) shows the notice and the default list, not a blank page (TEOS-275, TEOS-288)",
    async (query) => {
      signInWith([PERMISSIONS.PROMOTIONS_READ]);
      window.history.pushState({}, "", `/promo-analysis?${query}`);
      render(<PromoAnalysis />);

      expect(await screen.findByText("jane@example.com")).toBeInTheDocument();
      expect(toast.warning).toHaveBeenCalledWith(
        "Some filters were not valid; the defaults are restored",
        { toastId: "promo-analysis-stale-url" }
      );
      expect(promotionsAPI.getAllPromotionsUsage).toHaveBeenLastCalledWith(
        expect.objectContaining({ from: undefined, to: undefined })
      );
      await waitFor(() => expect(window.location.search).not.toContain("2026-"));
    }
  );

  it("a real date range in the URL is kept and sent (TEOS-275)", async () => {
    signInWith([PERMISSIONS.PROMOTIONS_READ]);
    window.history.pushState({}, "", "/promo-analysis?from=2026-10-01&to=2026-10-20");
    render(<PromoAnalysis />);

    await screen.findByText("jane@example.com");
    expect(toast.warning).not.toHaveBeenCalled();
    expect(promotionsAPI.getAllPromotionsUsage).toHaveBeenLastCalledWith(
      expect.objectContaining({ from: "2026-10-01", to: "2026-10-20" })
    );
  });

  it("shows Deleted user / Deleted promotion for orphans, amounts with their currency", async () => {
    signInWith([PERMISSIONS.PROMOTIONS_READ]);
    render(<PromoAnalysis />);

    expect(await screen.findByText("Deleted user")).toBeInTheDocument();
    expect(screen.getByText("GONE (Deleted promotion)")).toBeInTheDocument();
    expect(screen.getByText("2.50 EUR")).toBeInTheDocument();
    expect(screen.getByText("1.00 USD")).toBeInTheDocument();
    expect(screen.getByText("EU5")).toBeInTheDocument();
  });

  it("filters are sent as plain parameters from page 1 and the URL reflects them", async () => {
    signInWith([PERMISSIONS.PROMOTIONS_READ]);
    window.history.pushState({}, "", "/promo-analysis?page=2");
    render(<PromoAnalysis />);
    await screen.findByText("jane@example.com");

    await userEvent.type(screen.getByPlaceholderText("Search by promo code"), "SUM,)%");
    await userEvent.click(screen.getByRole("button", { name: "Select User" }));
    await userEvent.click(screen.getByRole("button", { name: "Select Bundles Code" }));
    await userEvent.click(screen.getByRole("button", { name: "Select dates" }));
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() =>
      expect(promotionsAPI.getAllPromotionsUsage).toHaveBeenLastCalledWith({
        page: 1,
        page_size: 10,
        code: "SUM,)%",
        user_id: "u1",
        bundle_ids: ["b1"],
        from: "2026-01-01",
        to: "2026-01-31",
      })
    );
    expect(window.location.search).toContain("user_id=u1");
    expect(window.location.search).toContain("bundle_ids=b1");
    expect(window.location.search).toContain("from=2026-01-01");
  });

  it("a range over 366 days is a field error, Apply is disabled and nothing is requested", async () => {
    signInWith([PERMISSIONS.PROMOTIONS_READ]);
    render(<PromoAnalysis />);
    await screen.findByText("jane@example.com");

    await userEvent.click(screen.getByRole("button", { name: "Too long" }));

    expect(await screen.findByText("The range is at most 366 days")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
    expect(promotionsAPI.getAllPromotionsUsage).toHaveBeenCalledTimes(1);
  });

  it("API error shows a toast and the table's empty row, no Retry", async () => {
    signInWith([PERMISSIONS.PROMOTIONS_READ]);
    promotionsAPI.getAllPromotionsUsage.mockRejectedValue(new Error("boom"));
    render(<PromoAnalysis />);

    expect(await screen.findByText("No usage")).toBeInTheDocument();
    expect(screen.queryByText("Failed to load promotion usage.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith("Fail to display data");
  });
});
