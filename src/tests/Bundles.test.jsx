import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import { toast } from "react-toastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignIn, SignOut } from "../Redux/reducers/AuthReducer";
import { store } from "../Redux/store";
import { PERMISSIONS } from "../core/vairables/Permissions";
import BundlesList from "../pages/bundles/BundlesList";
import { render, screen, waitFor, within } from "./utils/test-utils";

vi.mock("react-toastify", async () => {
  const actual = await vi.importActual("react-toastify");
  return {
    ...actual,
    toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
  };
});

vi.mock("../core/apis/bundlesAPI", async () => {
  const actual = await vi.importActual("../core/apis/bundlesAPI");
  return {
    getApiErrorCode: actual.getApiErrorCode,
    getAllBundles: vi.fn(),
    getBundleById: vi.fn(),
    updateBundleTitle: vi.fn(),
    toggleBundleStatus: vi.fn(),
    bulkBundleStatus: vi.fn(),
    assignTagsToBundle: vi.fn(),
    getGroupTags: vi.fn(),
  };
});

vi.mock("../core/apis/lookupsAPI", () => ({
  getTagsLookup: vi.fn(),
  getGroupsLookup: vi.fn(),
}));

import * as bundlesAPI from "../core/apis/bundlesAPI";
import { getTagsLookup } from "../core/apis/lookupsAPI";

const BID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BID2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TAG1 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const signInWith = (permissions) =>
  store.dispatch(
    SignIn({
      access_token: "token",
      refresh_token: "refresh",
      expires_in: 3600,
      user: { id: "id", email: "a@example.com", role: "admin", permissions },
    })
  );

const apiError = (status, developerMessage) =>
  Object.assign(new Error(`HTTP ${status}`), {
    response: { status, data: { developerMessage } },
  });

const conflict = (code) => apiError(409, JSON.stringify({ code }));

const listResponse = {
  data: {
    data: {
      data: [
        {
          id: BID,
          bundle_name: "Europe Display",
          is_active: true,
          created_at: "2026-10-20T10:00:00",
          updated_at: null,
          data: { bundle_info_code: "EU5", bundle_name: "Europe 5GB" },
        },
        {
          id: BID2,
          bundle_name: null,
          is_active: false,
          created_at: "2026-10-19T10:00:00",
          updated_at: null,
          data: { bundle_info_code: "US1", bundle_name: "USA 1GB" },
        },
      ],
      total_count: 2,
      facets: { all: 2, active: 1, inactive: 1 },
      totals: { total: 12, active_count: 9, inactive_count: 3 },
    },
  },
};

const lastListParams = () => bundlesAPI.getAllBundles.mock.calls.at(-1)[0];

// Multi-step dialogs: more than the 5 s default when the machine is busy.
const SLOW = 20000;

