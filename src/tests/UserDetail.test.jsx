import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignIn, SignOut } from "../Redux/reducers/AuthReducer";
import { store } from "../Redux/store";
import { PERMISSIONS } from "../core/vairables/Permissions";
import UserDetail from "../pages/users/UserDetail";
import { render, screen, waitFor } from "./utils/test-utils";

vi.mock("react-countup", () => ({ default: ({ end }) => <span>{end}</span> }));

vi.mock("react-toastify", async () => {
  const actual = await vi.importActual("react-toastify");
  return { ...actual, toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } };
});

const UID = "11111111-1111-4111-8111-111111111111";
let mockId = UID;
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useParams: () => ({ id: mockId }) };
});

vi.mock("../core/apis/usersAPI", async () => {
  const actual = await vi.importActual("../core/apis/usersAPI");
  return {
    ...actual,
    getUserById: vi.fn(),
    getUserDevices: vi.fn(),
    getUserWalletTransactions: vi.fn(),
  };
});

import * as usersAPI from "../core/apis/usersAPI";
import { toast } from "react-toastify";

const signInWith = (permissions) =>
  store.dispatch(
    SignIn({
      access_token: "token",
      refresh_token: "refresh",
      expires_in: 3600,
      user: { id: "admin-id", email: "a@example.com", role: "admin", permissions },
    })
  );

const listResponse = (rows, total = rows.length) => ({
  data: { data: { data: rows, total_count: total } },
});

const USER = {
  id: UID,
  email: "jane@example.com",
  first_name: "Jane",
  last_name: "Doe",
  msisdn: "+96170845833",
  created_at: "2026-03-11T09:30:00",
  is_banned: false,
  banned_until: null,
  wallet: { amount: 12.5, currency: "EUR" },
};

const DEVICES = [
  {
    id: 41,
    user_id: UID,
    manufacturer: "Apple",
    device_model: "iPhone 15",
    ip_location: "Beirut",
    timestamp_login: "2026-10-01T10:00:00",
    timestamp_logout: null,
  },
];

const WALLET_ROWS = [
  { id: "t1", wallet_id: "w1", amount: 5, status: "success", source: "Top up", currency: "EUR", created_at: "2026-10-01T10:00:00" },
];

