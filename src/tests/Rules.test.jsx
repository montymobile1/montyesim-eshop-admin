import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import { toast } from "react-toastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// these tests type into forms; a loaded CI machine needs more than the 5 s default
vi.setConfig({ testTimeout: 30000 });
import { SignIn, SignOut } from "../Redux/reducers/AuthReducer";
import { store } from "../Redux/store";
import { PERMISSIONS } from "../core/vairables/Permissions";
import RulesList from "../pages/rules/RulesList";
import { render, screen, waitFor } from "./utils/test-utils";

vi.mock("react-toastify", async () => {
  const actual = await vi.importActual("react-toastify");
  return {
    ...actual,
    toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  };
});

vi.mock("../core/apis/rulesAPI", async () => {
  const actual = await vi.importActual("../core/apis/rulesAPI");
  return {
    getApiErrorCode: actual.getApiErrorCode,
    getAllRules: vi.fn(),
    getAllActions: vi.fn(),
    getAllEvents: vi.fn(),
    AddRule: vi.fn(),
    editRule: vi.fn(),
    deleteRule: vi.fn(),
  };
});

import * as rulesAPI from "../core/apis/rulesAPI";

const signInWith = (permissions) =>
  store.dispatch(
    SignIn({
      access_token: "token",
      refresh_token: "refresh",
      expires_in: 3600,
      user: { id: "id", email: "a@example.com", role: "admin", permissions },
    })
  );

const conflict = (code) =>
  Object.assign(new Error("Conflict"), {
    response: { status: 409, data: { developerMessage: JSON.stringify({ code }) } },
  });

const RULES = [
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    id_text: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    name: "DISCOUNT_AMOUNT-CREATE_ORDER-3",
    max_usage: 3,
    beneficiary: 1,
    created_at: "2026-10-20T10:00:00",
    action: { id: 1, name: "DISCOUNT_AMOUNT" },
    event: { id: 1, name: "CREATE_ORDER" },
  },
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    id_text: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    name: "CASHBACK_PERCENTAGE-CREATE_ACCOUNT-1",
    max_usage: 1,
    beneficiary: 2,
    created_at: "2026-10-19T10:00:00",
    action: { id: 4, name: "CASHBACK_PERCENTAGE" },
    event: { id: 2, name: "CREATE_ACCOUNT" },
  },
];

const listResponse = { data: { data: { data: RULES, total_count: 2 } } };

