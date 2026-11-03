import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import { toast } from "react-toastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// these tests type into forms; a loaded CI machine needs more than the 5 s default
vi.setConfig({ testTimeout: 30000 });
import { SignIn, SignOut } from "../Redux/reducers/AuthReducer";
import { store } from "../Redux/store";
import { PERMISSIONS } from "../core/vairables/Permissions";
import HandlePromotions from "../pages/promotions/HandlePromotions";
import PromotionsList from "../pages/promotions/PromotionsList";
import { render, screen, waitFor, within } from "./utils/test-utils";

// mockNavigate: the add / edit tests spy on navigate; the list keeps the real one (URL sync).
const routerState = vi.hoisted(() => ({ params: {}, navigate: vi.fn(), mockNavigate: false }));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useParams: () => routerState.params,
    useNavigate: () =>
      routerState.mockNavigate ? routerState.navigate : actual.useNavigate(),
  };
});

vi.mock("react-toastify", async () => {
  const actual = await vi.importActual("react-toastify");
  return {
    ...actual,
    toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  };
});

vi.mock("../core/apis/promotionsAPI", async () => {
  const actual = await vi.importActual("../core/apis/promotionsAPI");
  return {
    getApiErrorCode: actual.getApiErrorCode,
    getApiErrorDetails: actual.getApiErrorDetails,
    getAllPromotions: vi.fn(),
    getPromotionById: vi.fn(),
    AddPromotion: vi.fn(),
    editPromotion: vi.fn(),
    togglePromotionStatus: vi.fn(),
    deletePromotion: vi.fn(),
    getAllPromotionsUsage: vi.fn(),
  };
});

vi.mock("../core/apis/lookupsAPI", () => ({
  getUsersLookup: vi.fn(),
  getBundlesLookup: vi.fn(),
  getPromotionRulesLookup: vi.fn(),
}));