describe("User detail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockId = UID;
    vi.stubEnv("VITE_SUPPORT_PROMO", "true");
    usersAPI.getUserById.mockResolvedValue({ data: { data: USER } });
    usersAPI.getUserDevices.mockResolvedValue(listResponse(DEVICES, 37));
    usersAPI.getUserWalletTransactions.mockResolvedValue(listResponse(WALLET_ROWS, 53));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    store.dispatch(SignOut());
  });

  it("shows the header from GET /users/{id} and the devices tab with the true total", async () => {
    signInWith([PERMISSIONS.USERS_READ, PERMISSIONS.DEVICES_READ]);
    render(<UserDetail />);

    expect(await screen.findByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByTestId("user-email")).toHaveTextContent("Email: jane@example.com");
    expect(screen.getByTestId("user-phone")).toHaveTextContent("Phone: +96170845833");
    expect(screen.getByTestId("user-created-at")).toHaveTextContent("Created At: 11-03-2026 09:30");
    expect(screen.getByTestId("user-status")).toHaveTextContent("Status: Active");
    // The email is shown once, as a labelled field, not also as a title.
    expect(screen.getAllByText("jane@example.com")).toHaveLength(1);
    expect(screen.getByTestId("user-wallet")).toHaveTextContent("Wallet: EUR 12.5");
    expect(await screen.findByText("iPhone 15")).toBeInTheDocument();
    expect(screen.getByText(/1–10 of 37/)).toBeInTheDocument();
    expect(usersAPI.getUserById).toHaveBeenCalledWith(UID);
    expect(usersAPI.getUserDevices).toHaveBeenCalledWith(UID, { page: 1, page_size: 10 });
  });

  it("TEOS-160: a missing phone or creation date shows N/A with its label", async () => {
    usersAPI.getUserById.mockResolvedValue({
      data: { data: { ...USER, msisdn: null, created_at: null } },
    });
    signInWith([PERMISSIONS.USERS_READ, PERMISSIONS.DEVICES_READ]);
    render(<UserDetail />);

    expect(await screen.findByTestId("user-phone")).toHaveTextContent("Phone: N/A");
    expect(screen.getByTestId("user-created-at")).toHaveTextContent("Created At: N/A");
  });

  it("a phone-only user without a name has no title and Email: N/A", async () => {
    usersAPI.getUserById.mockResolvedValue({
      data: { data: { ...USER, first_name: null, last_name: null, email: null } },
    });
    signInWith([PERMISSIONS.USERS_READ, PERMISSIONS.DEVICES_READ]);
    render(<UserDetail />);

    expect(await screen.findByTestId("user-phone")).toHaveTextContent("Phone: +96170845833");
    expect(screen.getByTestId("user-email")).toHaveTextContent("Email: N/A");
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("paging the devices tab asks the API for the next page", async () => {
    const user = userEvent.setup();
    signInWith([PERMISSIONS.USERS_READ, PERMISSIONS.DEVICES_READ]);
    render(<UserDetail />);
    await screen.findByText("iPhone 15");

    await user.click(screen.getByRole("button", { name: /next page/i }));

    await waitFor(() =>
      expect(usersAPI.getUserDevices).toHaveBeenLastCalledWith(UID, { page: 2, page_size: 10 })
    );
  });

  it("the wallet tab pages server-side with the true total", async () => {
    const user = userEvent.setup();
    signInWith([PERMISSIONS.USERS_READ, PERMISSIONS.DEVICES_READ]);
    render(<UserDetail />);
    await screen.findByText("iPhone 15");

    await user.click(screen.getByRole("tab", { name: "Wallet Transactions" }));

    expect(await screen.findByText("Top up")).toBeInTheDocument();
    expect(screen.getByText(/1–10 of 53/)).toBeInTheDocument();
    expect(usersAPI.getUserWalletTransactions).toHaveBeenCalledWith(UID, { page: 1, page_size: 10 });
  });

  it("there is no Referral Transactions tab (removed as MS-5080 asks)", async () => {
    signInWith([PERMISSIONS.USERS_READ, PERMISSIONS.DEVICES_READ, PERMISSIONS.REFERRALS_READ]);
    render(<UserDetail />);
    await screen.findByText("iPhone 15");
    expect(screen.queryByRole("tab", { name: "Referral Transactions" })).not.toBeInTheDocument();
  });

  it.each([404, 422])(
    "a %s on the profile shows 'User not found' with a link back, no tabs and no tab requests (TEOS-161)",
    async (status) => {
      signInWith([PERMISSIONS.USERS_READ, PERMISSIONS.DEVICES_READ]);
      usersAPI.getUserById.mockRejectedValue(
        Object.assign(new Error("Not found"), { response: { status } })
      );
      render(<UserDetail />);

      expect(await screen.findByText("User not found")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Back to Users" })).toHaveAttribute("href", "/users");
      expect(screen.queryByRole("tab", { name: "Devices" })).not.toBeInTheDocument();
      expect(usersAPI.getUserDevices).not.toHaveBeenCalled();
    }
  );

  it("a 404 user_not_found from the devices tab shows 'User not found', no error toast (TEOS-153)", async () => {
    signInWith([PERMISSIONS.USERS_READ, PERMISSIONS.DEVICES_READ]);
    usersAPI.getUserDevices.mockRejectedValue(
      Object.assign(new Error("User not found"), {
        response: { status: 404, data: { developerMessage: JSON.stringify({ code: "user_not_found" }) } },
      })
    );
    render(<UserDetail />);

    expect(await screen.findByText("User not found")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Users" })).toHaveAttribute("href", "/users");
    expect(screen.queryByRole("tab", { name: "Devices" })).not.toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("a 404 from the wallet tab shows 'User not found' too (TEOS-153)", async () => {
    signInWith([PERMISSIONS.USERS_READ, PERMISSIONS.DEVICES_READ]);
    usersAPI.getUserWalletTransactions.mockRejectedValue(
      Object.assign(new Error("User not found"), { response: { status: 404 } })
    );
    render(<UserDetail />);
    await screen.findByText("iPhone 15");

    await userEvent.click(screen.getByRole("tab", { name: "Wallet Transactions" }));

    expect(await screen.findByText("User not found")).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("another tab error keeps the tab's error toast", async () => {
    signInWith([PERMISSIONS.USERS_READ, PERMISSIONS.DEVICES_READ]);
    usersAPI.getUserDevices.mockRejectedValue(
      Object.assign(new Error("boom"), { response: { status: 500 } })
    );
    render(<UserDetail />);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Failed to load user devices"));
    expect(screen.queryByText("User not found")).not.toBeInTheDocument();
  });

  it("a malformed id shows 'User not found' without calling the API (TEOS-161)", async () => {
    mockId = "not-a-uuid";
    signInWith([PERMISSIONS.USERS_READ, PERMISSIONS.DEVICES_READ]);
    render(<UserDetail />);

    expect(await screen.findByText("User not found")).toBeInTheDocument();
    expect(usersAPI.getUserById).not.toHaveBeenCalled();
    expect(usersAPI.getUserDevices).not.toHaveBeenCalled();
  });
});
