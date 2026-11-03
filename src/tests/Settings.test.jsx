import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import { toast } from "react-toastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getUsersLookup } from "../core/apis/lookupsAPI";
import {
  getAllSettings,
  getSettingsHistory,
  updateSettings,
} from "../core/apis/settingsAPI";
import { PERMISSIONS } from "../core/vairables/Permissions";
import EditSettings, { buildSettingsPayload } from "../pages/settings/EditSettings";
import Settings from "../pages/settings/Settings";
import SettingsLogs from "../pages/settings/SettingsLogs";
import SettingsLogsDetail from "../pages/settings/SettingsLogsDetail";
import { SignIn, SignOut } from "../Redux/reducers/AuthReducer";
import { store } from "../Redux/store";
import { fireEvent, render, screen, waitFor } from "./utils/test-utils";

vi.mock("../core/apis/settingsAPI", () => ({
  getAllSettings: vi.fn(),
  updateSettings: vi.fn(),
  getSettingsHistory: vi.fn(),
  getSettingsHistoryById: vi.fn(),
}));

vi.mock("../core/apis/lookupsAPI", () => ({
  getUsersLookup: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

const listResponse = (rows, total = rows.length) => ({
  data: { data: { data: rows, total_count: total } },
});

const signInWith = (permissions) =>
  store.dispatch(
    SignIn({
      access_token: "token",
      refresh_token: "refresh",
      expires_in: 3600,
      user: { id: "id", email: "boss@example.com", role: "super_admin", permissions },
    })
  );

const SUPER = [PERMISSIONS.SETTINGS_READ, PERMISSIONS.SETTINGS_WRITE];

const row = (id, key, value, extra = {}) => ({
  id,
  key,
  value,
  description: null,
  created_at: "2026-10-01T10:00:00Z",
  is_secret: false,
  editable: true,
  deletable: true,
  ...extra,
});

const SETTINGS = [
  row(1, "OTP_EXPIRATION_TIME", "5", { deletable: false, description: "OTP lifetime in minutes" }),
  row(2, "APP_CACHE_KEY", "uuid-1", { editable: false, deletable: false }),
  row(3, "MY_FLAG", "on"),
  row(4, "SUPPORT_EMAIL", "a@x.com", { deletable: false }),
];

const conflict = (code) => {
  const error = new Error("Conflict");
  error.response = { status: 409, data: { developerMessage: JSON.stringify({ code }) } };
  return error;
};

beforeEach(() => {
  vi.clearAllMocks();
  window.history.pushState({}, "", "/settings");
  signInWith(SUPER);
  getAllSettings.mockResolvedValue(listResponse(SETTINGS, 4));
  getSettingsHistory.mockResolvedValue(listResponse([]));
  getUsersLookup.mockResolvedValue(listResponse([]));
});

afterEach(() => {
  store.dispatch(SignOut());
});

describe("Settings list", () => {
  it("lists keys, values and descriptions on page 1, read-only keys marked", async () => {
    render(<Settings />);

    expect(await screen.findByText("OTP_EXPIRATION_TIME")).toBeInTheDocument();
    expect(getAllSettings).toHaveBeenCalledWith({ page: 1, page_size: 10 });
    expect(screen.getByText("OTP lifetime in minutes")).toBeInTheDocument();
    expect(screen.getAllByText("Read only")).toHaveLength(1);
  });

  it("search by part of the key is sent on Apply and starts on page 1", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/settings?page=2");
    render(<Settings />);
    await screen.findByText("OTP_EXPIRATION_TIME");
    const calls = getAllSettings.mock.calls.length;

    await user.type(screen.getByPlaceholderText("Search by key"), "otp");
    // typing alone sends nothing
    expect(getAllSettings.mock.calls.length).toBe(calls);

    await user.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() =>
      expect(getAllSettings).toHaveBeenLastCalledWith({ page: 1, page_size: 10, search: "otp" })
    );
  });

  it("Clear filters empties the search and reloads every key from page 1", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/settings?search=otp&page=2");
    render(<Settings />);
    await screen.findByText("OTP_EXPIRATION_TIME");

    await user.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(screen.getByPlaceholderText("Search by key")).toHaveValue("");
    await waitFor(() =>
      expect(getAllSettings).toHaveBeenLastCalledWith({ page: 1, page_size: 10 })
    );
  });

  it("empty settings show No settings", async () => {
    getAllSettings.mockResolvedValue(listResponse([], 0));
    render(<Settings />);
    expect(await screen.findByText("No settings")).toBeInTheDocument();
  });

  it("hides the edit button without admin.settings.write", async () => {
    signInWith([PERMISSIONS.SETTINGS_READ]);
    const { container } = render(<Settings />);
    await screen.findByText("OTP_EXPIRATION_TIME");

    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View logs" })).toBeInTheDocument();
    // page actions live above the table, not in its header
    expect(container.querySelector("thead").querySelectorAll("button").length).toBe(0);
  });

  it("shows Edit and View logs above the table with admin.settings.write", async () => {
    const user = userEvent.setup();
    render(<Settings />);
    await screen.findByText("OTP_EXPIRATION_TIME");

    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(mockNavigate).toHaveBeenCalledWith("/settings/edit");

    await user.click(screen.getByRole("button", { name: "View logs" }));
    expect(mockNavigate).toHaveBeenCalledWith("/settings/logs");
  });
});

