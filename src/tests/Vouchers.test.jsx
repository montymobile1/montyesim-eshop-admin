import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import { toast } from "react-toastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignIn, SignOut } from "../Redux/reducers/AuthReducer";
import { store } from "../Redux/store";
import { PERMISSIONS } from "../core/vairables/Permissions";
import dayjs from "dayjs";
import VoucherPage, { isExpired } from "../pages/vouchers/VoucherPage";
import VoucherForm from "../pages/vouchers/components/forms/VoucherForm";
import { render, screen, waitFor } from "./utils/test-utils";

vi.mock("react-countup", () => ({ default: ({ end }) => <span>{end}</span> }));

vi.mock("react-toastify", async () => {
  const actual = await vi.importActual("react-toastify");
  return {
    ...actual,
    toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  };
});

vi.mock("../core/apis/vouchersAPI", async () => {
  const actual = await vi.importActual("../core/apis/vouchersAPI");
  return {
    getApiErrorCode: actual.getApiErrorCode,
    getAllVouchers: vi.fn(),
    addVoucher: vi.fn(),
    toggleVoucherStatus: vi.fn(),
    DeleteVoucher: vi.fn(),
  };
});

vi.mock("../core/helpers/clipboard", () => ({ copyToClipboard: vi.fn() }));

import * as vouchersAPI from "../core/apis/vouchersAPI";
import { copyToClipboard } from "../core/helpers/clipboard";

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

const listResponse = {
  data: {
    data: {
      data: [
        {
          id: 1,
          code: "SUMMER",
          amount: 10,
          is_used: false,
          is_active: true,
          expired_at: null,
          created_at: "2026-10-20T10:00:00",
          used_by_user: null,
        },
        {
          id: 2,
          code: "USED1",
          amount: 5,
          is_used: true,
          is_active: false,
          expired_at: "2026-12-31T00:00:00",
          created_at: "2026-10-19T10:00:00",
          used_by: { id: "u1", email: "user@example.com" },
          used_by_user: { id: "u1", email: "user@example.com" },
        },
        {
          id: 3,
          code: "OLD-ONE",
          amount: 7,
          currency: "EUR",
          is_used: false,
          is_active: true,
          is_expired: true,
          expired_at: "2020-01-01T00:00:00",
          created_at: "2019-10-19T10:00:00",
          used_by: null,
          used_by_user: null,
        },
      ],
      total_count: 3,
      facets: { all: 3, active: 2, inactive: 1, used: 1, expired: 1 },
    },
  },
};

