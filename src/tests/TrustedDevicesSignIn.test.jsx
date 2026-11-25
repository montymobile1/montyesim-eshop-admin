import "@testing-library/jest-dom";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { toast } from "react-toastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { login, resendDeviceCode, verifyDevice } from "../core/apis/authAPI";
import SignInPage from "../pages/authentication/SignInPage";
import { SignOut } from "../Redux/reducers/AuthReducer";
import { store } from "../Redux/store";

/*
  TEOS-256 FE-1: the sign-in code step (contract sections 2 and 3).
  The API is mocked; the axios interceptor's error shape is rebuilt by apiError().
*/

vi.mock("../core/apis/authAPI", () => ({
  login: vi.fn(),
  verifyDevice: vi.fn(),
  resendDeviceCode: vi.fn(),
}));

vi.mock("react-toastify", async () => {
  const actual = await vi.importActual("react-toastify");
  return { ...actual, toast: { ...actual.toast, error: vi.fn() } };
});

const user = {
  id: "admin-id",
  email: "jane@monty.com",
  role: "admin",
  permissions: ["admin.users.read"],
};

const session = {
  status: "signed_in",
  access_token: "access-1",
  refresh_token: "refresh-1",
  expires_in: 3600,
  user,
  device_id: "device-1",
};

const verification = (overrides = {}) => ({
  status: "verification_required",
  verification_id: "verification-1",
  channel: "email",
  destination: "j***@m***.com",
  code_length: 6,
  expires_in: 600,
  resend_available_in: 60,
  resends_left: 3,
  ...overrides,
});

const ok = (data) => ({ status: 200, data: { status: "success", data, responseCode: 200 } });

// What the axios interceptor rejects with for a coded API error
const apiError = (status, code, extra = {}, message = `API says ${code}`) => {
  const error = new Error(message);
  error.response = {
    status,
    data: {
      status: "failed",
      message,
      developerMessage: JSON.stringify({ code, ...extra }),
      responseCode: status,
    },
  };
  return error;
};

const renderSignIn = ({ initialEntry = "/signin", direction = "ltr" } = {}) =>
  render(
    <Provider store={store}>
      <ThemeProvider theme={createTheme({ direction })}>
        <div dir={direction}>
          <MemoryRouter initialEntries={[initialEntry]}>
            <Routes>
              <Route path="/signin" element={<SignInPage />} />
              <Route path="/users" element={<div>Users landing</div>} />
            </Routes>
          </MemoryRouter>
        </div>
      </ThemeProvider>
    </Provider>
  );

const signInWithPassword = async (u = userEvent.setup()) => {
  await u.type(screen.getByPlaceholderText("you@example.com"), "jane@monty.com");
  await u.type(screen.getByPlaceholderText("Enter your password"), "secret-password");
  await u.click(screen.getByRole("button", { name: /Sign In/i }));
};

const reachCodeStep = async (overrides = {}, u = userEvent.setup()) => {
  login.mockResolvedValueOnce(ok(verification(overrides)));
  renderSignIn();
  await signInWithPassword(u);
  await screen.findByTestId("device-code-step");
  return u;
};

const codeInput = () => screen.getByLabelText("Verification code");
const verifyButton = () => screen.getByRole("button", { name: /^Verify/ });