describe("Bundles page", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/bundles");
    vi.clearAllMocks();
    bundlesAPI.getAllBundles.mockResolvedValue(listResponse);
    getTagsLookup.mockResolvedValue({ data: { data: { data: [], total_count: 0 } } });
  });

  afterEach(() => {
    store.dispatch(SignOut());
  });

  it("opens on All, page 1, shows tab counts from facets and the bulk summary from totals", async () => {
    signInWith([PERMISSIONS.BUNDLES_READ, PERMISSIONS.BUNDLES_WRITE, PERMISSIONS.BUNDLES_BULK]);
    render(<BundlesList />);

    expect(await screen.findByText("EU5")).toBeInTheDocument();
    expect(screen.getByText("Europe Display")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "All (2)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Inactive (1)" })).toBeInTheDocument();
    expect(screen.getByText("9 active / 3 inactive")).toBeInTheDocument();
    expect(lastListParams()).toEqual({
      page: 1,
      page_size: 10,
      status: "all",
      search: undefined,
      tag_ids: undefined,
    });
  });

  it("a page past the end moves to the last valid page and replaces the URL (TEOS-286)", async () => {
    signInWith([PERMISSIONS.BUNDLES_READ]);
    window.history.pushState({}, "", "/bundles?pageSize=10&page=99");
    const entries = window.history.length;
    bundlesAPI.getAllBundles.mockImplementation(async (params) => ({
      data: {
        data: {
          ...listResponse.data.data,
          data: params.page === 3 ? listResponse.data.data.data : [],
          total_count: 21,
        },
      },
    }));
    render(<BundlesList />);

    // two requests in a row (the empty page, then the last one): more time under load
    expect(await screen.findByText("EU5", {}, { timeout: 5000 })).toBeInTheDocument();
    expect(bundlesAPI.getAllBundles).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 3 })
    );
    await waitFor(() => expect(window.location.search).toContain("page=2"));
    // TEOS-287: the out-of-range URL is replaced, not pushed
    expect(window.history.length).toBe(entries);
  });

  it("switching tab requests that status from page 1 and writes it to the URL", async () => {
    signInWith([PERMISSIONS.BUNDLES_READ]);
    render(<BundlesList />);
    await screen.findByText("EU5");

    await userEvent.click(screen.getByRole("tab", { name: "Active (1)" }));

    await waitFor(() =>
      expect(lastListParams()).toMatchObject({ status: "active", page: 1 })
    );
    expect(window.location.search).toContain("status=active");
  });

  it("restores search, tags, status and page from the URL and rehydrates the tag label", async () => {
    window.history.pushState({}, "", `/bundles?search=eu&tag_ids=${TAG1}&status=inactive&page=1&pageSize=25`);
    getTagsLookup.mockResolvedValue({
      data: { data: { data: [{ id: TAG1, label: "France (Europe)" }], total_count: 1 } },
    });
    signInWith([PERMISSIONS.BUNDLES_READ]);
    render(<BundlesList />);

    await waitFor(() => expect(bundlesAPI.getAllBundles).toHaveBeenCalled());
    expect(bundlesAPI.getAllBundles.mock.calls[0][0]).toEqual({
      page: 2,
      page_size: 25,
      status: "inactive",
      search: "eu",
      tag_ids: [TAG1],
    });
    expect(getTagsLookup).toHaveBeenCalledWith({ id: TAG1 });
    expect(await screen.findByText("France (Europe)")).toBeInTheDocument();
  }, SLOW);

  it("filters by a tag picked from the lookup and goes back to page 1", async () => {
    window.history.pushState({}, "", "/bundles?page=2");
    getTagsLookup.mockResolvedValue({
      data: { data: { data: [{ id: TAG1, label: "France (Europe)" }], total_count: 1 } },
    });
    signInWith([PERMISSIONS.BUNDLES_READ, PERMISSIONS.TAGS_READ]);
    render(<BundlesList />);
    await screen.findByText("EU5");

    await userEvent.click(screen.getByLabelText("Tags"));
    await userEvent.click(await screen.findByText("France (Europe)"));
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() =>
      expect(lastListParams()).toMatchObject({ tag_ids: [TAG1], page: 1 })
    );
    expect(window.location.search).toContain(`tag_ids=${TAG1}`);
  }, SLOW);

  it("rename dialog sends PATCH and shows a toast", async () => {
    signInWith([PERMISSIONS.BUNDLES_READ, PERMISSIONS.BUNDLES_WRITE]);
    bundlesAPI.updateBundleTitle.mockResolvedValue({ data: { data: { id: BID, bundle_name: "Renamed" } } });
    render(<BundlesList />);
    await screen.findByText("EU5");

    await userEvent.click(screen.getAllByRole("button", { name: /^Actions for / })[0]);
    await userEvent.click(screen.getByRole("menuitem", { name: /^Edit display name/ }));
    const input = screen.getByPlaceholderText("Enter display name");
    await userEvent.clear(input);
    await userEvent.type(input, "Renamed");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(bundlesAPI.updateBundleTitle).toHaveBeenCalledWith({ id: BID, bundle_name: "Renamed" })
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  }, SLOW);

  it("deactivate dialog requires a reason, confirms in two steps and sends PATCH /status", async () => {
    signInWith([PERMISSIONS.BUNDLES_READ, PERMISSIONS.BUNDLES_WRITE, PERMISSIONS.BUNDLES_BULK]);
    bundlesAPI.toggleBundleStatus.mockResolvedValue({ data: { data: { id: BID, is_active: false } } });
    render(<BundlesList />);
    await screen.findByText("EU5");

    await userEvent.click(screen.getByRole("button", { name: "deactivate" }));
    const continueButton = screen.getByRole("button", { name: "Continue" });
    expect(continueButton).toBeDisabled();

    await userEvent.type(
      screen.getByPlaceholderText("e.g. Bundle temporarily disabled due to provider maintenance."),
      "provider maintenance"
    );
    await waitFor(() => expect(continueButton).toBeEnabled());
    await userEvent.click(continueButton);
    await userEvent.click(screen.getByRole("button", { name: "Confirm Deactivation" }));

    await waitFor(() =>
      expect(bundlesAPI.toggleBundleStatus).toHaveBeenCalledWith({
        id: BID,
        is_active: false,
        reason: "provider maintenance",
      })
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(toast.warn).not.toHaveBeenCalled();
  }, SLOW);

  it("a deactivation reason under 3 characters is refused before any request (TEOS-166)", async () => {
    signInWith([PERMISSIONS.BUNDLES_READ, PERMISSIONS.BUNDLES_WRITE, PERMISSIONS.BUNDLES_BULK]);
    render(<BundlesList />);
    await screen.findByText("EU5");

    await userEvent.click(screen.getByRole("button", { name: "deactivate" }));
    const input = screen.getByPlaceholderText(
      "e.g. Bundle temporarily disabled due to provider maintenance."
    );
    await userEvent.type(input, " ab ");

    expect(await screen.findByText("Reason must be at least 3 characters")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();

    await userEvent.type(input, "c");
    await waitFor(() => expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled());
    expect(bundlesAPI.toggleBundleStatus).not.toHaveBeenCalled();
  }, SLOW);

  it("409 no_change on a toggle shows an info toast, not an error", async () => {
    signInWith([PERMISSIONS.BUNDLES_READ, PERMISSIONS.BUNDLES_WRITE, PERMISSIONS.BUNDLES_BULK]);
    bundlesAPI.toggleBundleStatus.mockRejectedValue(conflict("no_change"));
    render(<BundlesList />);
    await screen.findByText("EU5");

    await userEvent.click(screen.getByRole("button", { name: "activate" }));
    await userEvent.type(
      screen.getByPlaceholderText("e.g. Provider maintenance is over."),
      "back online"
    );
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm Activation" }));

    await waitFor(() => expect(toast.info).toHaveBeenCalled());
    expect(toast.error).not.toHaveBeenCalled();
  }, SLOW);

  it("bulk deactivate sends POST /status/bulk with the reason and reports rows_affected", async () => {
    signInWith([PERMISSIONS.BUNDLES_READ, PERMISSIONS.BUNDLES_WRITE, PERMISSIONS.BUNDLES_BULK]);
    bundlesAPI.bulkBundleStatus.mockResolvedValue({
      data: { data: { rows_affected: 9, affected_bundle_ids: [] } },
    });
    render(<BundlesList />);
    await screen.findByText("EU5");

    await userEvent.click(screen.getByRole("button", { name: "Deactivate All Bundles" }));
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await userEvent.type(
      screen.getByPlaceholderText(
        "e.g. Bundles are being temporarily disabled due to provider maintenance."
      ),
      "provider down"
    );
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm Deactivation" }));

    await waitFor(() =>
      expect(bundlesAPI.bulkBundleStatus).toHaveBeenCalledWith({
        is_active: false,
        reason: "provider down",
      })
    );
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("9 bundle(s) affected"))
    );
  }, SLOW);

  it("the Deactivate All dialog states the active count in step 1 and the final step (TEOS-291)", async () => {
    signInWith([PERMISSIONS.BUNDLES_READ, PERMISSIONS.BUNDLES_WRITE, PERMISSIONS.BUNDLES_BULK]);
    render(<BundlesList />);
    await screen.findByText("EU5");

    await userEvent.click(screen.getByRole("button", { name: "Deactivate All Bundles" }));
    expect(
      screen.getByText(
        "You are about to deactivate 9 active bundle(s). New eSIM purchases will no longer be available. Do you want to continue?"
      )
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await userEvent.type(
      screen.getByPlaceholderText(
        "e.g. Bundles are being temporarily disabled due to provider maintenance."
      ),
      "provider down"
    );
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(
      screen.getByText(
        "Confirm the deactivation of 9 active bundle(s). This action will immediately prevent new purchases."
      )
    ).toBeInTheDocument();
    expect(bundlesAPI.bulkBundleStatus).not.toHaveBeenCalled();
  }, SLOW);

  it("after a bulk change from page 2 the list reloads page 1 of the current tab (TEOS-167)", async () => {
    window.history.pushState({}, "", "/bundles?status=active&page=1");
    signInWith([PERMISSIONS.BUNDLES_READ, PERMISSIONS.BUNDLES_WRITE, PERMISSIONS.BUNDLES_BULK]);
    bundlesAPI.bulkBundleStatus.mockResolvedValue({
      data: { data: { rows_affected: 9, affected_bundle_ids: [] } },
    });
    render(<BundlesList />);
    await screen.findByText("EU5");
    expect(lastListParams()).toMatchObject({ page: 2, status: "active" });

    await userEvent.click(screen.getByRole("button", { name: "Deactivate All Bundles" }));
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await userEvent.type(
      screen.getByPlaceholderText(
        "e.g. Bundles are being temporarily disabled due to provider maintenance."
      ),
      "provider down"
    );
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm Deactivation" }));

    await waitFor(() => expect(lastListParams()).toMatchObject({ page: 1, status: "active" }));
    // page 2 is not fetched again after the change
    const pages = bundlesAPI.getAllBundles.mock.calls.map((call) => call[0].page);
    expect(pages.filter((page) => page === 2)).toHaveLength(1);
  }, SLOW);

  it("bulk activate is refused locally when totals say every bundle is active", async () => {
    signInWith([PERMISSIONS.BUNDLES_READ, PERMISSIONS.BUNDLES_BULK]);
    bundlesAPI.getAllBundles.mockResolvedValue({
      data: {
        data: {
          ...listResponse.data.data,
          totals: { total: 2, active_count: 2, inactive_count: 0 },
        },
      },
    });
    render(<BundlesList />);
    await screen.findByText("EU5");

    await userEvent.click(screen.getByRole("button", { name: "Activate All Bundles" }));

    expect(toast.info).toHaveBeenCalledWith("All bundles are already active.");
    expect(bundlesAPI.bulkBundleStatus).not.toHaveBeenCalled();
  });

  it("the row toggle stays super admin only (bulk permission), as before the migration", async () => {
    signInWith([PERMISSIONS.BUNDLES_READ, PERMISSIONS.BUNDLES_WRITE]);
    render(<BundlesList />);
    await screen.findByText("EU5");

    expect(screen.queryByRole("button", { name: "deactivate" })).not.toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("button", { name: /^Actions for / })[0]);
    expect(screen.getByRole("menuitem", { name: /^Edit display name/ })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    const firstRow = screen.getByText("EU5").closest("tr");
    expect(within(firstRow).getByText("Active")).toBeInTheDocument();
  });

  it("without write permission there is no toggle, rename or assign; without bulk no bulk buttons", async () => {
    signInWith([PERMISSIONS.BUNDLES_READ]);
    render(<BundlesList />);
    await screen.findByText("EU5");

    expect(screen.queryByRole("button", { name: "deactivate" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Activate All Bundles" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Deactivate All Bundles" })).not.toBeInTheDocument();
    // the status is still readable
    const firstRow = screen.getByText("EU5").closest("tr");
    expect(within(firstRow).getByText("Active")).toBeInTheDocument();
    // only View is left in the row menu
    const menus = screen.getAllByRole("button", { name: /^Actions for / });
    expect(menus).toHaveLength(2);
    await userEvent.click(menus[0]);
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "ViewSee the bundle's details",
    ]);
  });

  it("the row ⋯ menu has View, Edit display name and Assign to groups", async () => {
    signInWith([PERMISSIONS.BUNDLES_READ, PERMISSIONS.BUNDLES_WRITE]);
    render(<BundlesList />);
    await screen.findByText("EU5");

    await userEvent.click(screen.getByRole("button", { name: "Actions for Europe Display" }));
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "ViewSee the bundle's details",
      "Edit display nameChange the name shown in the app",
      "Assign to groupsChoose the groups and tags the bundle appears under",
    ]);
  });

  it("the bulk buttons sit above the status tabs", async () => {
    signInWith([PERMISSIONS.BUNDLES_READ, PERMISSIONS.BUNDLES_BULK]);
    render(<BundlesList />);
    await screen.findByText("EU5");

    const bulk = screen.getByRole("button", { name: "Deactivate All Bundles" });
    const tabs = screen.getByRole("tablist", { name: "Bundle status" });
    expect(bulk.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("an API error shows a toast and the table's empty row, no Retry", async () => {
    signInWith([PERMISSIONS.BUNDLES_READ]);
    bundlesAPI.getAllBundles.mockRejectedValue(new Error("boom"));
    render(<BundlesList />);

    expect(await screen.findByText("No Data Found")).toBeInTheDocument();
    expect(screen.queryByText("Failed to load bundles.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    expect(toast.error).toHaveBeenCalled();
  });
});