describe("Rules page", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/rules");
    vi.clearAllMocks();
    rulesAPI.getAllRules.mockResolvedValue(listResponse);
    rulesAPI.getAllActions.mockResolvedValue({
      data: { data: [{ id: 1, name: "DISCOUNT_AMOUNT" }, { id: 4, name: "CASHBACK_PERCENTAGE" }] },
    });
    rulesAPI.getAllEvents.mockResolvedValue({
      data: { data: [{ id: 1, name: "CREATE_ORDER" }, { id: 2, name: "CREATE_ACCOUNT" }] },
    });
  });

  afterEach(() => {
    store.dispatch(SignOut());
  });

  it("loads page 1 from the API, shows action and event names, fetches actions/events once", async () => {
    signInWith([PERMISSIONS.RULES_READ, PERMISSIONS.RULES_WRITE]);
    render(<RulesList />);

    expect(await screen.findByText("DISCOUNT_AMOUNT")).toBeInTheDocument();
    expect(screen.getByText("CREATE_ACCOUNT")).toBeInTheDocument();
    expect(screen.getByText("Sender & Receiver")).toBeInTheDocument();
    expect(rulesAPI.getAllRules).toHaveBeenCalledWith({
      page: 1,
      page_size: 10,
      search: undefined,
      action_id: undefined,
      event_id: undefined,
    });
    await waitFor(() => expect(rulesAPI.getAllActions).toHaveBeenCalledTimes(1));
    expect(rulesAPI.getAllEvents).toHaveBeenCalledTimes(1);
  });

  it("a page past the end moves to the last valid page and replaces the URL (TEOS-286)", async () => {
    signInWith([PERMISSIONS.RULES_READ]);
    window.history.pushState({}, "", "/rules?pageSize=10&page=99");
    const entries = window.history.length;
    rulesAPI.getAllRules.mockImplementation(async (params) => ({
      data: { data: { data: params.page === 3 ? RULES : [], total_count: 21 } },
    }));
    render(<RulesList />);

    // two requests in a row (the empty page, then the last one): more time under load
    expect(await screen.findByText("DISCOUNT_AMOUNT", {}, { timeout: 5000 })).toBeInTheDocument();
    expect(rulesAPI.getAllRules).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3 }));
    await waitFor(() => expect(window.location.search).toContain("page=2"));
    // TEOS-287: the out-of-range URL is replaced, not pushed
    expect(window.history.length).toBe(entries);
  });

  it("applying a search goes back to page 1 and sends it as a plain parameter", async () => {
    signInWith([PERMISSIONS.RULES_READ]);
    window.history.pushState({}, "", "/rules?page=2");
    render(<RulesList />);
    await screen.findByText("DISCOUNT_AMOUNT");
    expect(rulesAPI.getAllRules).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 3 })
    );

    await userEvent.type(screen.getByPlaceholderText("Search by ID"), "aa%,b");
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() =>
      expect(rulesAPI.getAllRules).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: "aa%,b", page: 1 })
      )
    );
    expect(window.location.search).toContain("search=aa%25%2Cb");
  });

  it("delete refused by the API (rule_in_use) shows an info toast and keeps the row", async () => {
    signInWith([PERMISSIONS.RULES_READ, PERMISSIONS.RULES_WRITE]);
    rulesAPI.deleteRule.mockRejectedValue(conflict("rule_in_use"));
    render(<RulesList />);
    await screen.findByText("DISCOUNT_AMOUNT");

    await userEvent.click(screen.getAllByRole("button", { name: /^Actions for rule / })[0]);
    await userEvent.click(screen.getByRole("menuitem", { name: /^Delete/ }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

    expect(rulesAPI.deleteRule).toHaveBeenCalledWith(RULES[0].id);
    await waitFor(() => expect(toast.info).toHaveBeenCalled());
    expect(screen.getByText("DISCOUNT_AMOUNT")).toBeInTheDocument();
  });

  it("delete of an unused rule calls DELETE and refetches", async () => {
    signInWith([PERMISSIONS.RULES_READ, PERMISSIONS.RULES_WRITE]);
    rulesAPI.deleteRule.mockResolvedValue({ status: 204 });
    render(<RulesList />);
    await screen.findByText("DISCOUNT_AMOUNT");

    await userEvent.click(screen.getAllByRole("button", { name: /^Actions for rule / })[1]);
    await userEvent.click(screen.getByRole("menuitem", { name: /^Delete/ }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    await waitFor(() => expect(rulesAPI.getAllRules).toHaveBeenCalledTimes(2));
  });

  it("shows a Promotions column and disables Delete for a rule in use (TEOS-210)", async () => {
    signInWith([PERMISSIONS.RULES_READ, PERMISSIONS.RULES_WRITE]);
    rulesAPI.getAllRules.mockResolvedValue({
      data: {
        data: {
          data: [{ ...RULES[0], promotion_count: 2 }, { ...RULES[1], promotion_count: 0 }],
          total_count: 2,
        },
      },
    });
    render(<RulesList />);
    await screen.findByText("DISCOUNT_AMOUNT");

    const headers = screen.getAllByRole("columnheader").map((cell) => cell.textContent);
    expect(headers).toContain("Promotions");
    const firstRow = screen.getByText("DISCOUNT_AMOUNT").closest("tr");
    const cells = Array.from(firstRow.querySelectorAll("td")).map((cell) => cell.textContent);
    expect(cells[headers.indexOf("Promotions")]).toBe("2");

    await userEvent.click(screen.getAllByRole("button", { name: /^Actions for rule / })[0]);
    const inUse = screen.getByRole("menuitem", { name: /^Delete/ });
    expect(inUse).toHaveAttribute("aria-disabled", "true");
    expect(inUse).toHaveTextContent("Used by 2 promotions");
    await userEvent.keyboard("{Escape}");

    await userEvent.click(screen.getAllByRole("button", { name: /^Actions for rule / })[1]);
    const unused = screen.getByRole("menuitem", { name: /^Delete/ });
    expect(unused).not.toHaveAttribute("aria-disabled", "true");
    expect(rulesAPI.deleteRule).not.toHaveBeenCalled();
  });

  it("without write permission there is no add, edit or delete button", async () => {
    signInWith([PERMISSIONS.RULES_READ]);
    render(<RulesList />);
    await screen.findByText("DISCOUNT_AMOUNT");

    expect(screen.queryByRole("button", { name: "Add" })).not.toBeInTheDocument();
    // no action is allowed, so the rows have no ⋯ menu
    expect(screen.queryByRole("button", { name: /^Actions for rule / })).not.toBeInTheDocument();
  });

  it("API error shows a toast and the table's empty row, no Retry", async () => {
    signInWith([PERMISSIONS.RULES_READ]);
    rulesAPI.getAllRules.mockRejectedValue(new Error("boom"));
    render(<RulesList />);

    expect(await screen.findByText("No Rules Found")).toBeInTheDocument();
    expect(screen.queryByText("Failed to load rules.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith("Fail to display data");
  });
});