// typing both steps with userEvent is slow on a busy machine
describe("TEOS-256 sign-in code step", { timeout: 30000 }, () => {
  beforeEach(() => {
    store.dispatch(SignOut());
    // reset, not clear: a ...Once value left by a failed test must not leak
    vi.resetAllMocks();
  });

  afterEach(() => {
    store.dispatch(SignOut());
    vi.useRealTimers();
  });

  it("case 4: a trusted device signs in straight after the password", async () => {
    login.mockResolvedValueOnce(ok(session));
    renderSignIn();
    await signInWithPassword();

    expect(await screen.findByText("Users landing")).toBeInTheDocument();
    expect(verifyDevice).not.toHaveBeenCalled();
    const auth = store.getState().authentication;
    expect(auth.isAuthenticated).toBe(true);
    expect(auth.device_id).toBe("device-1");
  });

  it("login sends the device values (same device key on every sign-in)", async () => {
    login.mockResolvedValue(ok(session));
    renderSignIn();
    await signInWithPassword();
    await screen.findByText("Users landing");

    const first = login.mock.calls[0][0].device;
    expect(first).toEqual(
      expect.objectContaining({
        device_key: expect.stringMatching(/^[0-9a-f-]{36}$/),
        browser: expect.any(String),
        os: expect.any(String),
        language: expect.any(String),
      })
    );
    expect(login.mock.calls[0][0]).toEqual(
      expect.objectContaining({ email: "jane@monty.com", password: "secret-password" })
    );
  });

  it("case 1: an untrusted device gets the code screen with the masked email", async () => {
    await reachCodeStep();

    expect(screen.getByTestId("code-destination")).toHaveTextContent("We sent a code to j***@m***.com");
    expect(screen.getByLabelText("Trust this device for 30 days")).not.toBeChecked();
    expect(screen.getByPlaceholderText("e.g. Office laptop")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Sign In/i })).not.toBeInTheDocument();
  });

  it("case 2: the right code with Trust ticked signs in and asks the API to trust the device", async () => {
    verifyDevice.mockResolvedValueOnce(ok(session));
    const u = await reachCodeStep();

    await u.click(screen.getByLabelText("Trust this device for 30 days"));
    await u.type(screen.getByPlaceholderText("e.g. Office laptop"), "  Office laptop ");
    await u.type(codeInput(), "123456");
    await u.click(verifyButton());

    expect(await screen.findByText("Users landing")).toBeInTheDocument();
    expect(verifyDevice).toHaveBeenCalledTimes(1);
    const payload = verifyDevice.mock.calls[0][0];
    expect(payload).toEqual({
      verification_id: "verification-1",
      code: "123456",
      trust_device: true,
      device_name: "Office laptop",
      device: expect.objectContaining({ device_key: login.mock.calls[0][0].device.device_key }),
    });
    expect(store.getState().authentication.access_token).toBe("access-1");
  });

  it("case 3: the right code without Trust signs in with trust_device false and no name", async () => {
    verifyDevice.mockResolvedValueOnce(ok(session));
    const u = await reachCodeStep();

    await u.type(codeInput(), "123456");
    await u.click(verifyButton());

    expect(await screen.findByText("Users landing")).toBeInTheDocument();
    const payload = verifyDevice.mock.calls[0][0];
    expect(payload.trust_device).toBe(false);
    expect(payload).not.toHaveProperty("device_name");
  });

  it("case 5: Resend is disabled during the countdown, shows the resends left, then sends", async () => {
    resendDeviceCode.mockResolvedValueOnce(
      ok({ expires_in: 600, resend_available_in: 60, resends_left: 2 })
    );
    const u = await reachCodeStep({ resend_available_in: 2 });

    const resend = screen.getByTestId("resend-code");
    expect(resend).toBeDisabled();
    expect(resend).toHaveTextContent(/Resend code in [12]s/);
    expect(screen.getByTestId("resends-left")).toHaveTextContent("3 resends left");

    await waitFor(() => expect(screen.getByTestId("resend-code")).toBeEnabled(), { timeout: 4000 });
    expect(screen.getByTestId("resend-code")).toHaveTextContent("Resend code");
    await u.click(screen.getByTestId("resend-code"));

    expect(resendDeviceCode).toHaveBeenCalledWith({ verification_id: "verification-1" });
    expect(await screen.findByText("A new code was sent.")).toBeInTheDocument();
    expect(screen.getByTestId("resends-left")).toHaveTextContent("2 resends left");
    expect(screen.getByTestId("resend-code")).toBeDisabled();
    expect(screen.getByTestId("resend-code")).toHaveTextContent("Resend code in 60s");
  });

  it("case 5: no resends left keeps Resend disabled", async () => {
    await reachCodeStep({ resend_available_in: 0, resends_left: 0 });

    expect(screen.getByTestId("resend-code")).toBeDisabled();
    expect(screen.getByTestId("resends-left")).toHaveTextContent("No resends left");
  });

  it("case 12: a wrong code shows the attempts left and clears the input", async () => {
    verifyDevice.mockRejectedValueOnce(apiError(400, "code_invalid", { attempts_left: 3 }));
    const u = await reachCodeStep();

    await u.type(codeInput(), "111111");
    await u.click(verifyButton());

    expect(await screen.findByTestId("code-step-message")).toHaveTextContent("Wrong code. 3 attempts left.");
    expect(codeInput()).toHaveValue("");
    expect(verifyButton()).toBeDisabled();
  });

  it("case 12: one attempt left is singular", async () => {
    verifyDevice.mockRejectedValueOnce(apiError(400, "code_invalid", { attempts_left: 1 }));
    const u = await reachCodeStep();
    await u.type(codeInput(), "111111");
    await u.click(verifyButton());

    expect(await screen.findByTestId("code-step-message")).toHaveTextContent("Wrong code. 1 attempt left.");
  });

  it("case 13: the 5th wrong code sends the admin back to step 1 with a message", async () => {
    verifyDevice.mockRejectedValueOnce(apiError(429, "too_many_attempts"));
    const u = await reachCodeStep();

    await u.type(codeInput(), "111111");
    await u.click(verifyButton());

    expect(await screen.findByTestId("sign-in-step-message")).toHaveTextContent(
      "Too many attempts. Sign in again."
    );
    expect(screen.queryByTestId("device-code-step")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sign In/i })).toBeInTheDocument();
    // the email is kept, so signing in again is one click
    expect(screen.getByPlaceholderText("you@example.com")).toHaveValue("jane@monty.com");
  });

  it("case 14: an expired code (410) shows 'Code expired' with a Resend option that resends the same step", async () => {
    verifyDevice.mockRejectedValueOnce(apiError(410, "verification_expired"));
    const u = await reachCodeStep();

    await u.type(codeInput(), "123456");
    await u.click(verifyButton());

    expect(await screen.findByTestId("code-step-message")).toHaveTextContent("Code expired");
    expect(verifyButton()).toBeDisabled();
    const resend = screen.getByTestId("resend-code");
    expect(resend).toBeEnabled(); // even during the 60 s countdown
    expect(resend).toHaveTextContent("Resend code");

    resendDeviceCode.mockResolvedValueOnce(ok({ expires_in: 600, resend_available_in: 60, resends_left: 2 }));
    await u.click(resend);

    await waitFor(() => expect(resendDeviceCode).toHaveBeenCalledTimes(1));
    expect(resendDeviceCode.mock.calls[0][0]).toEqual({ verification_id: "verification-1" });
    expect(login).toHaveBeenCalledTimes(1); // no new sign-in: the same step gets a new code
    expect(await screen.findByText("A new code was sent.")).toBeInTheDocument();
    expect(codeInput()).toBeEnabled();
    expect(screen.getByTestId("resends-left")).toHaveTextContent("2 resends left");

    verifyDevice.mockResolvedValueOnce(ok(session));
    await u.type(codeInput(), "654321");
    await u.click(verifyButton());
    await screen.findByText("Users landing");
    expect(verifyDevice.mock.calls[1][0].verification_id).toBe("verification-1");
  });

  it("case 15: a non-numeric or short code keeps submit disabled and sends nothing", async () => {
    const u = await reachCodeStep();

    await u.type(codeInput(), "12ab");
    expect(codeInput()).toHaveValue("12");
    expect(verifyButton()).toBeDisabled();

    await u.type(codeInput(), "345");
    expect(verifyButton()).toBeDisabled();
    fireEvent.submit(verifyButton().closest("form"));

    await u.type(codeInput(), "6");
    expect(verifyButton()).toBeEnabled();
    await waitFor(() => expect(verifyDevice).not.toHaveBeenCalled());
  });

  it("case 15: the code length comes from the API (code_length)", async () => {
    const u = await reachCodeStep({ code_length: 8 });
    expect(screen.getByText("Enter the 8-digit code")).toBeInTheDocument();
    await u.type(codeInput(), "123456");
    expect(verifyButton()).toBeDisabled();
    await u.type(codeInput(), "78");
    expect(verifyButton()).toBeEnabled();
  });

  it("case 21: pasting the full code fills it but waits for Verify, so Trust this device can be ticked", async () => {
    verifyDevice.mockResolvedValueOnce(ok(session));
    const u = await reachCodeStep();

    await u.click(codeInput());
    await u.paste("123 456");

    expect(codeInput()).toHaveValue("123456");
    expect(verifyButton()).toBeEnabled();
    expect(verifyDevice).not.toHaveBeenCalled();

    await u.click(verifyButton());
    await waitFor(() => expect(verifyDevice).toHaveBeenCalledTimes(1));
    expect(verifyDevice.mock.calls[0][0].code).toBe("123456");
    expect(await screen.findByText("Users landing")).toBeInTheDocument();
  });

  it("case 22: the code field asks for the one-time code and a numeric keypad", async () => {
    await reachCodeStep();
    const input = codeInput();
    expect(input).toHaveAttribute("autocomplete", "one-time-code");
    expect(input).toHaveAttribute("inputmode", "numeric");
    // digits only, at most code_length kept
    fireEvent.change(input, { target: { value: "12a3456789" } });
    expect(input).toHaveValue("123456");
  });

  it("case 23: the code email could not be sent at login (503)", async () => {
    login.mockRejectedValueOnce(apiError(503, "email_unavailable"));
    renderSignIn();
    await signInWithPassword();

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("We couldn't send the code. Try again later.")
    );
    expect(screen.queryByTestId("device-code-step")).not.toBeInTheDocument();
  });

  it("no SMTP on this client (503 email_not_configured) says so at login", async () => {
    login.mockRejectedValueOnce(apiError(503, "email_not_configured"));
    renderSignIn();
    await signInWithPassword();

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Sign-in codes can't be emailed: email isn't set up for the admin portal. Sign in from a trusted browser or contact your administrator."
      )
    );
    expect(screen.queryByTestId("device-code-step")).not.toBeInTheDocument();
  });

  it("no SMTP on a resend (503 email_not_configured) shows the message on the code step", async () => {
    resendDeviceCode.mockRejectedValueOnce(apiError(503, "email_not_configured"));
    const u = await reachCodeStep({ resend_available_in: 0 });

    await u.click(screen.getByTestId("resend-code"));
    expect(await screen.findByTestId("code-step-message")).toHaveTextContent(
      "Sign-in codes can't be emailed"
    );
  });

  it("case 23: a resend that could not be sent (503) shows the message on the code step", async () => {
    resendDeviceCode.mockRejectedValueOnce(apiError(503, "email_unavailable"));
    const u = await reachCodeStep({ resend_available_in: 0 });

    await u.click(screen.getByTestId("resend-code"));
    expect(await screen.findByTestId("code-step-message")).toHaveTextContent(
      "We couldn't send the code. Try again later."
    );
  });

  it("case 24: a double submit sends one request", async () => {
    let resolveVerify;
    verifyDevice.mockImplementationOnce(
      () => new Promise((resolve) => (resolveVerify = () => resolve(ok(session))))
    );
    const u = await reachCodeStep();
    await u.type(codeInput(), "123456");

    const form = verifyButton().closest("form");
    fireEvent.submit(form);
    fireEvent.submit(form);
    fireEvent.click(verifyButton());

    await waitFor(() => expect(verifyDevice).toHaveBeenCalledTimes(1));
    await act(async () => resolveVerify());
    expect(await screen.findByText("Users landing")).toBeInTheDocument();
    expect(verifyDevice).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["verification_closed", 410],
    ["device_mismatch", 400],
  ])("%s on verify → back to step 1 with the API message", async (code, status) => {
    verifyDevice.mockRejectedValueOnce(apiError(status, code));
    const u = await reachCodeStep();
    await u.type(codeInput(), "123456");
    await u.click(verifyButton());

    expect(await screen.findByTestId("sign-in-step-message")).toHaveTextContent(`API says ${code}`);
    expect(screen.queryByTestId("device-code-step")).not.toBeInTheDocument();
  });

  it("resend_limit on resend → back to step 1 with the API message", async () => {
    resendDeviceCode.mockRejectedValueOnce(apiError(429, "resend_limit"));
    const u = await reachCodeStep({ resend_available_in: 0 });
    await u.click(screen.getByTestId("resend-code"));

    expect(await screen.findByTestId("sign-in-step-message")).toHaveTextContent("API says resend_limit");
  });

  it("resend_too_soon restarts the countdown from retry_after", async () => {
    resendDeviceCode.mockRejectedValueOnce(apiError(429, "resend_too_soon", { retry_after: 42 }));
    const u = await reachCodeStep({ resend_available_in: 0 });
    await u.click(screen.getByTestId("resend-code"));

    await waitFor(() => expect(screen.getByTestId("resend-code")).toHaveTextContent(/Resend code in 4[12]s/));
    expect(screen.getByTestId("resend-code")).toBeDisabled();
  });

  it("code_limit on resend shows the API message", async () => {
    resendDeviceCode.mockRejectedValueOnce(apiError(429, "code_limit", { retry_after: 600 }, "Too many codes."));
    const u = await reachCodeStep({ resend_available_in: 0 });
    await u.click(screen.getByTestId("resend-code"));

    expect(await screen.findByTestId("code-step-message")).toHaveTextContent("Too many codes.");
  });

  it("code_limit at login shows the API message", async () => {
    login.mockRejectedValueOnce(apiError(429, "code_limit", { retry_after: 600 }, "Too many codes."));
    renderSignIn();
    await signInWithPassword();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Too many codes."));
  });

  it("code_format (422) shows a field error", async () => {
    verifyDevice.mockRejectedValueOnce(apiError(422, "code_format", { code_length: 6 }));
    const u = await reachCodeStep();
    await u.type(codeInput(), "123456");
    await u.click(verifyButton());

    expect(await screen.findByText("Enter the 6-digit code", { selector: "p" })).toBeInTheDocument();
  });

  it("'Use another account' goes back to an empty step 1", async () => {
    const u = await reachCodeStep();
    await u.click(screen.getByRole("button", { name: "Use another account" }));

    expect(screen.queryByTestId("device-code-step")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("you@example.com")).toHaveValue("");
    expect(screen.queryByTestId("sign-in-step-message")).not.toBeInTheDocument();
  });

  it("case 18: ?reason=device_revoked explains the device was signed out", () => {
    renderSignIn({ initialEntry: "/signin?next=%2Fusers&reason=device_revoked" });
    expect(screen.getByTestId("sign-out-reason")).toHaveTextContent("This device was signed out.");
  });

  it("case 25: both steps render in an RTL layout, the code itself stays left to right", async () => {
    login.mockResolvedValueOnce(ok(verification()));
    const { container } = renderSignIn({ direction: "rtl" });
    expect(container.querySelector('[dir="rtl"]')).toBeInTheDocument();
    await signInWithPassword();

    const step = await screen.findByTestId("device-code-step");
    expect(within(step).getByLabelText("Verification code")).toHaveAttribute("dir", "ltr");
    // the masked email is isolated from the surrounding text direction
    expect(step.querySelector("bdi")).toHaveTextContent("j***@m***.com");
  });
});
