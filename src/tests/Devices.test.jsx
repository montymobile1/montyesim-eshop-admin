import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AuthLayout from "../Components/layout/AuthLayout";
import { getAllDevices, getDevicesFilterUser } from "../core/apis/devicesAPI";
import { getUsersLookup } from "../core/apis/lookupsAPI";
import { getUserDevices } from "../core/apis/usersAPI";
import DevicesPage from "../pages/devices/DevicesPage";
import DevicesTab from "../pages/users/tabs/DevicesTab";
import { render, screen, waitFor, within } from "./utils/test-utils";

// useParams for the user detail tab; the location stays the real one: the list follows
// the URL both ways (TEOS-287), each test starts on /devices (beforeEach).
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useParams: () => ({ id: "u1" }),
  };
});

vi.mock("../core/apis/devicesAPI", () => ({
  getAllDevices: vi.fn(),
  getDevicesFilterUser: vi.fn(),
}));

vi.mock("../core/apis/lookupsAPI", () => ({
  getUsersLookup: vi.fn(),
}));

vi.mock("../core/apis/usersAPI", async (importOriginal) => ({
  ...(await importOriginal()),
  getUserDevices: vi.fn(),
}));

const FACETS = { all: 3, android: 1, ios: 2 };

const listResponse = (rows, total = rows.length, facets = FACETS) => ({
  data: { data: { data: rows, total_count: total, facets } },
});

// Secret values a buggy or older API could still send: they must never reach the DOM.
const PUSH_TOKEN = "fcm-push-token-SECRET";
const IP = "203.0.113.77";

const DEVICES = [
  {
    id: 41,
    user_id: "u1",
    user_email: "owner@example.com",
    os: "iOS",
    manufacturer: "Apple",
    device_model: "iPhone 15",
    ip_location: "Beirut",
    is_rooted: false,
    timestamp_login: "2026-10-01T10:00:00",
    timestamp_logout: null,
    created_at: "2026-09-01T10:00:00",
    fcm_token: PUSH_TOKEN,
    originated_ip: IP,
  },
  {
    id: 42,
    user_id: null,
    user_email: null,
    os: "android",
    manufacturer: "Samsung",
    device_model: "Galaxy S24",
    ip_location: null,
    is_rooted: true,
    timestamp_login: null,
    timestamp_logout: null,
    created_at: "2026-08-01T10:00:00",
  },
];

const DEFAULT_PARAMS = {
  page: 1,
  page_size: 10,
  user_id: undefined,
  platform: "all",
  logged_in: "all",
  sort: "created_at",
  dir: "desc",
};

const renderPage = () =>
  render(
    <AuthLayout>
      <DevicesPage />
    </AuthLayout>
  );

const lastCallParams = () => getAllDevices.mock.calls.at(-1)[0];

const expectNoSecret = (container) => {
  const text = container.textContent;
  expect(text).not.toContain(PUSH_TOKEN);
  expect(text).not.toContain(IP);
  expect(screen.queryByText(/fcm|push token/i)).not.toBeInTheDocument();
  expect(screen.queryByRole("columnheader", { name: /^IP$|originated|IP address/i })).not.toBeInTheDocument();
};

