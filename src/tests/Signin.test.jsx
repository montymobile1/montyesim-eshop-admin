import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { toast } from "react-toastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { login } from "../core/apis/authAPI";
import SignInPage from "../pages/authentication/SignInPage";
import { SignOut } from "../Redux/reducers/AuthReducer";
import { store } from "../Redux/store";

vi.mock("../core/apis/authAPI", () => ({
  login: vi.fn(),
}));

vi.mock("react-toastify", async () => {
  const actual = await vi.importActual("react-toastify");
  return { ...actual, toast: { ...actual.toast, error: vi.fn() } };
});

const loginData = {
  access_token: "access-1",
  refresh_token: "refresh-1",
  expires_in: 3600,
  user: {
    id: "admin-id",
    email: "admin@example.com",
    role: "admin",
    permissions: ["admin.users.read", "admin.orders.read"],
  },
};

const loginSuccess = {
  status: 200,
  data: { status: "success", data: loginData, responseCode: 200 },
};

const renderSignIn = (initialEntry = "/signin") =>
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/signin" element={<SignInPage />} />
          <Route path="/users" element={<div>Users landing</div>} />
          <Route path="/orders" element={<div>Orders landing</div>} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );

const fillAndSubmit = async () => {
  const user = userEvent.setup();
  await user.type(
    screen.getByPlaceholderText("you@example.com"),
    "admin@example.com"
  );
  await user.type(
    screen.getByPlaceholderText("Enter your password"),
    "secret-password"
  );
  await user.click(screen.getByRole("button", { name: /Sign In/i }));
};

describe("SignInPage", () => {
  beforeEach(() => {
    store.dispatch(SignOut());
    vi.clearAllMocks();
  });

  afterEach(() => {
    store.dispatch(SignOut());
  });

  it("renders the login form", () => {
    renderSignIn();

    expect(
      screen.getByRole("button", { name: /Sign In/i })
    ).toBeInTheDocument();
  });

  it("explains why the session ended when ?reason= is set (TEOS-145)", () => {
    renderSignIn("/signin?next=%2Fdevices&reason=access_removed");

    expect(screen.getByTestId("sign-out-reason")).toHaveTextContent(
      "Admin access was removed from this account."
    );
  });

  it("the reason goes away once the admin types the email, and ?next= is kept", async () => {
    login.mockResolvedValue(loginSuccess);
    renderSignIn("/signin?next=%2Forders&reason=access_removed");
    expect(screen.getByTestId("sign-out-reason")).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText("you@example.com"), "a");

    expect(screen.queryByTestId("sign-out-reason")).not.toBeInTheDocument();
    await fillAndSubmit();
    expect(await screen.findByText("Orders landing")).toBeInTheDocument();
  });

  it("shows no reason for a plain sign-in or an unknown reason", () => {
    renderSignIn("/signin?reason=whatever");

    expect(screen.queryByTestId("sign-out-reason")).not.toBeInTheDocument();
  });

  it("signs in through the admin API, stores the session and navigates", async () => {
    login.mockResolvedValue(loginSuccess);

    renderSignIn();
    await fillAndSubmit();

    expect(login).toHaveBeenCalledWith({
      email: "admin@example.com",
      password: "secret-password",
    });
    expect(await screen.findByText("Users landing")).toBeInTheDocument();

    const auth = store.getState().authentication;
    expect(auth.isAuthenticated).toBe(true);
    expect(auth.access_token).toBe("access-1");
    expect(auth.refresh_token).toBe("refresh-1");
    expect(auth.expires_at).toBeGreaterThan(Date.now());
    expect(auth.user_info).toEqual(loginData.user);
  });

  it("navigates to the ?next= path after signing in", async () => {
    login.mockResolvedValue(loginSuccess);

    renderSignIn(`/signin?next=${encodeURIComponent("/orders")}`);
    await fillAndSubmit();

    expect(await screen.findByText("Orders landing")).toBeInTheDocument();
  });

  it.each(["admin@@qa.com", "admin@", "admin@qa", "not-an-email"])(
    "shows a field error and does not call the API for a malformed email (%s)",
    async (email) => {
      const user = userEvent.setup();
      renderSignIn();
      await user.type(screen.getByPlaceholderText("you@example.com"), email);
      await user.type(
        screen.getByPlaceholderText("Enter your password"),
        "secret-password"
      );
      await user.click(screen.getByRole("button", { name: /Sign In/i }));

      expect(
        await screen.findByText("Enter a valid email address")
      ).toBeInTheDocument();
      expect(login).not.toHaveBeenCalled();
    }
  );

  it("shows the API message in a toast when the credentials are wrong (401)", async () => {
    // What the axios interceptor rejects with: message taken from the envelope
    const error = new Error("Invalid email or password");
    error.response = {
      status: 401,
      data: {
        status: "failed",
        message: "Invalid email or password",
        developerMessage: "ADMIN_LOGIN_FAILED",
        responseCode: 401,
      },
    };
    login.mockRejectedValue(error);

    renderSignIn();
    await fillAndSubmit();

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Invalid email or password")
    );
    expect(store.getState().authentication.isAuthenticated).toBe(false);
    expect(screen.queryByText("Users landing")).not.toBeInTheDocument();
  });
});
