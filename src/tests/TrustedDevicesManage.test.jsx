import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import { toast } from "react-toastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminDevicesDialog from "../Components/page-component/trusted-devices/AdminDevicesDialog";
import adminDialogSource from "../Components/page-component/trusted-devices/AdminDevicesDialog.jsx?raw";
import dialogsSource from "../Components/page-component/trusted-devices/DeviceDialogs.jsx?raw";
import listSource from "../Components/page-component/trusted-devices/DevicesList.jsx?raw";
import tabSource from "../Components/page-component/trusted-devices/MyDevicesTab.jsx?raw";
import { SignIn, SignOut } from "../Redux/reducers/AuthReducer";
import { store } from "../Redux/store";
import { PERMISSIONS } from "../core/vairables/Permissions";
import AdminsPage from "../pages/admins/AdminsPage";
import ProfilePage from "../pages/profile/ProfilePage";
import { Route, Routes } from "react-router-dom";
import { fireEvent, render, screen, waitFor, within } from "./utils/test-utils";

/*
  TEOS-256 (FE-2): Profile > Trusted devices and Admins page > Devices.
  The API is mocked (contract: adminDocs TEOS-255-256-api-contract.md, section 4).
*/

vi.mock("react-toastify", async () => {
  const actual = await vi.importActual("react-toastify");
  return {
    ...actual,
    toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
  };
});

vi.mock("../core/apis/trustedDevicesAPI", () => ({
  getMyDevices: vi.fn(),
  renameMyDevice: vi.fn(),
  revokeMyDevice: vi.fn(),
  revokeMyOtherDevices: vi.fn(),
  getAdminDevices: vi.fn(),
  revokeAdminDevice: vi.fn(),
}));

vi.mock("../core/apis/adminsAPI", async () => {
  const actual = await vi.importActual("../core/apis/adminsAPI");
  return { ...actual, getAdmins: vi.fn() };
});

import * as adminsAPI from "../core/apis/adminsAPI";
import * as devicesAPI from "../core/apis/trustedDevicesAPI";

const FUTURE = "2099-12-01T10:00:00Z";

const THIS_DEVICE = {
  id: "d1", name: null, browser: "Chrome", browser_version: "130.0", os: "Windows",
  os_version: "10.0", first_ip: "10.0.0.1", last_ip: "10.0.0.2",
  created_at: "2026-10-01T08:00:00Z", last_used_at: "2026-11-05T09:00:00Z",
  trusted: true, trusted_until: FUTURE, signed_in: true, current: true,
};
const LAPTOP = {
  id: "d2", name: "Home laptop", browser: "Firefox", browser_version: "131.0", os: "macOS",
  os_version: "14.5", first_ip: "10.0.0.3", last_ip: "10.0.0.4",
  created_at: "2026-09-01T08:00:00Z", last_used_at: "2026-11-01T09:00:00Z",
  trusted: false, trusted_until: null, signed_in: true, current: false,
};
const PHONE = {
  id: "d3", name: null, browser: "Safari", browser_version: "17.0", os: "iOS",
  os_version: "17.1", first_ip: "10.0.0.5", last_ip: "10.0.0.6",
  created_at: "2026-08-01T08:00:00Z", last_used_at: "2026-10-20T09:00:00Z",
  trusted: true, trusted_until: FUTURE, signed_in: true, current: false,
};

const list = (rows) => ({ data: { data: { data: rows, total_count: rows.length } } });

const apiError = (status, { message = "API message", code } = {}) =>
  Object.assign(new Error(message), {
    response: {
      status,
      data: { message, developerMessage: code ? JSON.stringify({ code }) : undefined },
    },
  });

const signInAs = (role = "admin", permissions = []) =>
  store.dispatch(
    SignIn({
      access_token: "access",
      refresh_token: "refresh",
      expires_in: 3600,
      user: { id: "me", email: "me@example.com", role, permissions },
    })
  );

const openDevicesTab = () => {
  window.history.pushState({}, "", "/profile?tab=devices");
  return render(<ProfilePage />);
};

const openRowMenu = async (user, title) => {
  await user.click(await screen.findByRole("button", { name: `Actions for ${title}` }));
};

const deviceNames = () => screen.queryAllByTestId("device-name").map((el) => el.textContent);

// MUI useMediaQuery: every query matches -> the narrow (card) layout
const useNarrowScreen = () => {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: true,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
};

const originalMatchMedia = window.matchMedia;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  window.matchMedia = originalMatchMedia;
  store.dispatch(SignOut());
  window.history.pushState({}, "", "/");
});