describe("Vouchers page", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/vouchers");
    vi.clearAllMocks();
    vouchersAPI.getAllVouchers.mockResolvedValue(listResponse);
  });

  afterEach(() => {
    store.dispatch(SignOut());
  });

  it("loads page 1 from the API with status=all and shows tab counts and used-by email", async () => {
    signInWith([PERMISSIONS.VOUCHERS_READ, PERMISSIONS.VOUCHERS_WRITE]);
    render(<VoucherPage />);

    expect(await screen.findByText("SUMMER")).toBeInTheDocument();
    expect(screen.getByText("user@example.com")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "All (3)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Inactive (1)" })).toBeInTheDocument();
    expect(vouchersAPI.getAllVouchers).toHaveBeenCalledWith({
      page: 1,
      page_size: 10,
      status: "all",
      search: undefined,
    });
  });

  it("a page past the end moves to the last valid page and replaces the URL (TEOS-286)", async () => {
    signInWith([PERMISSIONS.VOUCHERS_READ]);
    window.history.pushState({}, "", "/vouchers?pageSize=10&page=99");
    const entries = window.history.length;
    vouchersAPI.getAllVouchers.mockImplementation(async (params) => ({
      data: {
        data: {
          ...listResponse.data.data,
          data: params.page === 3 ? listResponse.data.data.data : [],
          total_count: 21,
        },
      },
    }));
    render(<VoucherPage />);

    // two requests in a row (the empty page, then the last one): more time under load
    expect(await screen.findByText("SUMMER", {}, { timeout: 5000 })).toBeInTheDocument();
    expect(vouchersAPI.getAllVouchers).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 3 })
    );
    await waitFor(() => expect(window.location.search).toContain("page=2"));
    // TEOS-287: the out-of-range URL is replaced, not pushed
    expect(window.history.length).toBe(entries);
  });

  it("switching tab requests that status from page 1", async () => {
    signInWith([PERMISSIONS.VOUCHERS_READ]);
    render(<VoucherPage />);
    await screen.findByText("SUMMER");

    await userEvent.click(screen.getByRole("tab", { name: "Active (2)" }));

    await waitFor(() =>
      expect(vouchersAPI.getAllVouchers).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: "active", page: 1 })
      )
    );
  });

  it("status switch sends PATCH with the new state", async () => {
    signInWith([PERMISSIONS.VOUCHERS_READ, PERMISSIONS.VOUCHERS_WRITE]);
    vouchersAPI.toggleVoucherStatus.mockResolvedValue({ data: {} });
    render(<VoucherPage />);
    await screen.findByText("SUMMER");

    await userEvent.click(screen.getByRole("checkbox", { name: "Toggle SUMMER" }));

    expect(vouchersAPI.toggleVoucherStatus).toHaveBeenCalledWith({ id: 1, is_active: false });
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });

  it("delete refused by the API (voucher_used) shows an info toast", async () => {
    signInWith([PERMISSIONS.VOUCHERS_READ, PERMISSIONS.VOUCHERS_WRITE]);
    vouchersAPI.DeleteVoucher.mockRejectedValue(conflict("voucher_used"));
    render(<VoucherPage />);
    await screen.findByText("SUMMER");

    await userEvent.click(screen.getAllByRole("button", { name: "delete" })[0]);
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

    expect(vouchersAPI.DeleteVoucher).toHaveBeenCalledWith(1);
    await waitFor(() => expect(toast.info).toHaveBeenCalled());
  });

  it("without write permission there is no add or delete button and switches are disabled", async () => {
    signInWith([PERMISSIONS.VOUCHERS_READ]);
    render(<VoucherPage />);
    await screen.findByText("SUMMER");

    expect(screen.queryByRole("button", { name: "Add" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "delete" })).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Toggle SUMMER" })).toBeDisabled();
  });
});

