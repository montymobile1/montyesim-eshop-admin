import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import { toast } from "react-toastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TopNav from "../Components/layout/TopNav";
import { SignIn, SignOut } from "../Redux/reducers/AuthReducer";
import { store } from "../Redux/store";
import { newPasswordSchema } from "../core/helpers/passwordSchema";
import { MenuRoutes } from "../core/routes/Pages";
import { privateRoutes, publicRoutes } from "../core/routes/allRoutes";
import { PERMISSIONS } from "../core/vairables/Permissions";
import AdminsPage from "../pages/admins/AdminsPage";
import ResetPasswordPage, { readResetLink } from "../pages/authentication/ResetPasswordPage";
import ProfilePage from "../pages/profile/ProfilePage";
import { render, screen, waitFor } from "./utils/test-utils";

vi.mock("react-toastify", async () => {
  const actual = await vi.importActual("react-toastify");
  return {
    ...actual,
    toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
  };
});

vi.mock("../core/apis/authAPI", async () => {
  const actual = await vi.importActual("../core/apis/authAPI");
  return { ...actual, changePassword: vi.fn(), resetPassword: vi.fn(), logout: vi.fn() };
});

vi.mock("../core/apis/adminsAPI", async () => {
  const actual = await vi.importActual("../core/apis/adminsAPI");
  return {
    ...actual,
    getAdmins: vi.fn(),
    sendPasswordReset: vi.fn(),
    revokeAdminAccess: vi.fn(),
  };
});

import * as adminsAPI from "../core/apis/adminsAPI";
import * as authAPI from "../core/apis/authAPI";

const GOOD = "N3w-Passw0rd!x";

const signInAs = (role = "admin", permissions = []) =>
  store.dispatch(
    SignIn({
      access_token: "old-access",
      refresh_token: "old-refresh",
      expires_in: 3600,
      user: { id: "me", email: "me@example.com", role, permissions },
    })
  );

const apiError = (status, { message = "API message", developerMessage } = {}) =>
  Object.assign(new Error(message), {
    response: { status, data: { message, developerMessage } },
  });

const fillPasswords = async (user, values) => {
  for (const [placeholder, value] of Object.entries(values)) {
    if (value) await user.type(screen.getByPlaceholderText(placeholder), value);
  }
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  store.dispatch(SignOut());
});

// ---------- rules ----------

describe("TEOS-307 password rules", () => {
  it.each([
    ["Short1!a", "at least 12"],
    ["nouppercase1!xx", "upper-case"],
    ["NOLOWERCASE1!XX", "lower-case"],
    ["NoDigitsHere!!x", "digit"],
    ["NoSymbols12345x", "symbol"],
    [" Leading1!space", "start or end"],
    [`A1!${"é".repeat(40)}`, "too long"],
  ])("refuses %s", async (value, message) => {
    await expect(newPasswordSchema().validate(value)).rejects.toThrow(message);
  });

  it.each([GOOD, "With spaces 1A!", "Ünïcode-Pass1x"])("accepts %s", async (value) => {
    await expect(newPasswordSchema().validate(value)).resolves.toBe(value);
  });
});

// ---------- menu and routes ----------

describe("TEOS-307 menu and routes", () => {
  it("the account menu has Profile next to Logout", async () => {
    signInAs();
    const user = userEvent.setup();
    render(<TopNav />);

    await user.click(screen.getByRole("button"));

    expect(screen.getByText("Profile")).toBeInTheDocument();
    expect(screen.getByText("Logout")).toBeInTheDocument();
  });

  it("the Admins page and menu entry need admin.security.manage; profile needs none", () => {
    const children = privateRoutes[0].children;
    expect(children.find((r) => r.path === "/admins").permission).toBe(PERMISSIONS.SECURITY_MANAGE);
    expect(children.find((r) => r.path === "/profile").permission).toBeUndefined();
    expect(MenuRoutes.find((m) => m.uri === "admins").permission).toBe(PERMISSIONS.SECURITY_MANAGE);
    expect(publicRoutes.find((r) => r.path === "/reset-password")).toBeTruthy();
  });
});

// ---------- profile ----------

