import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import { toast } from "react-toastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AuthLayout from "../Components/layout/AuthLayout";
import { SignIn, SignOut } from "../Redux/reducers/AuthReducer";
import { store } from "../Redux/store";
import { PERMISSIONS } from "../core/vairables/Permissions";
import UsersPage from "../pages/users/UsersPage";
import { render, screen, waitFor } from "./utils/test-utils";

vi.mock("react-toastify", async () => {
  const actual = await vi.importActual("react-toastify");
  return {
    ...actual,
    toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
  };
});

vi.mock("../core/apis/usersAPI", async () => {
  const actual = await vi.importActual("../core/apis/usersAPI");
  return {
    ...actual,
    getAllUsers: vi.fn(),
    banUser: vi.fn(),
    unbanUser: vi.fn(),
  };
});

import * as usersAPI from "../core/apis/usersAPI";

const signInWith = (permissions) =>
  store.dispatch(
    SignIn({
      access_token: "token",
      refresh_token: "refresh",
      expires_in: 3600,
      user: { id: "admin-id", email: "a@example.com", role: "super_admin", permissions },
    })
  );

const conflict = (code) =>
  Object.assign(new Error("Conflict"), {
    response: { status: 409, data: { developerMessage: JSON.stringify({ code }) } },
  });

const USERS = [
  {
    id: "u1",
    email: "jane@example.com",
    first_name: "Jane",
    last_name: "Doe",
    msisdn: "+96170000000",
    email_verified: true,
    phone_verified: false,
    should_notify: true,
    role: null,
    banned_until: null,
    is_banned: false,
    created_at: "2026-10-01T10:00:00+00:00",
  },
  {
    id: "u2",
    email: "banned@example.com",
    first_name: null,
    last_name: null,
    msisdn: null,
    email_verified: false,
    phone_verified: false,
    should_notify: false,
    role: null,
    banned_until: "2027-10-01T10:00:00+00:00",
    is_banned: true,
    created_at: "2026-09-01T10:00:00+00:00",
  },
];

const listResponse = (rows, total = rows.length) => ({
  data: {
    data: {
      data: rows,
      total_count: total,
      facets: { all: 2, banned: 1, active: 1 },
    },
  },
});

const renderPage = () =>
  render(
    <AuthLayout>
      <UsersPage />
    </AuthLayout>
  );

const lastCallParams = () => usersAPI.getAllUsers.mock.calls.at(-1)[0];