// The async dropdowns: one button per select that picks a fixed option.
vi.mock("../Components/shared/lookup-select/LookupSelect", () => ({
  default: ({ placeholder, onChange, isMulti, isDisabled, value }) => (
    <button
      type="button"
      disabled={isDisabled}
      onClick={() =>
        onChange(
          isMulti && /Rule/.test(placeholder)
            ? [{ value: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", label: "DISCOUNT_AMOUNT-CREATE_ORDER-3" }]
            : isMulti
            ? [{ value: "EU5", label: "Europe (EU5)", bundle_code: "EU5", id: "b1" }]
            : {
                value: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                label: "DISCOUNT_AMOUNT-CREATE_ORDER-3",
              }
        )
      }
    >
      {placeholder}
      {!isMulti && value?.label ? `: ${value.label}` : ""}
    </button>
  ),
}));

// The date range picker: one button for a valid range, one for an inverted range.
vi.mock("../Components/form-component/FormComponent", async () => {
  const actual = await vi.importActual("../Components/form-component/FormComponent");
  return {
    ...actual,
    FormDateRange: ({ placeholder, onChange, helperText }) => (
      <div>
        <button type="button" onClick={() => onChange(["2026-11-01", "2026-11-30"])}>
          {placeholder}
        </button>
        <button type="button" onClick={() => onChange(["2026-11-30", "2026-11-01"])}>
          Invalid range
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

const conflict = (code, extra = {}) =>
  Object.assign(new Error("Conflict"), {
    response: {
      status: 409,
      data: { developerMessage: JSON.stringify({ code, ...extra }) },
    },
  });

const RULE = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  name: "DISCOUNT_AMOUNT-CREATE_ORDER-3",
  max_usage: 3,
  beneficiary: 1,
  action: { id: 1, name: "DISCOUNT_AMOUNT" },
  event: { id: 1, name: "CREATE_ORDER" },
};

const PROMOTIONS = [
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    name: "Summer",
    code: "SUMMER10",
    type: "Promo",
    amount: 10,
    valid_from: "2026-10-01T00:00:00",
    valid_to: "2099-12-31T23:59:59",
    is_active: true,
    times_used: 3,
    bundle_codes: ["EU5", "US1"],
    rule_id: RULE.id,
    rule: RULE,
    status: "active",
    created_at: "2026-10-20T10:00:00",
  },
  {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    name: "Old",
    code: "OLD5",
    type: "Promo",
    amount: 5,
    valid_from: "2025-01-01T00:00:00",
    valid_to: "2025-02-01T00:00:00",
    is_active: false,
    times_used: 0,
    bundle_codes: [],
    rule_id: RULE.id,
    rule: RULE,
    status: "expired",
    created_at: "2025-01-01T10:00:00",
  },
];

const listResponse = {
  data: {
    data: {
      data: PROMOTIONS,
      total_count: 2,
      facets: { all: 2, active: 1, inactive: 0, expired: 1, scheduled: 0 },
    },
  },
};

describe("Promotions list", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/promotions");
    vi.clearAllMocks();
    routerState.mockNavigate = false;
    promotionsAPI.getAllPromotions.mockResolvedValue(listResponse);
  });

  afterEach(() => {
    store.dispatch(SignOut());
  });

  it("opens on All, page 1, with tab counts from facets and row details", async () => {
    signInWith([PERMISSIONS.PROMOTIONS_READ, PERMISSIONS.PROMOTIONS_WRITE]);
    render(<PromotionsList />);

    expect(await screen.findByText("SUMMER10")).toBeInTheDocument();
    expect(screen.getAllByText("DISCOUNT_AMOUNT-CREATE_ORDER-3").length).toBe(2);
    // TEOS-225: the bundles are chips, not one line of text
    expect(screen.getByText("EU5")).toHaveClass("MuiChip-label");
    expect(screen.getByText("US1")).toHaveClass("MuiChip-label");
    expect(screen.queryByText("EU5, US1")).not.toBeInTheDocument();
    expect(screen.getByText("All")).toBeInTheDocument(); // global promotion
    expect(screen.getByRole("tab", { name: "All (2)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Expired (1)" })).toBeInTheDocument();
    // the date state is a chip by the name, apart from the Active / Inactive switch label
    const oldRow = screen.getByText("Old").closest("tr");
    expect(within(oldRow).getByText("Expired")).toBeInTheDocument();
    const summerRow = screen.getByText("Summer").closest("tr");
    expect(within(summerRow).queryByText("Expired")).not.toBeInTheDocument();
    expect(within(summerRow).getByText("Active")).toBeInTheDocument();
    expect(promotionsAPI.getAllPromotions).toHaveBeenCalledWith({
      page: 1,
      page_size: 10,
      status: "all",
      search: undefined,
      rule_ids: undefined,
      bundle_codes: undefined,
      include_global: undefined,
    });
  });

  it("a page past the end moves to the last valid page and replaces the URL (TEOS-286)", async () => {
    signInWith([PERMISSIONS.PROMOTIONS_READ]);
    window.history.pushState({}, "", "/promotions?pageSize=10&page=99");
    const entries = window.history.length;
    promotionsAPI.getAllPromotions.mockImplementation(async (params) => ({
      data: {
        data: {
          ...listResponse.data.data,
          data: params.page === 3 ? PROMOTIONS : [],
          total_count: 21,
        },
      },
    }));
    render(<PromotionsList />);

    // two requests in a row (the empty page, then the last one): more time under load
    expect(await screen.findByText("Summer", {}, { timeout: 5000 })).toBeInTheDocument();
    expect(promotionsAPI.getAllPromotions).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 3 })
    );
    await waitFor(() => expect(window.location.search).toContain("page=2"));
    // TEOS-287: the out-of-range URL is replaced, not pushed
    expect(window.history.length).toBe(entries);
  });

  it("more than 2 bundles show 2 chips and a +N chip listing the rest (TEOS-225)", async () => {
    signInWith([PERMISSIONS.PROMOTIONS_READ]);
    promotionsAPI.getAllPromotions.mockResolvedValue(
      { data: { data: { ...listResponse.data.data, total_count: 1,
        data: [{ ...PROMOTIONS[0], bundle_codes: ["EU5", "US1", "FR3", "DE2", "IT1"] }] } } }
    );
    render(<PromotionsList />);

    expect(await screen.findByText("EU5")).toBeInTheDocument();
    expect(screen.getByText("US1")).toBeInTheDocument();
    expect(screen.queryByText("FR3")).not.toBeInTheDocument();
    expect(screen.getByText("+3")).toBeInTheDocument();
    expect(screen.getByLabelText("3 more: FR3, DE2, IT1")).toBeInTheDocument();
  });

  it("Expired tab requests status=expired from page 1 and the URL reflects it", async () => {
    signInWith([PERMISSIONS.PROMOTIONS_READ]);
    render(<PromotionsList />);
    await screen.findByText("SUMMER10");

    await userEvent.click(screen.getByRole("tab", { name: "Expired (1)" }));

    await waitFor(() =>
      expect(promotionsAPI.getAllPromotions).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: "expired", page: 1 })
      )
    );
    expect(window.location.search).toContain("status=expired");
  });

  it("rule and bundle filters are sent as arrays, with the global promotions", async () => {
    signInWith([PERMISSIONS.PROMOTIONS_READ]);
    render(<PromotionsList />);
    await screen.findByText("SUMMER10");

    await userEvent.click(screen.getByRole("button", { name: "Select Rules" }));
    await userEvent.click(screen.getByRole("button", { name: "Select Bundles" }));
    await userEvent.type(screen.getByPlaceholderText("Search by name or code"), "a,code.ilike.%");
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() =>
      expect(promotionsAPI.getAllPromotions).toHaveBeenLastCalledWith({
        page: 1,
        page_size: 10,
        status: "all",
        search: "a,code.ilike.%",
        rule_ids: [RULE.id],
        bundle_codes: ["EU5"],
        include_global: true,
      })
    );
    expect(window.location.search).toContain("rule_ids=");
    expect(window.location.search).toContain("bundle_codes=EU5");
  });

  it("status switch sends PATCH with the new state", async () => {
    signInWith([PERMISSIONS.PROMOTIONS_READ, PERMISSIONS.PROMOTIONS_WRITE]);
    promotionsAPI.togglePromotionStatus.mockResolvedValue({ data: {} });
    render(<PromotionsList />);
    await screen.findByText("SUMMER10");

    await userEvent.click(screen.getByRole("checkbox", { name: "Toggle SUMMER10" }));

    expect(promotionsAPI.togglePromotionStatus).toHaveBeenCalledWith({
      id: PROMOTIONS[0].id,
      is_active: false,
    });
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });

  it("delete refused with promotion_used shows the usage count and keeps the row", async () => {
    signInWith([PERMISSIONS.PROMOTIONS_READ, PERMISSIONS.PROMOTIONS_WRITE]);
    promotionsAPI.deletePromotion.mockRejectedValue(
      conflict("promotion_used", { times_used: 3 })
    );
    render(<PromotionsList />);
    await screen.findByText("SUMMER10");

    await userEvent.click(screen.getByRole("button", { name: "Actions for Summer" }));
    await userEvent.click(screen.getByRole("menuitem", { name: /^Delete/ }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

    expect(promotionsAPI.deletePromotion).toHaveBeenCalledWith(PROMOTIONS[0].id);
    await waitFor(() =>
      expect(toast.info).toHaveBeenCalledWith("Used 3 times; deactivate it instead")
    );
    expect(screen.getByText("SUMMER10")).toBeInTheDocument();
  });

  it("without write permission only View remains and the switch is disabled", async () => {
    signInWith([PERMISSIONS.PROMOTIONS_READ]);
    render(<PromotionsList />);
    await screen.findByText("SUMMER10");

    expect(screen.queryByRole("button", { name: "Add" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Actions for / })).toHaveLength(2);
    await userEvent.click(screen.getByRole("button", { name: "Actions for Summer" }));
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "ViewSee the promotion's details and usage",
    ]);
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("checkbox", { name: "Toggle SUMMER10" })).toBeDisabled();
  });
});