describe("Devices Page", { timeout: 20000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, "", "/devices");
    getAllDevices.mockResolvedValue(listResponse(DEVICES, 2));
    getUsersLookup.mockResolvedValue(listResponse([]));
  });

  it("render page component", () => {
    renderPage();

    expect(
      screen.getByRole("heading", { name: /Devices/i, level: 1 })
    ).toBeInTheDocument();
  });

  it("opens on All, page 1, newest first and shows the devices", async () => {
    renderPage();

    expect(await screen.findByText("iPhone 15")).toBeInTheDocument();
    expect(screen.getByText("Apple")).toBeInTheDocument();
    expect(getAllDevices.mock.calls[0][0]).toEqual(DEFAULT_PARAMS);
  });

  it("a page past the end moves to the last valid page and replaces the URL (TEOS-286)", async () => {
    window.history.pushState({}, "", "/devices?pageSize=10&page=99");
    const entries = window.history.length;
    getAllDevices.mockImplementation(async (params) =>
      listResponse(params.page === 3 ? DEVICES : [], 21)
    );
    renderPage();

    // two requests in a row (the empty page, then the last one): more time under load
    expect(await screen.findByText("iPhone 15", {}, { timeout: 5000 })).toBeInTheDocument();
    expect(getAllDevices.mock.calls.at(-1)[0]).toEqual(expect.objectContaining({ page: 3 }));
    await waitFor(() => expect(window.location.search).toContain("page=2"));
    // TEOS-287: the out-of-range URL is replaced, not pushed
    expect(window.history.length).toBe(entries);
  });

  it("shows the owner email, Anonymous without one, and a Rooted badge", async () => {
    renderPage();

    expect(await screen.findByText("owner@example.com")).toBeInTheDocument();
    expect(screen.getByText("Anonymous")).toBeInTheDocument();
    const galaxyRow = screen.getByText("Galaxy S24").closest("tr");
    expect(within(galaxyRow).getByText("Rooted")).toBeInTheDocument();
    const iphoneRow = screen.getByText("iPhone 15").closest("tr");
    expect(within(iphoneRow).queryByText("Rooted")).not.toBeInTheDocument();
  });

  it("never renders a push token or an IP, even if the API sent them (TEOS-116 case 15)", async () => {
    const { container } = renderPage();
    await screen.findByText("iPhone 15");

    expectNoSecret(container);
  });

  it("tab counts come from facets, not from the rows on screen", async () => {
    getAllDevices.mockResolvedValue(listResponse(DEVICES, 2, { all: 120, android: 70, ios: 50 }));
    renderPage();

    expect(await screen.findByRole("tab", { name: "All (120)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Android (70)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "iOS (50)" })).toBeInTheDocument();
  });

  it("the Android tab requests platform=android from page 1 and writes the URL", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/devices?page=3");
    renderPage();
    await screen.findByText("iPhone 15");

    await user.click(screen.getByRole("tab", { name: "Android (1)" }));

    await waitFor(() =>
      expect(lastCallParams()).toEqual({ ...DEFAULT_PARAMS, platform: "android", page: 1 })
    );
    expect(window.location.search).toContain("platform=android");
  });

  it("while a new tab loads, the previous rows are replaced by the skeleton (TEOS-162)", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("iPhone 15");

    let finish;
    getAllDevices.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    await user.click(screen.getByRole("tab", { name: "Android (1)" }));

    await waitFor(() => expect(screen.queryByText("iPhone 15")).not.toBeInTheDocument());
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();

    finish(listResponse(DEVICES.slice(0, 1), 1));
    expect(await screen.findByText(DEVICES[0].device_model)).toBeInTheDocument();
    expect(document.querySelector('[aria-busy="true"]')).toBeNull();
  });

  it("Logged in: Yes sends logged_in=yes from page 1", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("iPhone 15");

    await user.click(screen.getByRole("combobox", { name: /Logged in/ }));
    await user.click(await screen.findByRole("option", { name: "Yes" }));

    await waitFor(() =>
      expect(lastCallParams()).toEqual({ ...DEFAULT_PARAMS, logged_in: "yes" })
    );
    expect(window.location.search).toContain("loggedIn=yes");
  });

  it("clicking Last Login sorts by timestamp_login and toggles dir; other headers are not sortable", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("iPhone 15");

    expect(screen.queryByRole("button", { name: "Manufacturer" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Owner" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Last Login" }));
    await waitFor(() =>
      expect(lastCallParams()).toEqual({ ...DEFAULT_PARAMS, sort: "timestamp_login", dir: "asc" })
    );
    await user.click(screen.getByRole("button", { name: "Last Login" }));
    await waitFor(() =>
      expect(lastCallParams()).toEqual({ ...DEFAULT_PARAMS, sort: "timestamp_login", dir: "desc" })
    );
    expect(window.location.search).toContain("sortBy=timestamp_login");
  });

  it("restores the user filter, tab, logged-in filter, sort and page from the URL", async () => {
    window.history.pushState(
      {},
      "",
      "/devices?user=u1&page=1&pageSize=25&platform=ios&loggedIn=no&sortBy=timestamp_login&sortDirection=asc"
    );
    getDevicesFilterUser.mockResolvedValue({
      data: { data: { data: [{ id: "u1", label: "jane@example.com", email: "jane@example.com" }], total_count: 1 } },
    });

    renderPage();

    await waitFor(() => expect(getAllDevices).toHaveBeenCalled());
    expect(getAllDevices.mock.calls[0][0]).toEqual({
      page: 2,
      page_size: 25,
      user_id: "u1",
      platform: "ios",
      logged_in: "no",
      sort: "timestamp_login",
      dir: "asc",
    });
    expect(await screen.findByText("jane@example.com")).toBeInTheDocument();
  });

  it("ignores unknown tab, filter and sort values in the URL", async () => {
    window.history.pushState({}, "", "/devices?platform=windows&loggedIn=maybe&sortBy=fcm_token");

    renderPage();

    await waitFor(() => expect(getAllDevices).toHaveBeenCalled());
    expect(getAllDevices.mock.calls[0][0]).toEqual(DEFAULT_PARAMS);
  });

  it("Apply filters by user and goes back to page 1, keeping the tab", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/devices?page=4&platform=ios");
    getUsersLookup.mockResolvedValue(
      listResponse([{ id: "u9", label: "picked@example.com", email: "picked@example.com" }])
    );
    renderPage();
    await screen.findByText("iPhone 15");

    await user.click(screen.getByLabelText("User"));
    await user.click(await screen.findByText("picked@example.com"));
    await user.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() =>
      expect(lastCallParams()).toEqual({ ...DEFAULT_PARAMS, platform: "ios", user_id: "u9" })
    );
    expect(window.location.search).toContain("user=u9");
  });

  it("the user dropdown never sends a 1-character search, and trims what it sends (TEOS-147)", async () => {
    const user = userEvent.setup();
    getUsersLookup.mockResolvedValue(listResponse([]));
    renderPage();
    await screen.findByText("iPhone 15");

    await user.type(screen.getByLabelText("User"), " a");
    expect(await screen.findByText(/Search should be more than 1 character/)).toBeInTheDocument();
    await user.type(screen.getByLabelText("User"), "b ");

    await waitFor(() =>
      expect(getUsersLookup).toHaveBeenCalledWith(expect.objectContaining({ search: "ab" }))
    );
    const searches = getUsersLookup.mock.calls.map(([params]) => params?.search);
    searches
      .filter((search) => search !== undefined)
      .forEach((search) => expect(search.length).toBeGreaterThanOrEqual(2));
  });

  it("shows the empty state", async () => {
    getAllDevices.mockResolvedValue(listResponse([], 0, { all: 0, android: 0, ios: 0 }));

    renderPage();

    expect(await screen.findByText("No Devices Found")).toBeInTheDocument();
  });
});

describe("User detail Devices tab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserDevices.mockResolvedValue({
      data: { data: { data: DEVICES, total_count: 2 } },
    });
  });

  it("never renders a push token or an IP column (TEOS-116 case 15)", async () => {
    const { container } = render(<DevicesTab />);

    expect(await screen.findByText("iPhone 15")).toBeInTheDocument();
    expect(getUserDevices).toHaveBeenCalledWith("u1", { page: 1, page_size: 10 });
    expectNoSecret(container);
  });
});