// The dialog tests type into several fields; under a full parallel run they can pass 5 s.
describe("Users Page", { timeout: 20000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, "", "/users");
    usersAPI.getAllUsers.mockResolvedValue(listResponse(USERS, 2));
  });

  afterEach(() => {
    store.dispatch(SignOut());
  });

  it("renders the page title", () => {
    signInWith([PERMISSIONS.USERS_READ]);
    renderPage();

    expect(
      screen.getByRole("heading", { name: /Users/i, level: 1 })
    ).toBeInTheDocument();
  });

  it("opens with page=1 and ban_status=all, shows rows, the Banned chip and the facet counts", async () => {
    signInWith([PERMISSIONS.USERS_READ]);
    renderPage();

    expect(await screen.findByText("jane@example.com")).toBeInTheDocument();
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("banned@example.com")).toBeInTheDocument();
    expect(screen.getByText("Banned")).toBeInTheDocument();
    expect(screen.getByText(/until 01-10-2027/)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "All (2)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Banned (1)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Active (1)" })).toBeInTheDocument();
    expect(usersAPI.getAllUsers.mock.calls[0][0]).toEqual({
      page: 1,
      page_size: 10,
      ban_status: "all",
      search: undefined,
      sort: "created_at",
      dir: "desc",
    });
  });

  it("account type filter: Guests sends account_type=guest, keeps it in the URL; guest rows show a Guest chip", async () => {
    signInWith([PERMISSIONS.USERS_READ]);
    const guest = { ...USERS[1], id: "g1", email: null, is_banned: false, banned_until: null, is_guest: true,
                    guest_email: "typed@checkout.com" };
    usersAPI.getAllUsers.mockImplementation(async (params) =>
      listResponse(params.account_type === "guest" ? [guest] : USERS)
    );
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("jane@example.com");
    expect(lastCallParams().account_type).toBeUndefined(); // "all" is not sent
    expect(screen.queryByText("Guest")).not.toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: /Account type/i }));
    await user.click(await screen.findByRole("option", { name: "Guests" }));

    await waitFor(() => expect(lastCallParams().account_type).toBe("guest"));
    expect(lastCallParams().page).toBe(1);
    expect(window.location.search).toContain("accountType=guest");
    expect(await screen.findByText("Guest")).toBeInTheDocument();
    // a guest has no account email: the one typed at checkout is shown
    expect(screen.getByText("typed@checkout.com")).toBeInTheDocument();
  });

  it("a page past the end moves to the last valid page and replaces the URL (TEOS-286)", async () => {
    signInWith([PERMISSIONS.USERS_READ]);
    window.history.pushState({}, "", "/users?pageSize=10&page=99");
    const entries = window.history.length;
    usersAPI.getAllUsers.mockImplementation(async (params) =>
      listResponse(params.page === 3 ? USERS : [], 21)
    );
    renderPage();

    // two requests in a row (the empty page, then the last one): more time under load
    expect(await screen.findByText("jane@example.com", {}, { timeout: 5000 })).toBeInTheDocument();
    expect(lastCallParams()).toEqual(expect.objectContaining({ page: 3 }));
    await waitFor(() => expect(window.location.search).toContain("page=2"));
    // TEOS-287: the out-of-range URL is replaced, not pushed
    expect(window.history.length).toBe(entries);
  });

  it("Back after a page change shows the earlier page again (TEOS-287)", async () => {
    signInWith([PERMISSIONS.USERS_READ]);
    usersAPI.getAllUsers.mockImplementation(async (params) =>
      listResponse([{ ...USERS[0], id: `u-p${params.page}`, email: `p${params.page}@example.com` }], 21)
    );
    renderPage();
    expect(await screen.findByText("p1@example.com")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /next page/i }));
    expect(await screen.findByText("p2@example.com")).toBeInTheDocument();

    window.history.back();
    expect(await screen.findByText("p1@example.com")).toBeInTheDocument();
    expect(window.location.search).toContain("page=0");
  });

  it("restores the search, ban status and page from the URL", async () => {
    window.history.pushState({}, "", "/users?search=jane&banStatus=banned&page=2&pageSize=25");
    signInWith([PERMISSIONS.USERS_READ]);
    renderPage();

    await waitFor(() => expect(usersAPI.getAllUsers).toHaveBeenCalled());
    expect(usersAPI.getAllUsers.mock.calls[0][0]).toEqual({
      page: 3,
      page_size: 25,
      ban_status: "banned",
      search: "jane",
      sort: "created_at",
      dir: "desc",
    });
  });

  it("Apply searches by email from page 1 and writes the URL", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/users?page=4");
    signInWith([PERMISSIONS.USERS_READ]);
    renderPage();
    await screen.findByText("jane@example.com");

    await user.type(screen.getByPlaceholderText("Search by email or phone"), "jane");
    await user.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() =>
      expect(lastCallParams()).toEqual({
        page: 1,
        page_size: 10,
        ban_status: "all",
        search: "jane",
        sort: "created_at",
        dir: "desc",
      })
    );
    expect(window.location.search).toContain("search=jane");
    expect(window.location.search).not.toContain("page=4");
  });

  it("switching to the Banned tab requests ban_status=banned from page 1", async () => {
    const user = userEvent.setup();
    signInWith([PERMISSIONS.USERS_READ]);
    renderPage();
    await screen.findByText("jane@example.com");

    await user.click(screen.getByRole("tab", { name: "Banned (1)" }));

    await waitFor(() =>
      expect(lastCallParams()).toEqual(
        expect.objectContaining({ ban_status: "banned", page: 1 })
      )
    );
    expect(window.location.search).toContain("banStatus=banned");
  });

  it("View navigates to the user detail", async () => {
    const user = userEvent.setup();
    signInWith([PERMISSIONS.USERS_READ]);
    renderPage();
    await screen.findByText("jane@example.com");

    await user.click(screen.getAllByRole("button", { name: "view" })[0]);

    expect(window.location.pathname).toBe("/users/u1");
  });

  it("shows the empty state", async () => {
    signInWith([PERMISSIONS.USERS_READ]);
    usersAPI.getAllUsers.mockResolvedValue(listResponse([], 0));
    renderPage();

    expect(await screen.findByText("No Users Found")).toBeInTheDocument();
  });

  it("API error shows an error toast and the table's empty row, no Retry", async () => {
    signInWith([PERMISSIONS.USERS_READ]);
    usersAPI.getAllUsers.mockRejectedValue(new Error("boom"));
    renderPage();

    expect(await screen.findByText("No Users Found")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    expect(toast.error).toHaveBeenCalled();
  });

  it("without admin.users.ban there is no ban or unban button", async () => {
    signInWith([PERMISSIONS.USERS_READ]);
    renderPage();
    await screen.findByText("jane@example.com");

    expect(screen.queryByRole("button", { name: "ban" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "unban" })).not.toBeInTheDocument();
  });

  it("ban dialog defaults to 365 days and sends hours=8760 with the reason, then refetches", async () => {
    const user = userEvent.setup();
    signInWith([PERMISSIONS.USERS_READ, PERMISSIONS.USERS_BAN]);
    usersAPI.banUser.mockResolvedValue({
      data: { data: { user_id: "u1", email: "jane@example.com", banned_until: "2027-10-21", hours_banned: 8760 } },
    });
    renderPage();
    await screen.findByText("jane@example.com");

    await user.click(screen.getByRole("button", { name: "ban" }));
    expect(screen.getByRole("heading", { name: "Ban User" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("365")).toHaveValue(365);
    await user.type(
      screen.getByPlaceholderText("e.g. Suspicious activity detected on the account."),
      "fraud"
    );
    await user.click(screen.getByRole("button", { name: "Confirm Ban" }));

    await waitFor(() =>
      expect(usersAPI.banUser).toHaveBeenCalledWith({ id: "u1", hours: 8760, reason: "fraud" })
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(toast.warn).not.toHaveBeenCalled();
    await waitFor(() => expect(usersAPI.getAllUsers).toHaveBeenCalledTimes(2));
  });

  it("unban dialog sends the reason", async () => {
    const user = userEvent.setup();
    signInWith([PERMISSIONS.USERS_READ, PERMISSIONS.USERS_BAN]);
    usersAPI.unbanUser.mockResolvedValue({ data: { data: { user_id: "u2", email: "banned@example.com" } } });
    renderPage();
    await screen.findByText("banned@example.com");

    await user.click(screen.getByRole("button", { name: "unban" }));
    expect(screen.getByRole("heading", { name: "Unban User" })).toBeInTheDocument();
    await user.type(
      screen.getByPlaceholderText("e.g. The account was reviewed and cleared."),
      "cleared"
    );
    await user.click(screen.getByRole("button", { name: "Confirm Unban" }));

    await waitFor(() =>
      expect(usersAPI.unbanUser).toHaveBeenCalledWith({ id: "u2", reason: "cleared" })
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });

  it("409 already_banned shows an info toast and refreshes the list", async () => {
    const user = userEvent.setup();
    signInWith([PERMISSIONS.USERS_READ, PERMISSIONS.USERS_BAN]);
    usersAPI.banUser.mockRejectedValue(conflict("already_banned"));
    renderPage();
    await screen.findByText("jane@example.com");

    await user.click(screen.getByRole("button", { name: "ban" }));
    await user.type(
      screen.getByPlaceholderText("e.g. Suspicious activity detected on the account."),
      "fraud"
    );
    await user.click(screen.getByRole("button", { name: "Confirm Ban" }));

    await waitFor(() => expect(toast.info).toHaveBeenCalled());
    await waitFor(() => expect(usersAPI.getAllUsers).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("heading", { name: "Ban User" })).not.toBeInTheDocument();
  });

  it("422 on the hours lands under the duration field", async () => {
    const user = userEvent.setup();
    signInWith([PERMISSIONS.USERS_READ, PERMISSIONS.USERS_BAN]);
    usersAPI.banUser.mockRejectedValue(
      Object.assign(new Error("hours must be at most 87600"), { response: { status: 422, data: {} } })
    );
    renderPage();
    await screen.findByText("jane@example.com");

    await user.click(screen.getByRole("button", { name: "ban" }));
    await user.type(
      screen.getByPlaceholderText("e.g. Suspicious activity detected on the account."),
      "fraud"
    );
    await user.click(screen.getByRole("button", { name: "Confirm Ban" }));

    expect(await screen.findByText("hours must be at most 87600")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ban User" })).toBeInTheDocument();
  });

  it("clicking Email sorts by email ascending from page 1, again flips to descending, kept in the URL", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/users?page=3");
    signInWith([PERMISSIONS.USERS_READ]);
    renderPage();
    await screen.findByText("jane@example.com");

    await user.click(screen.getByRole("button", { name: "Email" }));
    await waitFor(() =>
      expect(lastCallParams()).toEqual(
        expect.objectContaining({ sort: "email", dir: "asc", page: 1 })
      )
    );
    expect(window.location.search).toContain("sortBy=email");
    expect(window.location.search).toContain("sortDirection=asc");

    await user.click(screen.getByRole("button", { name: "Email" }));
    await waitFor(() =>
      expect(lastCallParams()).toEqual(
        expect.objectContaining({ sort: "email", dir: "desc" })
      )
    );
  });

  it("Created At is sortable, the other headers are not, and the date is shown", async () => {
    const user = userEvent.setup();
    signInWith([PERMISSIONS.USERS_READ]);
    renderPage();
    await screen.findByText("jane@example.com");

    expect(screen.getByText(/^01-10-2026 /)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "MSISDN" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Name" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Created At" }));
    await waitFor(() =>
      expect(lastCallParams()).toEqual(
        expect.objectContaining({ sort: "created_at", dir: "asc" })
      )
    );
  });

  it("restores the sort from the URL and ignores an unknown sort column", async () => {
    window.history.pushState({}, "", "/users?sortBy=email&sortDirection=asc");
    signInWith([PERMISSIONS.USERS_READ]);
    const { unmount } = renderPage();
    await waitFor(() => expect(usersAPI.getAllUsers).toHaveBeenCalled());
    expect(usersAPI.getAllUsers.mock.calls[0][0]).toEqual(
      expect.objectContaining({ sort: "email", dir: "asc" })
    );
    unmount();

    vi.clearAllMocks();
    usersAPI.getAllUsers.mockResolvedValue(listResponse(USERS, 2));
    window.history.pushState({}, "", "/users?sortBy=password&sortDirection=sideways");
    renderPage();
    await waitFor(() => expect(usersAPI.getAllUsers).toHaveBeenCalled());
    expect(usersAPI.getAllUsers.mock.calls[0][0]).toEqual(
      expect.objectContaining({ sort: "created_at", dir: "desc" })
    );
  });

  it("409 cannot_ban_self shows a clear error and changes nothing", async () => {
    const user = userEvent.setup();
    signInWith([PERMISSIONS.USERS_READ, PERMISSIONS.USERS_BAN]);
    usersAPI.banUser.mockRejectedValue(conflict("cannot_ban_self"));
    renderPage();
    await screen.findByText("jane@example.com");

    await user.click(screen.getByRole("button", { name: "ban" }));
    await user.type(
      screen.getByPlaceholderText("e.g. Suspicious activity detected on the account."),
      "fraud"
    );
    await user.click(screen.getByRole("button", { name: "Confirm Ban" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("You cannot ban your own account.")
    );
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.queryByRole("heading", { name: "Ban User" })).not.toBeInTheDocument();
    // nothing changed, so no refetch
    expect(usersAPI.getAllUsers).toHaveBeenCalledTimes(1);
  });

  it("403 on ban shows the permission message and closes the dialog, nothing changes (TEOS-151)", async () => {
    const user = userEvent.setup();
    signInWith([PERMISSIONS.USERS_READ, PERMISSIONS.USERS_BAN]);
    const message = "You do not have permission to perform this action.";
    usersAPI.banUser.mockRejectedValue(
      Object.assign(new Error(message), {
        isForbidden: true,
        response: { status: 403, data: { message, developerMessage: "admin.users.ban" } },
      })
    );
    renderPage();
    await screen.findByText("jane@example.com");

    await user.click(screen.getByRole("button", { name: "ban" }));
    await user.type(
      screen.getByPlaceholderText("e.g. Suspicious activity detected on the account."),
      "fraud"
    );
    await user.click(screen.getByRole("button", { name: "Confirm Ban" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(message));
    expect(screen.queryByRole("heading", { name: "Ban User" })).not.toBeInTheDocument();
    expect(usersAPI.getAllUsers).toHaveBeenCalledTimes(1);
  });

  it("a ban reason under 3 characters is refused before any request (TEOS-148)", async () => {
    const user = userEvent.setup();
    signInWith([PERMISSIONS.USERS_READ, PERMISSIONS.USERS_BAN]);
    renderPage();
    await screen.findByText("jane@example.com");

    await user.click(screen.getByRole("button", { name: "ban" }));
    await user.type(
      screen.getByPlaceholderText("e.g. Suspicious activity detected on the account."),
      "ab"
    );

    expect(await screen.findByText("Reason must be at least 3 characters")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm Ban" })).toBeDisabled();
    expect(usersAPI.banUser).not.toHaveBeenCalled();
  });

  it("409 cannot_ban_self on unban says so too", async () => {
    const user = userEvent.setup();
    signInWith([PERMISSIONS.USERS_READ, PERMISSIONS.USERS_BAN]);
    usersAPI.unbanUser.mockRejectedValue(conflict("cannot_ban_self"));
    renderPage();
    await screen.findByText("banned@example.com");

    await user.click(screen.getByRole("button", { name: "unban" }));
    await user.type(
      screen.getByPlaceholderText("e.g. The account was reviewed and cleared."),
      "cleared"
    );
    await user.click(screen.getByRole("button", { name: "Confirm Unban" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("You cannot unban your own account.")
    );
  });

  it("502 session_revoke_failed warns that the ban applied but sessions stay, and refreshes", async () => {
    const user = userEvent.setup();
    signInWith([PERMISSIONS.USERS_READ, PERMISSIONS.USERS_BAN]);
    usersAPI.banUser.mockRejectedValue(
      Object.assign(new Error("Upstream error"), {
        response: { status: 502, data: { developerMessage: "session_revoke_failed" } },
      })
    );
    renderPage();
    await screen.findByText("jane@example.com");

    await user.click(screen.getByRole("button", { name: "ban" }));
    await user.type(
      screen.getByPlaceholderText("e.g. Suspicious activity detected on the account."),
      "fraud"
    );
    await user.click(screen.getByRole("button", { name: "Confirm Ban" }));

    await waitFor(() => expect(toast.warn).toHaveBeenCalled());
    expect(toast.warn.mock.calls[0][0]).toMatch(/has been banned, but their open sessions could not be signed out/);
    expect(toast.error).not.toHaveBeenCalled();
    await waitFor(() => expect(usersAPI.getAllUsers).toHaveBeenCalledTimes(2));
  });

  it("a duration above 10 years is refused before any request", async () => {
    const user = userEvent.setup();
    signInWith([PERMISSIONS.USERS_READ, PERMISSIONS.USERS_BAN]);
    renderPage();
    await screen.findByText("jane@example.com");

    await user.click(screen.getByRole("button", { name: "ban" }));
    const duration = screen.getByPlaceholderText("365");
    await user.clear(duration);
    await user.type(duration, "4000");
    await user.type(
      screen.getByPlaceholderText("e.g. Suspicious activity detected on the account."),
      "fraud"
    );
    await user.click(screen.getByRole("button", { name: "Confirm Ban" }));

    expect(await screen.findByText("Ban duration cannot exceed 87600 hours")).toBeInTheDocument();
    expect(usersAPI.banUser).not.toHaveBeenCalled();
  });
});