describe("Voucher form", () => {
  beforeEach(() => vi.clearAllMocks());

  const fill = async () => {
    await userEvent.type(screen.getByPlaceholderText("Enter Code"), "SUMMER");
    await userEvent.type(screen.getByPlaceholderText("Enter amount"), "10");
    const date = document.querySelector("input[type=date]");
    await userEvent.type(date, "2099-01-01");
  };

  it("409 duplicate_code is shown on the code field, with no pre-check request", async () => {
    vouchersAPI.addVoucher.mockRejectedValue(conflict("duplicate_code"));
    render(<VoucherForm onSuccess={vi.fn()} OnCancel={vi.fn()} />);

    await fill();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Code is not unique")).toBeInTheDocument();
    expect(vouchersAPI.addVoucher).toHaveBeenCalledTimes(1);
    expect(vouchersAPI.addVoucher).toHaveBeenCalledWith({
      code: "SUMMER",
      amount: 10,
      expired_at: "2099-01-01",
    });
  });

  it("creates the voucher and calls onSuccess", async () => {
    const onSuccess = vi.fn();
    vouchersAPI.addVoucher.mockResolvedValue({ status: 201, data: {} });
    render(<VoucherForm onSuccess={onSuccess} OnCancel={vi.fn()} />);

    await fill();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalled();
  });

  it("Generate for me sends no code and shows the new code with Copy", async () => {
    const onSuccess = vi.fn();
    vouchersAPI.addVoucher.mockResolvedValue({
      status: 201,
      data: { data: { id: 9, code: "K7M2P9QX4RTA", amount: 10 } },
    });
    render(<VoucherForm onSuccess={onSuccess} OnCancel={vi.fn()} />);

    await userEvent.click(screen.getByRole("checkbox", { name: "Generate for me" }));
    expect(screen.getByPlaceholderText("Generated by the server")).toBeDisabled();
    await userEvent.type(screen.getByPlaceholderText("Enter amount"), "10");
    await userEvent.type(document.querySelector("input[type=date]"), "2099-01-01");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByTestId("created-voucher-code")).toHaveTextContent("K7M2P9QX4RTA");
    expect(vouchersAPI.addVoucher).toHaveBeenCalledWith({
      code: undefined,
      amount: 10,
      expired_at: "2099-01-01",
    });
    expect(onSuccess).toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(copyToClipboard).toHaveBeenCalledWith("K7M2P9QX4RTA", "Code copied");
  });

  it("a typed code is sent upper case", async () => {
    vouchersAPI.addVoucher.mockResolvedValue({ status: 201, data: { data: { id: 1, code: "SUMMER-25" } } });
    render(<VoucherForm onSuccess={vi.fn()} OnCancel={vi.fn()} />);

    await userEvent.type(screen.getByPlaceholderText("Enter Code"), "summer-25");
    await userEvent.type(screen.getByPlaceholderText("Enter amount"), "10");
    await userEvent.type(document.querySelector("input[type=date]"), "2099-01-01");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(vouchersAPI.addVoucher).toHaveBeenCalledWith(expect.objectContaining({ code: "SUMMER-25" }))
    );
  });

  it("422 above VOUCHER_MAX_AMOUNT is shown on the amount field; the form stays open", async () => {
    vouchersAPI.addVoucher.mockRejectedValue(
      Object.assign(new Error("Validation failed"), {
        response: {
          status: 422,
          data: { developerMessage: "amount: must be at most 1e+06 (VOUCHER_MAX_AMOUNT)" },
        },
      })
    );
    render(<VoucherForm onSuccess={vi.fn()} OnCancel={vi.fn()} />);

    await fill();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText(/Amount must be at most/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("an amount of 0 or an expiry in the past is refused before any request", async () => {
    render(<VoucherForm onSuccess={vi.fn()} OnCancel={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText("Enter Code"), "SUMMER");
    await userEvent.type(screen.getByPlaceholderText("Enter amount"), "0");
    await userEvent.type(document.querySelector("input[type=date]"), "2000-01-01");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Amount must be positive")).toBeInTheDocument();
    expect(screen.getByText("Expiry date must be today or later")).toBeInTheDocument();
    expect(vouchersAPI.addVoucher).not.toHaveBeenCalled();
  });

  it("the amount is sent as a JSON number (TEOS-215)", async () => {
    vouchersAPI.addVoucher.mockResolvedValue({ status: 201, data: {} });
    render(<VoucherForm onSuccess={vi.fn()} OnCancel={vi.fn()} />);

    await fill();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(vouchersAPI.addVoucher).toHaveBeenCalledTimes(1));
    const sent = vouchersAPI.addVoucher.mock.calls[0][0];
    expect(typeof sent.amount).toBe("number");
    expect(JSON.stringify(sent)).toContain('"amount":10');
  });

  it("today is accepted as the expiry date (TEOS-214)", async () => {
    vouchersAPI.addVoucher.mockResolvedValue({ status: 201, data: {} });
    render(<VoucherForm onSuccess={vi.fn()} OnCancel={vi.fn()} />);
    const today = dayjs().format("YYYY-MM-DD");

    await userEvent.type(screen.getByPlaceholderText("Enter Code"), "TODAY");
    await userEvent.type(screen.getByPlaceholderText("Enter amount"), "5");
    await userEvent.type(document.querySelector("input[type=date]"), today);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(vouchersAPI.addVoucher).toHaveBeenCalledWith({ code: "TODAY", amount: 5, expired_at: today })
    );
    expect(screen.queryByText("Expiry date must be today or later")).not.toBeInTheDocument();
  });

  it("a code with spaces is refused before any request", async () => {
    render(<VoucherForm onSuccess={vi.fn()} OnCancel={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText("Enter Code"), "has space");
    await userEvent.type(screen.getByPlaceholderText("Enter amount"), "10");
    await userEvent.type(document.querySelector("input[type=date]"), "2099-01-01");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText("Code must be 4 to 32 letters, digits or -")
    ).toBeInTheDocument();
    expect(vouchersAPI.addVoucher).not.toHaveBeenCalled();
  });
});