describe("buildSettingsPayload", () => {
  it("sends changed and new rows, never the read-only cache key", () => {
    const form = [
      { key: "NEW_FLAG", value: " on " },
      { ...SETTINGS[0], value: "7" },
      { ...SETTINGS[1], value: "changed-by-hand" },
      SETTINGS[2],
      SETTINGS[3],
    ];
    const { payload, formIndexes } = buildSettingsPayload(form, SETTINGS, ["OLD", "APP_CACHE_KEY"]);

    expect(payload).toEqual({
      items: [
        { key: "NEW_FLAG", value: "on" },
        { key: "OTP_EXPIRATION_TIME", value: "7" },
      ],
      deleted_keys: ["OLD"],
    });
    expect(formIndexes).toEqual([0, 1]);
  });
});

const editValue = async (user, from, to) => {
  const input = await screen.findByDisplayValue(from);
  await user.clear(input);
  await user.type(input, to);
};

const submitAndConfirm = async (user) => {
  await user.click(screen.getByRole("button", { name: "Submit" }));
  await user.click(await screen.findByRole("button", { name: "Confirm" }));
};

describe("Edit settings", () => {
  it("loads all rows and sends only the changed value in one PUT", async () => {
    const user = userEvent.setup();
    updateSettings.mockResolvedValue({ data: { data: { updated: ["OTP_EXPIRATION_TIME"] } } });
    const success = vi.spyOn(toast, "success");
    render(<EditSettings />);

    await editValue(user, "5", "7");
    await submitAndConfirm(user);

    await waitFor(() => expect(updateSettings).toHaveBeenCalledTimes(1));
    expect(getAllSettings).toHaveBeenCalledWith({ page: 1, page_size: 100 });
    expect(updateSettings).toHaveBeenCalledWith({
      items: [{ key: "OTP_EXPIRATION_TIME", value: "7" }],
      deleted_keys: [],
    });
    await waitFor(() => expect(success).toHaveBeenCalled());
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it("a removed row is sent in deleted_keys", async () => {
    const user = userEvent.setup();
    updateSettings.mockResolvedValue({ data: { data: {} } });
    render(<EditSettings />);
    await screen.findByDisplayValue("a@x.com");

    const removeButtons = screen.getAllByRole("button", { name: "remove setting" });
    await user.click(removeButtons[2]);
    await submitAndConfirm(user);

    await waitFor(() =>
      expect(updateSettings).toHaveBeenCalledWith({ items: [], deleted_keys: ["MY_FLAG"] })
    );
  });

  it("non-editable keys are read only; protected keys cannot be removed", async () => {
    render(<EditSettings />);

    const cacheValue = await screen.findByDisplayValue("uuid-1");
    expect(cacheValue).toBeDisabled();
    expect(screen.getByDisplayValue("5")).not.toBeDisabled();
    const removeButtons = screen.getAllByRole("button", { name: "remove setting" });
    expect(removeButtons[0]).toBeDisabled(); // OTP_EXPIRATION_TIME: protected
    expect(removeButtons[1]).toBeDisabled(); // APP_CACHE_KEY
    expect(removeButtons[2]).not.toBeDisabled(); // MY_FLAG
    expect(removeButtons[3]).toBeDisabled(); // SUPPORT_EMAIL: protected
  });

  it("409 no_change shows an info toast and keeps the form", async () => {
    const user = userEvent.setup();
    updateSettings.mockRejectedValue(conflict("no_change"));
    const info = vi.spyOn(toast, "info");
    render(<EditSettings />);

    await editValue(user, "5", "6");
    await submitAndConfirm(user);

    await waitFor(() => expect(info).toHaveBeenCalled());
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue("6")).toBeInTheDocument();
  });

  it("422 on a key puts the error on that row", async () => {
    const user = userEvent.setup();
    const error = new Error("Validation failed");
    error.response = {
      status: 422,
      data: { developerMessage: "Value error, items.0.key: secret_key, secrets are set in the environment" },
    };
    updateSettings.mockRejectedValue(error);
    render(<EditSettings />);

    await editValue(user, "5", "9");
    await submitAndConfirm(user);

    expect(await screen.findByText(/secret_key, secrets are set in the environment/)).toBeInTheDocument();
  });

  it("nothing changed: Submit is disabled and no request is sent", async () => {
    render(<EditSettings />);
    await screen.findByDisplayValue("5");

    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it("leaving with unsaved changes asks for confirmation", async () => {
    const user = userEvent.setup();
    render(<EditSettings />);

    await editValue(user, "5", "8");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(await screen.findByText(/Leave without saving/)).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  // TEOS-221: the header Back arrow (data-leave-target, as in AuthLayout) and a sidebar link
  const renderEditWithNav = () => {
    window.history.pushState({}, "", "/settings/edit");
    return render(
      <>
        <button type="button" aria-label="Back" data-leave-target="/settings" />
        <a href="/users">Users sidebar</a>
        <EditSettings />
      </>
    );
  };

  it("the header Back arrow asks first when a value changed (TEOS-221)", async () => {
    const user = userEvent.setup();
    renderEditWithNav();

    await editValue(user, "5", "8");
    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(await screen.findByText(/Leave without saving/)).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Leave" }));
    expect(mockNavigate).toHaveBeenCalledWith("/settings");
  });

  it("a sidebar link asks first when a value changed (TEOS-221)", async () => {
    const user = userEvent.setup();
    renderEditWithNav();

    await editValue(user, "5", "8");
    await user.click(screen.getByRole("link", { name: "Users sidebar" }));

    expect(await screen.findByText(/Leave without saving/)).toBeInTheDocument();
    expect(window.location.pathname).not.toBe("/users");
    await user.click(screen.getByRole("button", { name: "Leave" }));
    expect(mockNavigate).toHaveBeenCalledWith("/users");
  });

  it("with no change the Back arrow leaves without asking (TEOS-221)", async () => {
    const user = userEvent.setup();
    renderEditWithNav();
    await screen.findByDisplayValue("5");

    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(screen.queryByText(/Leave without saving/)).not.toBeInTheDocument();
  });

  it("without admin.settings.write the form is read only", async () => {
    signInWith([PERMISSIONS.SETTINGS_READ]);
    render(<EditSettings />);

    expect(await screen.findByDisplayValue("5")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
  });
});

describe("Edit settings (TEOS-135)", () => {
  it("loads every page of settings (page_size 100)", async () => {
    // total 101 > page_size 100: a second page is requested (rows kept few to stay fast)
    const first = [row(100, "FLAG_A", "a"), row(101, "FLAG_B", "b")];
    getAllSettings
      .mockResolvedValueOnce(listResponse(first, 101))
      .mockResolvedValueOnce(listResponse([row(999, "LAST_FLAG", "last")], 101));
    render(<EditSettings />);

    expect(await screen.findByDisplayValue("last")).toBeInTheDocument();
    expect(getAllSettings).toHaveBeenNthCalledWith(1, { page: 1, page_size: 100 });
    expect(getAllSettings).toHaveBeenNthCalledWith(2, { page: 2, page_size: 100 });
    expect(screen.getByText("3 Configured Settings")).toBeInTheDocument();
  });

  it("a new key is sent in items; the request carries no audit fields", async () => {
    const user = userEvent.setup();
    updateSettings.mockResolvedValue({ data: { data: {} } });
    render(<EditSettings />);
    await screen.findByDisplayValue("5");

    await user.click(screen.getByRole("button", { name: "Add Setting" }));
    await user.type(screen.getAllByPlaceholderText("Enter key")[0], "NEW_FLAG");
    await user.type(screen.getAllByPlaceholderText("Enter value")[0], "yes");
    await submitAndConfirm(user);

    await waitFor(() =>
      expect(updateSettings).toHaveBeenCalledWith({
        items: [{ key: "NEW_FLAG", value: "yes" }],
        deleted_keys: [],
      })
    );
    const payload = updateSettings.mock.calls[0][0];
    expect(Object.keys(payload).sort()).toEqual(["deleted_keys", "items"]);
    expect(JSON.stringify(payload)).not.toMatch(/old_data|changed_by|APP_CACHE_KEY/);
  });

  it("a secret-shaped new key is sent like any other key (user decision 2026-10-21)", async () => {
    const user = userEvent.setup();
    updateSettings.mockResolvedValue({ data: { data: {} } });
    render(<EditSettings />);
    await screen.findByDisplayValue("5");

    await user.click(screen.getByRole("button", { name: "Add Setting" }));
    await user.type(screen.getAllByPlaceholderText("Enter key")[0], "ESIM_HUB_API_KEY");
    await user.type(screen.getAllByPlaceholderText("Enter value")[0], "k-1");
    await submitAndConfirm(user);

    await waitFor(() =>
      expect(updateSettings).toHaveBeenCalledWith({
        items: [{ key: "ESIM_HUB_API_KEY", value: "k-1" }],
        deleted_keys: [],
      })
    );
  });

  it("a secret-shaped saved key is shown with its value and editable", async () => {
    getAllSettings.mockResolvedValue(listResponse([row(1, "SMTP_PASSWORD", "pw-1")]));
    render(<EditSettings />);

    expect(await screen.findByDisplayValue("pw-1")).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "remove setting" })).toBeDisabled(); // only row
  });

  it.each([
    ["new_flag", "Start with a letter; use A-Z, 0-9 and _ (3 to 64 characters)"],
    ["AB", "Start with a letter; use A-Z, 0-9 and _ (3 to 64 characters)"],
  ])("a new key %s shows a field error and sends nothing", async (key, message) => {
    const user = userEvent.setup();
    render(<EditSettings />);
    await screen.findByDisplayValue("5");

    await user.click(screen.getByRole("button", { name: "Add Setting" }));
    await user.type(screen.getAllByPlaceholderText("Enter key")[0], key);
    await user.type(screen.getAllByPlaceholderText("Enter value")[0], "x");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirm" })).not.toBeInTheDocument();
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it("409 protected_key puts the row back with the message; nothing saved", async () => {
    const user = userEvent.setup();
    const error = new Error("Conflict");
    error.response = {
      status: 409,
      data: { developerMessage: JSON.stringify({ code: "protected_key", key: "MY_FLAG", keys: ["MY_FLAG"] }) },
    };
    updateSettings.mockRejectedValue(error);
    render(<EditSettings />);
    await screen.findByDisplayValue("on");

    await user.click(screen.getAllByRole("button", { name: "remove setting" })[2]);
    expect(screen.queryByDisplayValue("on")).not.toBeInTheDocument();
    await submitAndConfirm(user);

    expect(await screen.findByDisplayValue("on")).toBeInTheDocument();
    expect(screen.getByText("This setting can't be deleted")).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("422 on a value puts the error on that row", async () => {
    const user = userEvent.setup();
    const error = new Error("Validation failed");
    error.response = {
      status: 422,
      data: {
        developerMessage:
          "Validation error: body: Value error, items.0.value: invalid_value, OTP_EXPIRATION_TIME is wrong",
      },
    };
    updateSettings.mockRejectedValue(error);
    render(<EditSettings />);

    await editValue(user, "5", "9");
    await submitAndConfirm(user);

    expect(await screen.findByText("invalid_value, OTP_EXPIRATION_TIME is wrong")).toBeInTheDocument();
    expect(screen.getByDisplayValue("9")).toBeInTheDocument();
  });

  it("TOP_COUNTRIES_COUNT uses a number input checked 1..50; FORBIDDEN_COUNTRIES a country multi-select", async () => {
    const user = userEvent.setup();
    getAllSettings.mockResolvedValue(
      listResponse([
        row(1, "TOP_COUNTRIES_COUNT", "8", { deletable: false }),
        row(2, "FORBIDDEN_COUNTRIES", "IL", { deletable: false }),
      ])
    );
    updateSettings.mockResolvedValue({ data: { data: {} } });
    render(<EditSettings />);

    const count = await screen.findByDisplayValue("8");
    expect(count).toHaveAttribute("type", "number");
    expect(screen.getByText("IL")).toBeInTheDocument(); // a chip

    await user.clear(count);
    await user.type(count, "51");
    expect(await screen.findByText("Enter a whole number from 1 to 50")).toBeInTheDocument();
    await user.clear(count);
    await user.type(count, "12");

    await user.click(screen.getByRole("combobox", { name: "forbidden countries" }));
    await user.type(screen.getByRole("combobox", { name: "forbidden countries" }), "France");
    await user.click(await screen.findByRole("option", { name: "France (FR)" }));
    await submitAndConfirm(user);

    await waitFor(() =>
      expect(updateSettings).toHaveBeenCalledWith({
        items: [
          { key: "TOP_COUNTRIES_COUNT", value: "12" },
          { key: "FORBIDDEN_COUNTRIES", value: "IL,FR" },
        ],
        deleted_keys: [],
      })
    );
  });

  it("an invalid recipients list is refused before any request", async () => {
    const user = userEvent.setup();
    getAllSettings.mockResolvedValue(
      listResponse([row(1, "WALLET_TOP_UP_ALERT_RECIPIENTS", "a@x.com", { deletable: false })])
    );
    render(<EditSettings />);

    await editValue(user, "a@x.com", "a@x.com, nope");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("Enter e-mail addresses separated by commas")).toBeInTheDocument();
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it("a long value edits in a multi-line field", async () => {
    getAllSettings.mockResolvedValue(listResponse([row(1, "JSON_BLOB", '{"a": 1}')]));
    render(<EditSettings />);

    const input = await screen.findByDisplayValue('{"a": 1}');
    expect(input.tagName).toBe("TEXTAREA");
  });

  it("save is disabled while saving", async () => {
    const user = userEvent.setup();
    updateSettings.mockReturnValue(new Promise(() => {}));
    render(<EditSettings />);

    await editValue(user, "5", "6");
    await submitAndConfirm(user);

    expect(await screen.findByRole("button", { name: "Submitting..." })).toBeDisabled();
    expect(updateSettings).toHaveBeenCalledTimes(1);
  });
});

const HISTORY = [
  {
    id: 9,
    changed_at: "2026-10-20T10:00:00",
    changed_by: { id: "u1", email: "boss@example.com" },
    ip_address: "8.8.8.8",
    client_reported: false,
    operation: "UPDATE",
    parse_error: false,
    changes: [
      { key: "NEW_FLAG", old_value: null, new_value: "on", redacted: false },
      { key: "OLD_FLAG", old_value: "1", new_value: null, redacted: false },
      { key: "SMTP_PASSWORD", old_value: "***", new_value: "***", redacted: true },
    ],
  },
  {
    id: 3,
    changed_at: "2025-01-01T10:00:00",
    changed_by: null,
    ip_address: null,
    client_reported: true,
    operation: "UPDATE",
    parse_error: true,
    changes: [],
  },
];

describe("Settings logs", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/settings/logs");
    getSettingsHistory.mockResolvedValue(listResponse(HISTORY, 2));
  });

  it("opens on page 1 and shows who, when, IP and the number of changed keys", async () => {
    render(<SettingsLogs />);

    expect(await screen.findByText("boss@example.com")).toBeInTheDocument();
    expect(getSettingsHistory).toHaveBeenCalledWith({
      page: 1,
      page_size: 10,
      key: undefined,
      changed_by: undefined,
      from: undefined,
      to: undefined,
    });
    expect(screen.getByText("8.8.8.8")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Deleted user")).toBeInTheDocument();
  });

  it("the key filter sends key on page 1 and goes in the URL", async () => {
    const user = userEvent.setup();
    render(<SettingsLogs />);
    await screen.findByText("boss@example.com");

    await user.type(screen.getByPlaceholderText("Exact key"), "FORBIDDEN_COUNTRIES");
    await user.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() =>
      expect(getSettingsHistory).toHaveBeenLastCalledWith(
        expect.objectContaining({ key: "FORBIDDEN_COUNTRIES", page: 1 })
      )
    );
    expect(mockNavigate).toHaveBeenLastCalledWith(
      expect.stringContaining("key=FORBIDDEN_COUNTRIES"),
      expect.anything()
    );
  });

  it("the date range sends from/to; to before from is refused without a request", async () => {
    const { container } = render(<SettingsLogs />);
    await screen.findByText("boss@example.com");
    const [fromInput, toInput] = container.querySelectorAll('input[type="date"]');

    fireEvent.change(fromInput, { target: { value: "2026-10-10" } });
    fireEvent.change(toInput, { target: { value: "2026-10-01" } });
    expect(await screen.findByText(/must be on or after/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
    const calls = getSettingsHistory.mock.calls.length;

    fireEvent.change(toInput, { target: { value: "2026-10-20" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() =>
      expect(getSettingsHistory).toHaveBeenLastCalledWith(
        expect.objectContaining({ from: "2026-10-10", to: "2026-10-20", page: 1 })
      )
    );
    expect(getSettingsHistory.mock.calls.length).toBe(calls + 1);
  });

  it("empty history shows No changes recorded", async () => {
    getSettingsHistory.mockResolvedValue(listResponse([], 0));
    render(<SettingsLogs />);
    expect(await screen.findByText("No changes recorded")).toBeInTheDocument();
  });

  it("API error shows an error toast and the table's empty row, no Retry", async () => {
    const error = vi.spyOn(toast, "error");
    getSettingsHistory.mockRejectedValue(new Error("boom"));
    render(<SettingsLogs />);

    expect(await screen.findByText("No changes recorded")).toBeInTheDocument();
    await waitFor(() => expect(error).toHaveBeenCalledWith("Failed to load the settings history"));
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });
});

describe("Settings logs detail", () => {
  it("shows key: old -> new with (new), (removed) and hidden, without JSON.parse", () => {
    const parse = vi.spyOn(JSON, "parse");
    render(<SettingsLogsDetail data={HISTORY[0]} />);

    expect(screen.getAllByTestId("setting-change")).toHaveLength(3);
    expect(screen.getByText("(new)")).toBeInTheDocument();
    expect(screen.getByText("(removed)")).toBeInTheDocument();
    expect(screen.getAllByText("hidden")).toHaveLength(2);
    expect(parse).not.toHaveBeenCalled();
    parse.mockRestore();
  });

  it("a row with parse_error shows Details unavailable", () => {
    render(<SettingsLogsDetail data={HISTORY[1]} />);
    expect(screen.getByText("Details unavailable")).toBeInTheDocument();
  });

  it("long values are cut with Show more", async () => {
    const user = userEvent.setup();
    const long = "x".repeat(300);
    render(
      <SettingsLogsDetail
        data={{ changes: [{ key: "LONG", old_value: "a", new_value: long, redacted: false }] }}
      />
    );

    expect(screen.queryByText(long, { exact: false })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show more" }));
    expect(screen.getByText(long, { exact: false })).toBeInTheDocument();
  });
});