describe("Promotion add / edit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routerState.params = {};
    routerState.mockNavigate = true;
  });

  afterEach(() => {
    store.dispatch(SignOut());
  });

  const fillCreateForm = async () => {
    await userEvent.type(screen.getByPlaceholderText("Enter Name"), "Winter sale");
    await userEvent.type(screen.getByPlaceholderText("Enter Code"), "winter20");
    await userEvent.click(screen.getByRole("button", { name: /Select Rule/ }));
    await userEvent.type(screen.getByPlaceholderText("Enter Value"), "20");
    await userEvent.click(screen.getByRole("button", { name: "Select Duration" }));
    await userEvent.click(screen.getByRole("button", { name: "Select Bundle" }));
  };

  it("create posts exactly the documented fields (no type, callbacks or counters)", async () => {
    signInWith([PERMISSIONS.PROMOTIONS_READ, PERMISSIONS.PROMOTIONS_WRITE]);
    window.history.pushState({}, "", "/promotions/add");
    promotionsAPI.AddPromotion.mockResolvedValue({ status: 201, data: {} });
    render(<HandlePromotions />);

    await fillCreateForm();
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(promotionsAPI.AddPromotion).toHaveBeenCalledTimes(1));
    const body = promotionsAPI.AddPromotion.mock.calls[0][0];
    expect(body).toEqual({
      name: "Winter sale",
      code: "winter20",
      rule_id: RULE.id,
      amount: 20,
      valid_from: expect.stringMatching(/^2026-1[01]-\d{2}T.*Z$/),
      valid_to: expect.stringMatching(/^2026-1[12]-\d{2}T.*Z$/),
      bundle_codes: ["EU5"],
    });
    expect(Object.keys(body)).not.toEqual(
      expect.arrayContaining(["type", "callback_url", "callback_headers", "times_used", "is_active"])
    );
    expect(promotionsAPI.getPromotionById).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Promotion added successfully")
    );
    // TEOS-285: back to the list, not one step back in the browser history
    expect(routerState.navigate).toHaveBeenCalledWith("/promotions");
    expect(routerState.navigate).not.toHaveBeenCalledWith(-1);
  });

  it("409 duplicate_code lands on the code field, with no pre-check request", async () => {
    signInWith([PERMISSIONS.PROMOTIONS_READ, PERMISSIONS.PROMOTIONS_WRITE]);
    promotionsAPI.AddPromotion.mockRejectedValue(conflict("duplicate_code"));
    render(<HandlePromotions />);

    await fillCreateForm();
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("Code is not unique")).toBeInTheDocument();
    expect(promotionsAPI.AddPromotion).toHaveBeenCalledTimes(1);
  });

  it("an end date before the start date is a field error and sends nothing", async () => {
    signInWith([PERMISSIONS.PROMOTIONS_READ, PERMISSIONS.PROMOTIONS_WRITE]);
    render(<HandlePromotions />);

    await userEvent.type(screen.getByPlaceholderText("Enter Name"), "Winter sale");
    await userEvent.type(screen.getByPlaceholderText("Enter Code"), "winter20");
    await userEvent.click(screen.getByRole("button", { name: /Select Rule/ }));
    await userEvent.type(screen.getByPlaceholderText("Enter Value"), "20");
    await userEvent.click(screen.getByRole("button", { name: "Invalid range" }));
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(
      await screen.findByText("End date must be after the start date")
    ).toBeInTheDocument();
    expect(promotionsAPI.AddPromotion).not.toHaveBeenCalled();
  });

  it("a used promotion locks code, rule and value and PUTs only the editable fields", async () => {
    signInWith([PERMISSIONS.PROMOTIONS_READ, PERMISSIONS.PROMOTIONS_WRITE]);
    routerState.params = { id: PROMOTIONS[0].id };
    promotionsAPI.getPromotionById.mockResolvedValue({ data: { data: PROMOTIONS[0] } });
    promotionsAPI.editPromotion.mockResolvedValue({ status: 200, data: {} });
    render(<HandlePromotions />);

    expect(await screen.findByPlaceholderText("Enter Name")).toHaveValue("Summer");
    expect(screen.getByPlaceholderText("Enter Code")).toBeDisabled();
    expect(screen.getByPlaceholderText("Enter Value")).toBeDisabled();
    expect(screen.getByRole("button", { name: /Select Rule/ })).toBeDisabled();
    expect(screen.getByRole("note")).toHaveTextContent("Locked: this promotion has been used");

    await userEvent.clear(screen.getByPlaceholderText("Enter Name"));
    await userEvent.type(screen.getByPlaceholderText("Enter Name"), "Summer v2");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(promotionsAPI.editPromotion).toHaveBeenCalledTimes(1));
    const body = promotionsAPI.editPromotion.mock.calls[0][0];
    expect(body.id).toBe(PROMOTIONS[0].id);
    expect(body.name).toBe("Summer v2");
    expect(body.bundle_codes).toEqual(["EU5", "US1"]);
    // TEOS-229: dates the admin didn't touch are not sent, so they can't drift
    expect(body.valid_to).toBeUndefined();
    expect(body.valid_from).toBeUndefined();
    expect(body.code).toBeUndefined();
    expect(body.rule_id).toBeUndefined();
    expect(body.amount).toBeUndefined();
    // TEOS-285: opened from a typed URL or a new tab, a saved edit still lands on the list
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Promotion edited successfully")
    );
    expect(routerState.navigate).toHaveBeenCalledWith("/promotions");
    expect(routerState.navigate).not.toHaveBeenCalledWith(-1);
  });

  it("an unused promotion can change its code, and 409 promotion_used shows a message", async () => {
    signInWith([PERMISSIONS.PROMOTIONS_READ, PERMISSIONS.PROMOTIONS_WRITE]);
    routerState.params = { id: PROMOTIONS[1].id };
    promotionsAPI.getPromotionById.mockResolvedValue({ data: { data: PROMOTIONS[1] } });
    promotionsAPI.editPromotion.mockRejectedValue(conflict("promotion_used", { times_used: 1 }));
    render(<HandlePromotions />);

    expect(await screen.findByPlaceholderText("Enter Code")).toHaveValue("OLD5");
    expect(screen.getByPlaceholderText("Enter Code")).toBeEnabled();
    await userEvent.clear(screen.getByPlaceholderText("Enter Code"));
    await userEvent.type(screen.getByPlaceholderText("Enter Code"), "OLD6");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(promotionsAPI.editPromotion).toHaveBeenCalledTimes(1));
    expect(promotionsAPI.editPromotion.mock.calls[0][0]).toEqual(
      expect.objectContaining({ code: "OLD6", rule_id: RULE.id, amount: 5 })
    );
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    await waitFor(() => expect(promotionsAPI.getPromotionById).toHaveBeenCalledTimes(2));
  });

  it("leaving with unsaved changes asks for confirmation, and Leave goes back", async () => {
    signInWith([PERMISSIONS.PROMOTIONS_READ, PERMISSIONS.PROMOTIONS_WRITE]);
    routerState.params = { id: PROMOTIONS[1].id };
    promotionsAPI.getPromotionById.mockResolvedValue({ data: { data: PROMOTIONS[1] } });
    render(<HandlePromotions />);

    expect(await screen.findByPlaceholderText("Enter Name")).toHaveValue("Old");
    await userEvent.type(screen.getByPlaceholderText("Enter Name"), " v2");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(await screen.findByText(/Leave without saving/)).toBeInTheDocument();
    expect(routerState.navigate).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Leave" }));
    expect(routerState.navigate).toHaveBeenCalledWith(-1);
  });

  it("leaving a clean form goes back without asking", async () => {
    signInWith([PERMISSIONS.PROMOTIONS_READ, PERMISSIONS.PROMOTIONS_WRITE]);
    routerState.params = { id: PROMOTIONS[1].id };
    promotionsAPI.getPromotionById.mockResolvedValue({ data: { data: PROMOTIONS[1] } });
    render(<HandlePromotions />);

    expect(await screen.findByPlaceholderText("Enter Name")).toHaveValue("Old");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(routerState.navigate).toHaveBeenCalledWith(-1);
    expect(screen.queryByText(/Leave without saving/)).not.toBeInTheDocument();
  });

  // TEOS-231: the header Back arrow (data-leave-target, as in AuthLayout) and a sidebar link
  const renderEditWithNav = () =>
    render(
      <>
        <button type="button" aria-label="Back" data-leave-target="/promotions" />
        <a href="/users">Users sidebar</a>
        <HandlePromotions />
      </>
    );

  it("the header Back arrow asks first when the form changed (TEOS-231)", async () => {
    signInWith([PERMISSIONS.PROMOTIONS_READ, PERMISSIONS.PROMOTIONS_WRITE]);
    routerState.params = { id: PROMOTIONS[1].id };
    promotionsAPI.getPromotionById.mockResolvedValue({ data: { data: PROMOTIONS[1] } });
    renderEditWithNav();

    expect(await screen.findByPlaceholderText("Enter Name")).toHaveValue("Old");
    await userEvent.type(screen.getByPlaceholderText("Enter Name"), " v2");
    await userEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(await screen.findByText(/Leave without saving/)).toBeInTheDocument();
    expect(routerState.navigate).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Leave" }));
    expect(routerState.navigate).toHaveBeenCalledWith("/promotions");
  });

  it("a sidebar link asks first when the form changed, and Cancel stays (TEOS-231)", async () => {
    signInWith([PERMISSIONS.PROMOTIONS_READ, PERMISSIONS.PROMOTIONS_WRITE]);
    renderEditWithNav();

    await userEvent.type(await screen.findByPlaceholderText("Enter Name"), "Winter");
    await userEvent.click(screen.getByRole("link", { name: "Users sidebar" }));

    expect(await screen.findByText(/Leave without saving/)).toBeInTheDocument();
    expect(routerState.navigate).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByText(/Leave without saving/)).not.toBeInTheDocument());
    expect(screen.getByPlaceholderText("Enter Name")).toHaveValue("Winter");
    expect(routerState.navigate).not.toHaveBeenCalled();
  });

  it("a 422 shows each field error under its field, not only a toast (TEOS-230)", async () => {
    signInWith([PERMISSIONS.PROMOTIONS_READ, PERMISSIONS.PROMOTIONS_WRITE]);
    promotionsAPI.AddPromotion.mockRejectedValue(
      Object.assign(new Error("The request is invalid."), {
        response: {
          status: 422,
          data: {
            developerMessage:
              "amount: Input should be greater than 0; code: String should match pattern '^[A-Za-z0-9_-]{2,50}$'; " +
              "valid_to: Value error, must be after valid_from; bundle_codes: unknown bundle code EU5",
          },
        },
      })
    );
    render(<HandlePromotions />);

    await fillCreateForm();
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("Input should be greater than 0")).toBeInTheDocument();
    expect(screen.getByText("String should match pattern '^[A-Za-z0-9_-]{2,50}$'")).toBeInTheDocument();
    expect(screen.getByText("must be after valid_from")).toBeInTheDocument();
    expect(screen.getByText("unknown bundle code EU5")).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("a 422 without a form field keeps the toast (TEOS-230)", async () => {
    signInWith([PERMISSIONS.PROMOTIONS_READ, PERMISSIONS.PROMOTIONS_WRITE]);
    promotionsAPI.AddPromotion.mockRejectedValue(
      Object.assign(new Error("The request is invalid."), {
        response: { status: 422, data: { developerMessage: "valid_to must be after valid_from" } },
      })
    );
    render(<HandlePromotions />);

    await fillCreateForm();
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("The request is invalid."));
  });

  it("unknown id shows Promotion not found", async () => {
    signInWith([PERMISSIONS.PROMOTIONS_READ]);
    routerState.params = { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" };
    promotionsAPI.getPromotionById.mockRejectedValue(
      Object.assign(new Error("Not found"), { response: { status: 404 } })
    );
    render(<HandlePromotions />);

    expect(await screen.findByText("Promotion not found")).toBeInTheDocument();
  });

  it("without write permission the form is read-only and cannot submit", async () => {
    signInWith([PERMISSIONS.PROMOTIONS_READ]);
    routerState.params = { id: PROMOTIONS[1].id };
    promotionsAPI.getPromotionById.mockResolvedValue({ data: { data: PROMOTIONS[1] } });
    render(<HandlePromotions />);

    expect(await screen.findByPlaceholderText("Enter Name")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
    expect(within(screen.getByRole("alert")).getByText(/permission/)).toBeInTheDocument();
  });
});