describe("Vouchers page (TEOS-136)", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/vouchers");
    vi.clearAllMocks();
    vouchersAPI.getAllVouchers.mockResolvedValue(listResponse);
  });

  afterEach(() => {
    store.dispatch(SignOut());
  });

  it("shows the five tabs with counts; Used and Expired request their status", async () => {
    signInWith([PERMISSIONS.VOUCHERS_READ]);
    render(<VoucherPage />);
    await screen.findByText("SUMMER");

    expect(screen.getByRole("tab", { name: "Used (1)" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Expired (1)" }));
    await waitFor(() =>
      expect(vouchersAPI.getAllVouchers).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: "expired", page: 1 })
      )
    );
    await userEvent.click(screen.getByRole("tab", { name: "Used (1)" }));
    await waitFor(() =>
      expect(vouchersAPI.getAllVouchers).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: "used", page: 1 })
      )
    );
  });

  it("a used voucher has no Delete and no Activate; every row has Copy code", async () => {
    signInWith([PERMISSIONS.VOUCHERS_READ, PERMISSIONS.VOUCHERS_WRITE]);
    render(<VoucherPage />);
    await screen.findByText("USED1");

    expect(screen.getAllByRole("button", { name: "delete" })).toHaveLength(2); // SUMMER, OLD-ONE
    expect(screen.queryByRole("checkbox", { name: "Toggle USED1" })).not.toBeInTheDocument();
    expect(screen.getByText("Used")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^copy code/ })).toHaveLength(3);

    await userEvent.click(screen.getByRole("button", { name: "copy code USED1" }));
    expect(copyToClipboard).toHaveBeenCalledWith("USED1", "Code copied");
  });

  it("without write permission the menu shows only Copy code", async () => {
    signInWith([PERMISSIONS.VOUCHERS_READ]);
    render(<VoucherPage />);
    await screen.findByText("SUMMER");

    expect(screen.queryByRole("button", { name: "delete" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^copy code/ })).toHaveLength(3);
  });

  it("an expired voucher is labelled Expired; the amount is shown with its currency", async () => {
    signInWith([PERMISSIONS.VOUCHERS_READ]);
    render(<VoucherPage />);
    await screen.findByText("OLD-ONE");

    expect(screen.getByText("Expired", { selector: ".MuiChip-label" })).toBeInTheDocument();
    expect(screen.getByText(/EUR/)).toBeInTheDocument();
  });

  it("a voucher expiring today is still valid; expired only from the next day (TEOS-214)", () => {
    const now = dayjs("2026-10-26T18:30:00");
    const voucher = { is_used: false, expired_at: "2026-10-26T00:00:00" };
    expect(isExpired(voucher, now)).toBe(false);
    expect(isExpired({ ...voucher, expired_at: "2026-10-26" }, now)).toBe(false);
    expect(isExpired({ ...voucher, expired_at: "2026-10-25T23:59:59" }, now)).toBe(true);
    // the API flag wins when present
    expect(isExpired({ ...voucher, is_expired: true }, now)).toBe(true);
    expect(isExpired({ ...voucher, expired_at: "2026-10-20", is_used: true }, now)).toBe(false);
  });

  it("409 already_used on activate shows a message and refreshes", async () => {
    signInWith([PERMISSIONS.VOUCHERS_READ, PERMISSIONS.VOUCHERS_WRITE]);
    vouchersAPI.toggleVoucherStatus.mockRejectedValue(conflict("already_used"));
    render(<VoucherPage />);
    await screen.findByText("SUMMER");
    const calls = vouchersAPI.getAllVouchers.mock.calls.length;

    await userEvent.click(screen.getByRole("checkbox", { name: "Toggle SUMMER" }));

    await waitFor(() => expect(toast.info).toHaveBeenCalled());
    await waitFor(() => expect(vouchersAPI.getAllVouchers.mock.calls.length).toBeGreaterThan(calls));
  });

  it("an empty tab shows No vouchers", async () => {
    signInWith([PERMISSIONS.VOUCHERS_READ]);
    vouchersAPI.getAllVouchers.mockResolvedValue({
      data: { data: { data: [], total_count: 0, facets: { all: 0, active: 0, inactive: 0, used: 0, expired: 0 } } },
    });
    render(<VoucherPage />);

    expect(await screen.findByText("No vouchers")).toBeInTheDocument();
  });
});