describe("TEOS-307 profile page", () => {
  it("shows the signed-in email and role", () => {
    signInAs("super_admin");
    render(<ProfilePage />);

    expect(screen.getByTestId("profile-email")).toHaveTextContent("me@example.com");
    expect(screen.getByText("Super Admin")).toBeInTheDocument();
  });

  it("opens on the Change password tab, also for an unknown ?tab", () => {
    signInAs();
    window.history.pushState({}, "", "/profile?tab=unknown");
    render(<ProfilePage />);

    expect(screen.getByRole("tab", { name: "Change password" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByRole("form", { name: "Change password" })).toBeInTheDocument();
    window.history.pushState({}, "", "/");
  });

  it("changes the password and keeps the tab signed in with the new session", async () => {
    signInAs();
    authAPI.changePassword.mockResolvedValue({
      data: {
        data: {
          access_token: "new-access",
          refresh_token: "new-refresh",
          expires_in: 3600,
          other_sessions_signed_out: true,
          user: { id: "me", email: "me@example.com", role: "admin", permissions: [] },
        },
      },
    });
    const user = userEvent.setup();
    render(<ProfilePage />);

    await fillPasswords(user, {
      "Enter your current password": "Old-Passw0rd!x",
      "Enter a new password": GOOD,
      "Enter the new password again": GOOD,
    });
    await user.click(screen.getByRole("button", { name: "Change password" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(authAPI.changePassword).toHaveBeenCalledWith({
      current_password: "Old-Passw0rd!x",
      new_password: GOOD,
    });
    const auth = store.getState().authentication;
    expect(auth.access_token).toBe("new-access");
    expect(auth.refresh_token).toBe("new-refresh");
    expect(auth.isAuthenticated).toBe(true);
  });

  it.each([
    ["short1!A", GOOD.slice(0, 8), "Password must be at least 12 characters"],
    [GOOD, "Other-Passw0rd!x", "Passwords do not match"],
  ])("yup blocks %s / %s without a request", async (newPassword, confirm, message) => {
    signInAs();
    const user = userEvent.setup();
    render(<ProfilePage />);

    await fillPasswords(user, {
      "Enter your current password": "Old-Passw0rd!x",
      "Enter a new password": newPassword,
      "Enter the new password again": confirm,
    });
    await user.click(screen.getByRole("button", { name: "Change password" }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(authAPI.changePassword).not.toHaveBeenCalled();
  });

  it("refuses a new password equal to the current one before the API", async () => {
    signInAs();
    const user = userEvent.setup();
    render(<ProfilePage />);

    await fillPasswords(user, {
      "Enter your current password": GOOD,
      "Enter a new password": GOOD,
      "Enter the new password again": GOOD,
    });
    await user.click(screen.getByRole("button", { name: "Change password" }));

    expect(
      await screen.findByText("The new password must be different from the current one")
    ).toBeInTheDocument();
    expect(authAPI.changePassword).not.toHaveBeenCalled();
  });

  it("shows a wrong current password under its field and stays signed in", async () => {
    signInAs();
    authAPI.changePassword.mockRejectedValue(
      apiError(400, {
        message: "The current password is incorrect.",
        developerMessage: "current_password_invalid",
      })
    );
    const user = userEvent.setup();
    render(<ProfilePage />);

    await fillPasswords(user, {
      "Enter your current password": "wrong",
      "Enter a new password": GOOD,
      "Enter the new password again": GOOD,
    });
    await user.click(screen.getByRole("button", { name: "Change password" }));

    expect(await screen.findByText("The current password is incorrect.")).toBeInTheDocument();
    expect(store.getState().authentication.isAuthenticated).toBe(true);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("shows a Supabase refusal (422) under the new password", async () => {
    signInAs();
    authAPI.changePassword.mockRejectedValue(
      apiError(422, { message: "This password was refused as too weak.", developerMessage: "weak_password" })
    );
    const user = userEvent.setup();
    render(<ProfilePage />);

    await fillPasswords(user, {
      "Enter your current password": "Old-Passw0rd!x",
      "Enter a new password": GOOD,
      "Enter the new password again": GOOD,
    });
    await user.click(screen.getByRole("button", { name: "Change password" }));

    expect(await screen.findByText("This password was refused as too weak.")).toBeInTheDocument();
  });

  it("a 429 is a toast", async () => {
    signInAs();
    authAPI.changePassword.mockRejectedValue(apiError(429, { message: "Too many sign-in attempts." }));
    const user = userEvent.setup();
    render(<ProfilePage />);

    await fillPasswords(user, {
      "Enter your current password": "wrong",
      "Enter a new password": GOOD,
      "Enter the new password again": GOOD,
    });
    await user.click(screen.getByRole("button", { name: "Change password" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Too many sign-in attempts."));
  });
});

// ---------- reset link page ----------

describe("TEOS-307 reset password page", () => {
  const openLink = (url) => window.history.pushState(null, "", url);

  it("reads the token from the link and removes it from the address bar", async () => {
    openLink("/reset-password#token=link-token");
    render(<ResetPasswordPage />);

    expect(screen.getByPlaceholderText("Enter a new password")).toBeInTheDocument();
    await waitFor(() => expect(window.location.hash).toBe(""));
  });

  it("an old-style link (Supabase session in the fragment) is not a reset token", () => {
    expect(readResetLink({ hash: "#access_token=a&type=recovery", search: "" }).token).toBeNull();
    expect(readResetLink({ hash: "#token=abc", search: "" }).token).toBe("abc");
  });

  it("an expired or used link shows the invalid link message", () => {
    expect(readResetLink({ hash: "#error=access_denied&error_code=otp_expired", search: "" }).token).toBeNull();
    openLink("/reset-password#error=access_denied&error_code=otp_expired");
    render(<ResetPasswordPage />);

    expect(screen.getByTestId("reset-link-error")).toHaveTextContent("invalid or has expired");
  });

  it("sets the new password and goes to sign-in with the notice", async () => {
    openLink("/reset-password#token=link-token");
    authAPI.resetPassword.mockResolvedValue({ data: { data: { sessions_signed_out: true } } });
    const user = userEvent.setup();
    render(<ResetPasswordPage />);

    await fillPasswords(user, {
      "Enter a new password": GOOD,
      "Enter the new password again": GOOD,
    });
    await user.click(screen.getByRole("button", { name: "Set new password" }));

    await waitFor(() =>
      expect(authAPI.resetPassword).toHaveBeenCalledWith({ token: "link-token", new_password: GOOD })
    );
    await waitFor(() => expect(window.location.pathname).toBe("/signin"));
    expect(window.location.search).toContain("reason=password_reset");
  });

  it("applies the same rules (no request)", async () => {
    openLink("/reset-password#token=link-token");
    const user = userEvent.setup();
    render(<ResetPasswordPage />);

    await fillPasswords(user, {
      "Enter a new password": "nouppercase1!xx",
      "Enter the new password again": "nouppercase1!xx",
    });
    await user.click(screen.getByRole("button", { name: "Set new password" }));

    expect(await screen.findByText("Password must contain an upper-case letter")).toBeInTheDocument();
    expect(authAPI.resetPassword).not.toHaveBeenCalled();
  });

  it("a 400 from the API switches to the invalid link message", async () => {
    openLink("/reset-password#token=link-token");
    authAPI.resetPassword.mockRejectedValue(
      apiError(400, { message: "This reset link is invalid or has expired. Ask a super admin to send a new one." })
    );
    const user = userEvent.setup();
    render(<ResetPasswordPage />);

    await fillPasswords(user, {
      "Enter a new password": GOOD,
      "Enter the new password again": GOOD,
    });
    await user.click(screen.getByRole("button", { name: "Set new password" }));

    expect(await screen.findByTestId("reset-link-error")).toBeInTheDocument();
  });
});

// ---------- Admins page ----------

const ADMINS = [
  { id: "me", email: "me@example.com", role: "super_admin", created_at: "2026-01-01T10:00:00Z",
    last_sign_in_at: "2026-11-01T10:00:00Z", is_current_user: true },
  { id: "a2", email: "amy@example.com", role: "admin", created_at: "2026-02-01T10:00:00Z",
    last_sign_in_at: null, is_current_user: false },
];

const listResponse = (rows = ADMINS, extra = { password_reset_available: true }) => ({
  data: {
    data: {
      data: rows,
      total_count: rows.length,
      facets: { all: 2, super_admin: 1, admin: 1 },
      ...extra,
    },
  },
});

const openActions = async (user, email) => {
  await user.click(await screen.findByRole("button", { name: `Actions for ${email}` }));
};

describe("TEOS-307 admins page", () => {
  beforeEach(() => {
    window.history.pushState(null, "", "/admins");
    signInAs("super_admin", [PERMISSIONS.SECURITY_MANAGE]);
    adminsAPI.getAdmins.mockResolvedValue(listResponse());
  });

  it("lists the admins with role tabs and counts", async () => {
    render(<AdminsPage />);

    expect(await screen.findByText("amy@example.com")).toBeInTheDocument();
    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.getByText("Never")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Super Admins (1)" })).toBeInTheDocument();
    expect(adminsAPI.getAdmins).toHaveBeenCalledWith({ page: 1, page_size: 10, role: "all", search: undefined });
  });

  it("a role tab filters through the API", async () => {
    const user = userEvent.setup();
    render(<AdminsPage />);

    await user.click(await screen.findByRole("tab", { name: "Admins (1)" }));

    await waitFor(() =>
      expect(adminsAPI.getAdmins).toHaveBeenLastCalledWith(expect.objectContaining({ role: "admin", page: 1 }))
    );
  });

  it("the own row's actions are disabled", async () => {
    const user = userEvent.setup();
    render(<AdminsPage />);

    await openActions(user, "me@example.com");

    expect(screen.getByRole("menuitem", { name: /Reset password/ })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("menuitem", { name: /Revoke access/ })).toHaveAttribute("aria-disabled", "true");
  });

  it("reset password is disabled with the reason when the API cannot email reset links", async () => {
    adminsAPI.getAdmins.mockResolvedValue(listResponse(ADMINS, { password_reset_available: false }));
    const user = userEvent.setup();
    render(<AdminsPage />);

    await openActions(user, "amy@example.com");

    const reset = screen.getByRole("menuitem", { name: /Reset password/ });
    expect(reset).toHaveAttribute("aria-disabled", "true");
    expect(reset).toHaveTextContent("Unavailable: emails aren't set up for the admin portal");
    expect(screen.getByRole("menuitem", { name: /Revoke access/ })).not.toHaveAttribute("aria-disabled", "true");
  });

  it("an older API without the flag keeps reset password enabled", async () => {
    adminsAPI.getAdmins.mockResolvedValue(listResponse(ADMINS, {}));
    const user = userEvent.setup();
    render(<AdminsPage />);

    await openActions(user, "amy@example.com");

    expect(screen.getByRole("menuitem", { name: /Reset password/ })).not.toHaveAttribute("aria-disabled", "true");
  });

  it("reset password sends the link and names the email", async () => {
    adminsAPI.sendPasswordReset.mockResolvedValue({ data: { data: { id: "a2", email: "amy@example.com" } } });
    const user = userEvent.setup();
    render(<AdminsPage />);

    await openActions(user, "amy@example.com");
    await user.click(screen.getByRole("menuitem", { name: /Reset password/ }));
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("A password reset link was sent to amy@example.com.")
    );
    expect(adminsAPI.sendPasswordReset).toHaveBeenCalledWith("a2");
  });

  it("a reset email failure shows the API message", async () => {
    adminsAPI.sendPasswordReset.mockRejectedValue(apiError(502, { message: "The reset email could not be sent." }));
    const user = userEvent.setup();
    render(<AdminsPage />);

    await openActions(user, "amy@example.com");
    await user.click(screen.getByRole("menuitem", { name: /Reset password/ }));
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("The reset email could not be sent."));
  });

  it("revoke access needs a reason of 3+ characters, then calls the API", async () => {
    adminsAPI.revokeAdminAccess.mockResolvedValue({
      data: { data: { id: "a2", email: "amy@example.com", previous_role: "admin", sessions_signed_out: true } },
    });
    const user = userEvent.setup();
    render(<AdminsPage />);

    await openActions(user, "amy@example.com");
    await user.click(screen.getByRole("menuitem", { name: /Revoke access/ }));
    const confirm = screen.getByRole("button", { name: "Revoke access" });
    await user.type(screen.getByPlaceholderText("e.g. Left the company."), "ab");
    expect(confirm).toBeDisabled();
    await user.type(screen.getByPlaceholderText("e.g. Left the company."), "c left");
    await waitFor(() => expect(confirm).toBeEnabled());
    await user.click(confirm);

    await waitFor(() =>
      expect(adminsAPI.revokeAdminAccess).toHaveBeenCalledWith({ id: "a2", reason: "abc left" })
    );
    expect(toast.success).toHaveBeenCalledWith("Admin access was removed from amy@example.com.");
  });
});