// ---------- Profile > Trusted devices ----------

describe("TEOS-256 Profile > Trusted devices", () => {
  beforeEach(() => {
    signInAs();
    devicesAPI.getMyDevices.mockResolvedValue(list([THIS_DEVICE, LAPTOP, PHONE]));
  });

  it("is the tab after Change password and opens from ?tab=devices", async () => {
    openDevicesTab();

    const tabs = screen.getAllByRole("tab").map((tab) => tab.textContent);
    expect(tabs).toEqual(["Change password", "Trusted devices"]);
    expect(screen.getByRole("tab", { name: "Trusted devices" })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByText("Home laptop")).toBeInTheDocument();
  });

  it("the tab is reachable from Change password and kept in the URL", async () => {
    window.history.pushState({}, "", "/profile");
    const user = userEvent.setup();
    render(<ProfilePage />);

    await user.click(screen.getByRole("tab", { name: "Trusted devices" }));

    expect(window.location.search).toBe("?tab=devices");
    expect(await screen.findByText("Home laptop")).toBeInTheDocument();
  });

  it("case 6: lists the devices with their details and \"This device\" on the current one", async () => {
    openDevicesTab();

    await screen.findByText("Home laptop");
    expect(deviceNames()).toEqual(["Chrome on Windows", "Home laptop", "Safari on iOS"]);
    // the badge only on the current row
    expect(screen.getAllByText("This device")).toHaveLength(1);
    const currentCell = screen.getAllByTestId("device-cell")[0];
    expect(within(currentCell).getByText("This device")).toBeInTheDocument();
    // a named device shows its name only (not "browser on OS" under it)
    expect(screen.queryByText("Firefox on macOS")).not.toBeInTheDocument();
    expect(screen.getByText("Chrome 130.0")).toBeInTheDocument();
    expect(screen.getByText("Windows 10.0")).toBeInTheDocument();
    expect(screen.getByText("10.0.0.2")).toBeInTheDocument();
    // Status chip, and Expires with date and hour (none for an untrusted device)
    expect(screen.getAllByText("Trusted")).toHaveLength(2);
    expect(screen.getByText("Not trusted")).toBeInTheDocument();
    const expires = screen.getAllByTestId("device-expires").map((el) => el.textContent);
    expect(expires[0]).toMatch(/^01-12-2099 [0-9]{2}:[0-9]{2}$/);
    expect(expires[1]).toBe("N/A");
    expect(expires[2]).toMatch(/^01-12-2099 [0-9]{2}:[0-9]{2}$/);
    for (const header of ["Device", "Browser", "System", "Last IP", "Last used", "First seen", "Status", "Expires"]) {
      expect(screen.getByRole("columnheader", { name: header })).toBeInTheDocument();
    }
  });

  it("shows the empty state", async () => {
    devicesAPI.getMyDevices.mockResolvedValue(list([]));
    openDevicesTab();

    expect(await screen.findByText("No devices found")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out all other devices" })).toBeDisabled();
  });

  it("shows the loading state while the list loads", () => {
    devicesAPI.getMyDevices.mockReturnValue(new Promise(() => {}));
    const { container } = openDevicesTab();

    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out all other devices" })).toBeDisabled();
  });

  it("shows the error state with Retry", async () => {
    devicesAPI.getMyDevices.mockRejectedValueOnce(apiError(500, { message: "Server error" }));
    const user = userEvent.setup();
    openDevicesTab();

    expect(await screen.findByText("Server error")).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith("Fail to display data");

    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Home laptop")).toBeInTheDocument();
  });

  it("a 403 on the list has no extra toast (axios shows the API message)", async () => {
    devicesAPI.getMyDevices.mockRejectedValue(
      Object.assign(apiError(403, { message: "Not allowed" }), { isForbidden: true })
    );
    openDevicesTab();

    expect(await screen.findByText("Not allowed")).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("case 7: rename updates the row in place", async () => {
    let release;
    devicesAPI.renameMyDevice.mockResolvedValue({ data: { data: { ...PHONE, name: "Work phone" } } });
    const user = userEvent.setup();
    openDevicesTab();

    await openRowMenu(user, "Safari on iOS");
    expect(screen.getByRole("menuitem", { name: /Give this device a name you'll recognise/ })).toBeInTheDocument();
    // the refetch after the rename is held, so the row shown comes from the PATCH answer
    devicesAPI.getMyDevices.mockReturnValue(new Promise((ok) => (release = ok)));
    await user.click(screen.getByRole("menuitem", { name: /Rename/ }));
    await user.type(screen.getByLabelText("Device name"), "  Work   phone ");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(devicesAPI.renameMyDevice).toHaveBeenCalledWith({ id: "d3", name: "Work phone" })
    );
    expect(await screen.findByText("Work phone")).toBeInTheDocument();
    expect(deviceNames()).toEqual(["Chrome on Windows", "Home laptop", "Work phone"]);
    expect(screen.queryByRole("form", { name: "Rename device" })).not.toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith("The device was renamed.");
    release(list([THIS_DEVICE, LAPTOP, { ...PHONE, name: "Work phone" }]));
  });

  it("rename needs 1 to 60 characters (no request otherwise)", async () => {
    const user = userEvent.setup();
    openDevicesTab();

    await openRowMenu(user, "Home laptop");
    await user.click(screen.getByRole("menuitem", { name: /Rename/ }));
    const input = screen.getByLabelText("Device name");
    expect(input).toHaveValue("Home laptop");

    await user.clear(input);
    await user.type(input, "   ");
    expect(await screen.findByText("Enter a name")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();

    await user.clear(input);
    await user.paste("x".repeat(61));
    expect(await screen.findByText("At most 60 characters")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();

    await user.clear(input);
    await user.paste("x".repeat(60));
    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toBeEnabled());
    expect(devicesAPI.renameMyDevice).not.toHaveBeenCalled();
  });

  it("case 8: revoking another device asks to confirm, then its row disappears", async () => {
    devicesAPI.revokeMyDevice.mockResolvedValue({ status: 204 });
    const user = userEvent.setup();
    openDevicesTab();

    await openRowMenu(user, "Home laptop");
    await user.click(screen.getByRole("menuitem", { name: /Revoke/ }));
    expect(screen.getByText(/"Home laptop" will be signed out/)).toBeInTheDocument();
    devicesAPI.getMyDevices.mockResolvedValue(list([THIS_DEVICE, PHONE]));
    await user.click(screen.getByRole("button", { name: "Revoke" }));

    await waitFor(() => expect(screen.queryByText("Home laptop")).not.toBeInTheDocument());
    expect(devicesAPI.revokeMyDevice).toHaveBeenCalledTimes(1);
    expect(devicesAPI.revokeMyDevice).toHaveBeenCalledWith("d2");
    expect(toast.success).toHaveBeenCalledWith('"Home laptop" was signed out.');
    expect(store.getState().authentication.isAuthenticated).toBe(true);
  });

  it("cancel closes the revoke dialog without a request", async () => {
    const user = userEvent.setup();
    openDevicesTab();

    await openRowMenu(user, "Home laptop");
    await user.click(screen.getByRole("menuitem", { name: /Revoke/ }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByText(/will be signed out/)).not.toBeInTheDocument();
    expect(devicesAPI.revokeMyDevice).not.toHaveBeenCalled();
  });

  it("case 20: revoking \"This device\" asks a stronger confirmation, then signs out", async () => {
    let finish;
    devicesAPI.revokeMyDevice.mockReturnValue(new Promise((ok) => (finish = ok)));
    const user = userEvent.setup();
    openDevicesTab();

    await openRowMenu(user, "Chrome on Windows");
    await user.click(screen.getByRole("menuitem", { name: /Revoke/ }));
    expect(screen.getByRole("heading", { name: "Sign Out This Device" })).toBeInTheDocument();
    expect(screen.getByText(/is the device you are using now. You will be signed out/)).toBeInTheDocument();

    // a double click sends one request
    const confirm = screen.getByRole("button", { name: "Sign me out" });
    await user.click(confirm);
    expect(screen.getByRole("button", { name: "Signing out..." })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Signing out..." }));
    expect(devicesAPI.revokeMyDevice).toHaveBeenCalledTimes(1);
    expect(devicesAPI.revokeMyDevice).toHaveBeenCalledWith("d1");

    finish({ status: 204 });
    await waitFor(() => expect(window.location.pathname).toBe("/signin"));
    expect(store.getState().authentication.isAuthenticated).toBe(false);
    expect(store.getState().authentication.access_token).toBeFalsy();
    expect(toast.success).toHaveBeenCalledWith("This device was signed out.");
  });

  it("case 9: \"Sign out all other devices\" confirms, shows the count and leaves only this device", async () => {
    devicesAPI.revokeMyOtherDevices.mockResolvedValue({ data: { data: { revoked: 2 } } });
    const user = userEvent.setup();
    openDevicesTab();

    await screen.findByText("Home laptop");
    await user.click(screen.getByRole("button", { name: "Sign out all other devices" }));
    expect(screen.getByText(/Every device except this one will be signed out/)).toBeInTheDocument();
    devicesAPI.getMyDevices.mockResolvedValue(list([THIS_DEVICE]));
    await user.click(screen.getByRole("button", { name: "Sign out others" }));

    await waitFor(() => expect(deviceNames()).toEqual(["Chrome on Windows"]));
    expect(devicesAPI.revokeMyOtherDevices).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith("Signed out 2 other devices.");
    expect(screen.getByRole("button", { name: "Sign out all other devices" })).toBeDisabled();
    expect(store.getState().authentication.isAuthenticated).toBe(true);
  });

  it("\"Sign out all other devices\" is disabled when this is the only device, and its tooltip says why", async () => {
    devicesAPI.getMyDevices.mockResolvedValue(list([THIS_DEVICE]));
    const user = userEvent.setup();
    openDevicesTab();

    await screen.findByText("Chrome on Windows");
    const button = screen.getByRole("button", { name: "Sign out all other devices" });
    expect(button).toBeDisabled();
    await user.hover(button.parentElement);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "No other device is signed in: this is the only one."
    );
  });

  it("404 device_not_found: toast, dialog closed and list refreshed", async () => {
    devicesAPI.revokeMyDevice.mockRejectedValue(apiError(404, { code: "device_not_found" }));
    const user = userEvent.setup();
    openDevicesTab();

    await openRowMenu(user, "Home laptop");
    await user.click(screen.getByRole("menuitem", { name: /Revoke/ }));
    devicesAPI.getMyDevices.mockResolvedValue(list([THIS_DEVICE, PHONE]));
    await user.click(screen.getByRole("button", { name: "Revoke" }));

    await waitFor(() =>
      expect(toast.info).toHaveBeenCalledWith("This device was already signed out. The list was refreshed.")
    );
    await waitFor(() => expect(screen.queryByText("Home laptop")).not.toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Revoke" })).not.toBeInTheDocument();
  });

  it("another error shows the API message and keeps the dialog open", async () => {
    devicesAPI.renameMyDevice.mockRejectedValue(apiError(500, { message: "Something broke" }));
    const user = userEvent.setup();
    openDevicesTab();

    await openRowMenu(user, "Home laptop");
    await user.click(screen.getByRole("menuitem", { name: /Rename/ }));
    await user.type(screen.getByLabelText("Device name"), " 2");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Something broke"));
    expect(screen.getByRole("form", { name: "Rename device" })).toBeInTheDocument();
    expect(store.getState().authentication.isAuthenticated).toBe(true);
  });

  it("a failed revoke of this device does not sign out", async () => {
    devicesAPI.revokeMyDevice.mockRejectedValue(apiError(502, { message: "Auth service unavailable" }));
    const user = userEvent.setup();
    openDevicesTab();

    await openRowMenu(user, "Chrome on Windows");
    await user.click(screen.getByRole("menuitem", { name: /Revoke/ }));
    await user.click(screen.getByRole("button", { name: "Sign me out" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Auth service unavailable"));
    expect(store.getState().authentication.isAuthenticated).toBe(true);
  });
});

// ---------- case 26: shared ⋯ menu, table and card views ----------

describe("TEOS-256 case 26: the same labelled ⋯ menu in table and card views", () => {
  beforeEach(() => {
    signInAs();
    devicesAPI.getMyDevices.mockResolvedValue(list([THIS_DEVICE, LAPTOP]));
  });

  const menuEntries = () =>
    screen.getAllByRole("menuitem").map((item) => item.textContent);

  it("table view (wide screen)", async () => {
    const user = userEvent.setup();
    openDevicesTab();

    await screen.findByText("Home laptop");
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.queryAllByTestId("device-card")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Actions for Home laptop" })).toHaveAttribute("aria-haspopup", "menu");
    await openRowMenu(user, "Home laptop");
    expect(menuEntries()).toEqual([
      "RenameGive this device a name you'll recognise",
      "RevokeSign this device out and require a code next time",
    ]);
  });

  it("card view (narrow screen)", async () => {
    useNarrowScreen();
    const user = userEvent.setup();
    openDevicesTab();

    await waitFor(() => expect(screen.getAllByTestId("device-card")).toHaveLength(2));
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    const current = screen.getAllByTestId("device-card")[0];
    expect(current).toHaveAttribute("aria-current", "true");
    expect(within(current).getByText("This device")).toBeInTheDocument();
    expect(within(current).getByText("Trusted")).toBeInTheDocument();
    expect(within(current).getByText(/^01-12-2099 [0-9]{2}:[0-9]{2}$/)).toBeInTheDocument();
    await openRowMenu(user, "Home laptop");
    expect(menuEntries()).toEqual([
      "RenameGive this device a name you'll recognise",
      "RevokeSign this device out and require a code next time",
    ]);
  });
});

// ---------- case 25: RTL ----------

describe("TEOS-256 case 25: right-to-left layout", () => {
  it("device names follow their own direction (dir=auto) inside an RTL page", async () => {
    signInAs();
    devicesAPI.getMyDevices.mockResolvedValue(list([{ ...LAPTOP, name: "حاسوب المنزل" }]));
    document.documentElement.setAttribute("dir", "rtl");
    try {
      openDevicesTab();
      const name = await screen.findByText("حاسوب المنزل");
      expect(name).toHaveAttribute("dir", "auto");
    } finally {
      document.documentElement.removeAttribute("dir");
    }
  });

  it("the devices components use no hard-coded left/right", () => {
    const sources = {
      "DevicesList.jsx": listSource,
      "DeviceDialogs.jsx": dialogsSource,
      "MyDevicesTab.jsx": tabSource,
      "AdminDevicesDialog.jsx": adminDialogSource,
    };
    for (const [file, source] of Object.entries(sources)) {
      expect(source.length, file).toBeGreaterThan(100);
      expect(source, file).not.toMatch(/\b(left|right)\s*:/);
      expect(source, file).not.toMatch(/align=\{?["']?(left|right)/);
      expect(source, file).not.toMatch(/\b(ml|mr|pl|pr|left|right)-\[?\d/);
      expect(source, file).not.toMatch(/text-(left|right)\b/);
    }
  });
});

// ---------- Admins page > Devices ----------

const ADMINS = [
  { id: "me", email: "me@example.com", role: "super_admin", created_at: "2026-01-01T10:00:00Z",
    last_sign_in_at: "2026-11-01T10:00:00Z", is_current_user: true },
  { id: "a2", email: "amy@example.com", role: "admin", created_at: "2026-02-01T10:00:00Z",
    last_sign_in_at: null, is_current_user: false },
];

const adminsResponse = {
  data: { data: { data: ADMINS, total_count: 2, facets: { all: 2, super_admin: 1, admin: 1 } } },
};

const AMY_LAPTOP = { ...LAPTOP, id: "x1", current: false };
const AMY_PHONE = { ...PHONE, id: "x2", current: false };

describe("TEOS-256 Admins page > Devices", () => {
  beforeEach(() => {
    window.history.pushState(null, "", "/admins");
    signInAs("super_admin", [PERMISSIONS.SECURITY_MANAGE]);
    adminsAPI.getAdmins.mockResolvedValue(adminsResponse);
    devicesAPI.getAdminDevices.mockResolvedValue(list([AMY_LAPTOP, AMY_PHONE]));
  });

  const openAmyDevices = async (user) => {
    await openRowMenu(user, "amy@example.com");
    await user.click(screen.getByRole("menuitem", { name: /Devices/ }));
    return screen.findByRole("dialog", { name: /Devices/ });
  };

  it("case 11: a super admin revokes another admin's device", async () => {
    devicesAPI.revokeAdminDevice.mockResolvedValue({ status: 204 });
    const user = userEvent.setup();
    render(<AdminsPage />);

    const dialog = await openAmyDevices(user);
    expect(within(dialog).getByText("amy@example.com")).toBeInTheDocument();
    expect(await within(dialog).findByText("Home laptop")).toBeInTheDocument();
    expect(devicesAPI.getAdminDevices).toHaveBeenCalledWith("a2");
    expect(within(dialog).queryByText("This device")).not.toBeInTheDocument();

    // read-only except Revoke
    await openRowMenu(user, "Home laptop");
    expect(screen.getAllByRole("menuitem").map((i) => i.textContent)).toEqual([
      "RevokeSign this device out and require a code next time",
    ]);
    await user.click(screen.getByRole("menuitem", { name: /Revoke/ }));
    expect(screen.getByText(/"Home laptop" of amy@example.com will be signed out/)).toBeInTheDocument();
    devicesAPI.getAdminDevices.mockResolvedValue(list([AMY_PHONE]));
    await user.click(screen.getByRole("button", { name: "Revoke" }));

    await waitFor(() => expect(within(dialog).queryByText("Home laptop")).not.toBeInTheDocument());
    expect(devicesAPI.revokeAdminDevice).toHaveBeenCalledWith({ adminId: "a2", deviceId: "x1" });
    expect(toast.success).toHaveBeenCalledWith('"Home laptop" of amy@example.com was signed out.');
    expect(within(dialog).getByText("Safari on iOS")).toBeInTheDocument();
    expect(store.getState().authentication.isAuthenticated).toBe(true);
  });

  it("the own row's Devices opens Profile > Trusted devices", async () => {
    const user = userEvent.setup();
    render(
      <Routes>
        <Route path="/admins" element={<AdminsPage />} />
        <Route path="/profile" element={<p>profile page</p>} />
      </Routes>
    );

    await openRowMenu(user, "me@example.com");
    const item = screen.getByRole("menuitem", { name: /Devices/ });
    expect(item).toHaveTextContent("Your devices are on your Profile page");
    await user.click(item);

    expect(window.location.pathname).toBe("/profile");
    expect(window.location.search).toBe("?tab=devices");
    expect(await screen.findByText("profile page")).toBeInTheDocument();
    expect(devicesAPI.getAdminDevices).not.toHaveBeenCalled();
  });

  it("an admin without devices shows the empty state", async () => {
    devicesAPI.getAdminDevices.mockResolvedValue(list([]));
    const user = userEvent.setup();
    render(<AdminsPage />);

    const dialog = await openAmyDevices(user);
    expect(await within(dialog).findByText("This admin has no signed-in devices")).toBeInTheDocument();
  });

  it("an account that is no longer an admin (404) shows a message", async () => {
    devicesAPI.getAdminDevices.mockRejectedValue(apiError(404, { message: "Not found" }));
    const user = userEvent.setup();
    render(<AdminsPage />);

    const dialog = await openAmyDevices(user);
    expect(await within(dialog).findByText("This account is no longer an admin.")).toBeInTheDocument();
  });

  it("404 device_not_found on revoke: toast and the list is refreshed", async () => {
    devicesAPI.revokeAdminDevice.mockRejectedValue(apiError(404, { code: "device_not_found" }));
    const user = userEvent.setup();
    render(<AdminsPage />);

    const dialog = await openAmyDevices(user);
    await within(dialog).findByText("Home laptop");
    await openRowMenu(user, "Home laptop");
    await user.click(screen.getByRole("menuitem", { name: /Revoke/ }));
    devicesAPI.getAdminDevices.mockResolvedValue(list([AMY_PHONE]));
    await user.click(screen.getByRole("button", { name: "Revoke" }));

    await waitFor(() =>
      expect(toast.info).toHaveBeenCalledWith("This device was already signed out. The list was refreshed.")
    );
    await waitFor(() => expect(within(dialog).queryByText("Home laptop")).not.toBeInTheDocument());
  });

  it("another revoke error shows the API message", async () => {
    devicesAPI.revokeAdminDevice.mockRejectedValue(apiError(502, { message: "Auth service unavailable" }));
    const user = userEvent.setup();
    render(<AdminsPage />);

    const dialog = await openAmyDevices(user);
    await within(dialog).findByText("Home laptop");
    await openRowMenu(user, "Home laptop");
    await user.click(screen.getByRole("menuitem", { name: /Revoke/ }));
    await user.click(screen.getByRole("button", { name: "Revoke" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Auth service unavailable"));
    expect(screen.getByRole("button", { name: "Revoke" })).toBeInTheDocument();
  });
});

describe("TEOS-256 case 19: without admin.security.manage", () => {
  it("the Admins page draws no Devices action", async () => {
    window.history.pushState(null, "", "/admins");
    signInAs("admin", []);
    adminsAPI.getAdmins.mockResolvedValue(adminsResponse);
    const user = userEvent.setup();
    render(<AdminsPage />);

    await openRowMenu(user, "amy@example.com");
    expect(screen.queryByRole("menuitem", { name: /Devices/ })).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Reset password/ })).toBeInTheDocument();
  });

  it("the per-admin Devices view is not drawn and asks nothing", () => {
    signInAs("admin", []);
    render(<AdminDevicesDialog admin={ADMINS[1]} onClose={() => {}} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(devicesAPI.getAdminDevices).not.toHaveBeenCalled();
  });
});
