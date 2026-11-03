import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import { Link, Route, Routes } from "react-router-dom";
import { toast } from "react-toastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignIn, SignOut } from "../Redux/reducers/AuthReducer";
import { store } from "../Redux/store";
import { PERMISSIONS } from "../core/vairables/Permissions";
import AssignBundleToGroups, {
  inactiveGroupTagMessage,
} from "../pages/AssignBundleToGroups/AssignBundleToGroups";
import { render, screen, waitFor, within } from "./utils/test-utils";

vi.mock("react-toastify", async () => {
  const actual = await vi.importActual("react-toastify");
  return {
    ...actual,
    toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  };
});

vi.mock("../core/apis/bundlesAPI", async () => {
  const actual = await vi.importActual("../core/apis/bundlesAPI");
  return {
    getApiErrorCode: actual.getApiErrorCode,
    getApiErrorDetails: actual.getApiErrorDetails,
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
import { getGroupsLookup } from "../core/apis/lookupsAPI";

const BID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TAG_FR = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const TAG_DE = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const TAG_US = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

const signInWith = (permissions) =>
  store.dispatch(
    SignIn({
      access_token: "token",
      refresh_token: "refresh",
      expires_in: 3600,
      user: { id: "id", email: "a@example.com", role: "admin", permissions },
    })
  );

const bundle = {
  id: BID,
  bundle_name: "Europe Display",
  is_active: true,
  data: {},
  tags: [
    {
      bundle_tag_id: 1,
      tag: {
        id: TAG_FR,
        name: "France",
        icon: null,
        group: { id: 2, name: "Europe", type: 1, group_category: "country" },
      },
    },
  ],
};

const groupTags = {
  2: [
    { id: TAG_FR, name: "France", icon: null, tag_group_id: 2 },
    { id: TAG_DE, name: "Germany", icon: null, tag_group_id: 2 },
  ],
  3: [{ id: TAG_US, name: "USA", icon: null, tag_group_id: 3 }],
};

const renderPage = () =>
  render(
    <>
      {/* stands in for a sidebar link */}
      <Link to="/users">Users link</Link>
      <Routes>
        <Route path="/bundles/:bundleId/assign" element={<AssignBundleToGroups />} />
        <Route path="/bundles" element={<p>Bundles list</p>} />
        <Route path="/users" element={<p>Users list</p>} />
      </Routes>
    </>
  );

const SLOW = 20000;

describe("Assign bundle to groups", () => {
  beforeEach(() => {
    window.history.pushState({}, "", `/bundles/${BID}/assign`);
    vi.clearAllMocks();
    bundlesAPI.getBundleById.mockResolvedValue({ data: { data: bundle } });
    bundlesAPI.getGroupTags.mockImplementation((groupId) =>
      Promise.resolve({ data: { data: groupTags[groupId] || [] } })
    );
    getGroupsLookup.mockResolvedValue({
      data: {
        data: {
          data: [
            { id: 2, label: "Europe", type: 1, group_category: "country" },
            { id: 3, label: "America", type: 1, group_category: "country" },
          ],
          total_count: 2,
        },
      },
    });
    signInWith([PERMISSIONS.BUNDLES_READ, PERMISSIONS.BUNDLES_WRITE, PERMISSIONS.GROUPS_READ]);
  }, SLOW);

  afterEach(() => {
    store.dispatch(SignOut());
  }, SLOW);

  it("loads the bundle, its groups and their tags, with the current tags selected", async () => {
    renderPage();

    expect(await screen.findByText("Bundle : Europe Display")).toBeInTheDocument();
    expect(bundlesAPI.getBundleById).toHaveBeenCalledWith(BID);
    expect(bundlesAPI.getGroupTags).toHaveBeenCalledWith(2);
    const section = await screen.findByTestId("group-section-2");
    expect(within(section).getByText("Europe")).toBeInTheDocument();
    expect(within(section).getByText("Germany")).toBeInTheDocument();
    expect(within(section).getByText("1 / 2 selected")).toBeInTheDocument();
  }, SLOW);

  it("deselecting every tag and saving sends PUT with an empty set (MS-5065), then stays on the page (TEOS-171)", async () => {
    bundlesAPI.assignTagsToBundle.mockResolvedValue({ data: { data: { id: BID, tag_ids: [] } } });
    renderPage();
    const section = await screen.findByTestId("group-section-2");

    await userEvent.click(within(section).getByText("France"));
    expect(within(section).getByText("0 / 2 selected")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(bundlesAPI.assignTagsToBundle).toHaveBeenCalledWith(BID, [])
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(window.location.pathname).toBe(`/bundles/${BID}/assign`);
    expect(within(section).getByText("0 / 2 selected")).toBeInTheDocument();
    // the saved set is the new baseline: nothing pending
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  }, SLOW);

  it("after Save the page shows the set the API returned (TEOS-171)", async () => {
    // another admin's save won: the server answers with Germany only
    bundlesAPI.assignTagsToBundle.mockResolvedValue({ data: { data: { id: BID, tag_ids: [TAG_DE] } } });
    renderPage();
    const section = await screen.findByTestId("group-section-2");

    await userEvent.click(within(section).getByText("France"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(within(section).getByText("1 / 2 selected")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  }, SLOW);

  it("with no change Save is disabled with a 'Nothing to save' hint, and enabled again after a change (TEOS-169)", async () => {
    renderPage();
    const section = await screen.findByTestId("group-section-2");

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.getByText("Nothing to save")).toBeInTheDocument();

    await userEvent.click(within(section).getByText("Germany"));
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    expect(screen.queryByText("Nothing to save")).not.toBeInTheDocument();

    // undoing the change makes it clean again
    await userEvent.click(within(section).getByText("Germany"));
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(bundlesAPI.assignTagsToBundle).not.toHaveBeenCalled();
  }, SLOW);

  it("Cancel with unsaved changes asks first; Leave goes to the list (TEOS-170)", async () => {
    renderPage();
    const section = await screen.findByTestId("group-section-2");
    await userEvent.click(within(section).getByText("Germany"));

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("You have unsaved changes. Leave without saving?")).toBeInTheDocument();
    expect(window.location.pathname).toBe(`/bundles/${BID}/assign`);

    await userEvent.click(screen.getByRole("button", { name: "Leave" }));
    expect(await screen.findByText("Bundles list")).toBeInTheDocument();
  }, SLOW);

  it("an in-app link with unsaved changes is held until confirmed (TEOS-170)", async () => {
    renderPage();
    const section = await screen.findByTestId("group-section-2");
    await userEvent.click(within(section).getByText("Germany"));

    await userEvent.click(screen.getByText("Users link"));
    expect(screen.getByText("You have unsaved changes. Leave without saving?")).toBeInTheDocument();
    expect(window.location.pathname).toBe(`/bundles/${BID}/assign`);

    // Cancel in the dialog keeps the page and the selection
    const dialog = screen.getByText("Unsaved changes").closest("div").parentElement;
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(within(section).getByText("2 / 2 selected")).toBeInTheDocument();

    await userEvent.click(screen.getByText("Users link"));
    await userEvent.click(screen.getByRole("button", { name: "Leave" }));
    expect(await screen.findByText("Users list")).toBeInTheDocument();
  }, SLOW);

  it("with no unsaved changes Cancel and links leave at once (TEOS-170)", async () => {
    renderPage();
    await screen.findByTestId("group-section-2");

    await userEvent.click(screen.getByText("Users link"));
    expect(await screen.findByText("Users list")).toBeInTheDocument();
    expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();
  }, SLOW);

  it("adding a group loads its tags; selecting one of them saves the exact set", async () => {
    bundlesAPI.assignTagsToBundle.mockResolvedValue({ data: { data: { id: BID, tag_ids: [TAG_FR, TAG_US] } } });
    renderPage();
    await screen.findByTestId("group-section-2");

    await userEvent.click(screen.getByLabelText("Groups"));
    await userEvent.click(await screen.findByText("America"));
    const section = await screen.findByTestId("group-section-3");
    await userEvent.click(await within(section).findByText("USA"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(bundlesAPI.assignTagsToBundle).toHaveBeenCalledWith(BID, [TAG_FR, TAG_US])
    );
  }, SLOW);

  it.each([
    [403, "You do not have permission to perform this action.", "admin.bundles.write"],
    [500, "Something went wrong.", "INTERNAL_ERROR"],
    [422, "The request is invalid.", "unknown tag id(s): x"],
  ])("a %s on Save shows the readable message, not the developer code (TEOS-172)", async (status, message, developerMessage) => {
    // error.message is what the axios interceptor sets from the body's message
    bundlesAPI.assignTagsToBundle.mockRejectedValue(
      Object.assign(new Error(message), {
        response: { status, data: { message, developerMessage } },
      })
    );
    renderPage();
    const section = await screen.findByTestId("group-section-2");

    await userEvent.click(within(section).getByText("Germany"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(message));
    expect(toast.error).not.toHaveBeenCalledWith(developerMessage);
    expect(window.location.pathname).toBe(`/bundles/${BID}/assign`);
    expect(within(section).getByText("2 / 2 selected")).toBeInTheDocument();
  }, SLOW);

  it("422 inactive_group_tag names the tag that belongs to an inactive group (TEOS-168)", async () => {
    bundlesAPI.assignTagsToBundle.mockRejectedValue(
      Object.assign(new Error("The request is invalid."), {
        response: {
          status: 422,
          data: {
            message: "The request is invalid.",
            developerMessage: JSON.stringify({ code: "inactive_group_tag", tag_ids: [TAG_DE] }),
          },
        },
      })
    );
    renderPage();
    const section = await screen.findByTestId("group-section-2");

    await userEvent.click(within(section).getByText("Germany"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "“Germany” belongs to an inactive group. Remove it before saving."
      )
    );
    // nothing was saved: the change is still pending
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  }, SLOW);

  it("inactiveGroupTagMessage lists several tags and falls back when none is known (TEOS-168)", () => {
    const names = { a: "a3", b: "b4" };
    expect(inactiveGroupTagMessage(["a", "b"], names)).toBe(
      "“a3”, “b4” belong to an inactive group. Remove them before saving."
    );
    expect(inactiveGroupTagMessage(["zzz"], names)).toBe(
      "A selected tag belongs to an inactive group. Remove it before saving."
    );
    expect(inactiveGroupTagMessage(undefined)).toMatch(/inactive group/);
  });

  describe("inactive groups (TEOS-168 follow-up)", () => {
    const TAG_OLD = "ffffffff-ffff-4fff-8fff-ffffffffffff";
    const TAG_UNUSED = "99999999-9999-4999-8999-999999999999";

    beforeEach(() => {
      // the bundle still has "Old", a tag of the inactive group "Legacy"
      bundlesAPI.getBundleById.mockResolvedValue({
        data: {
          data: {
            ...bundle,
            tags: [
              ...bundle.tags,
              {
                bundle_tag_id: 2,
                tag: {
                  id: TAG_OLD,
                  name: "Old",
                  icon: null,
                  group: { id: 5, name: "Legacy", type: 1, group_category: "country", is_active: false },
                },
              },
            ],
          },
        },
      });
      bundlesAPI.getGroupTags.mockImplementation((groupId) =>
        Promise.resolve({
          data: {
            data:
              groupId === 5
                ? [
                    { id: TAG_OLD, name: "Old", icon: null, tag_group_id: 5 },
                    { id: TAG_UNUSED, name: "Unused", icon: null, tag_group_id: 5 },
                  ]
                : groupTags[groupId] || [],
          },
        })
      );
    }, SLOW);

    it("an inactive group is listed as '(inactive)' and can't be picked", async () => {
      getGroupsLookup.mockResolvedValue({
        data: {
          data: {
            data: [
              { id: 3, label: "America", type: 1, group_category: "country", is_active: true },
              { id: 4, label: "Asia", type: 1, group_category: "country", is_active: false },
            ],
            total_count: 2,
          },
        },
      });
      renderPage();
      await screen.findByTestId("group-section-2");

      await userEvent.click(screen.getByLabelText("Groups"));
      const option = await screen.findByText("Asia (inactive)");
      expect(option.closest("[aria-disabled]")).toHaveAttribute("aria-disabled", "true");
      await userEvent.click(option);
      expect(screen.queryByTestId("group-section-4")).not.toBeInTheDocument();
    }, SLOW);

    it("a tag the bundle already has stays selected with a warning; the other tags of the group are disabled", async () => {
      renderPage();
      const section = await screen.findByTestId("group-section-5");

      expect(within(section).getByText("Legacy")).toBeInTheDocument();
      expect(within(section).getByTestId("group-inactive-warning-5")).toHaveTextContent(
        "(inactive group – this may affect the bundle's visibility)"
      );
      expect(within(section).getByText("1 / 2 selected")).toBeInTheDocument();
      expect(within(section).getByTestId(`group-tag-${TAG_UNUSED}`)).toHaveClass("Mui-disabled");
      expect(within(section).getByTestId(`group-tag-${TAG_OLD}`)).not.toHaveClass("Mui-disabled");
      // an active group has neither
      const active = screen.getByTestId("group-section-2");
      expect(within(active).queryByText(/inactive/)).not.toBeInTheDocument();
      expect(within(active).getByTestId(`group-tag-${TAG_DE}`)).not.toHaveClass("Mui-disabled");
    }, SLOW);

    it("Save is blocked while a tag of an inactive group is selected, and names it", async () => {
      renderPage();
      const section = await screen.findByTestId("group-section-2");

      await userEvent.click(within(section).getByText("Germany"));
      await userEvent.click(screen.getByRole("button", { name: "Save" }));

      expect(toast.error).toHaveBeenCalledWith(
        "“Old” belongs to an inactive group. Remove it before saving."
      );
      expect(bundlesAPI.assignTagsToBundle).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    }, SLOW);

    it("after removing the tag of the inactive group the bundle saves, and the tag can't be picked again", async () => {
      bundlesAPI.assignTagsToBundle.mockResolvedValue({ data: { data: { id: BID, tag_ids: [TAG_FR] } } });
      renderPage();
      const section = await screen.findByTestId("group-section-5");

      await userEvent.click(within(section).getByText("Old"));
      expect(within(section).getByText("0 / 2 selected")).toBeInTheDocument();
      expect(within(section).getByTestId(`group-tag-${TAG_OLD}`)).toHaveClass("Mui-disabled");
      expect(within(section).queryByTestId("group-inactive-warning-5")).not.toBeInTheDocument();
      expect(within(section).getByText("(inactive)")).toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => expect(bundlesAPI.assignTagsToBundle).toHaveBeenCalledWith(BID, [TAG_FR]));
      await waitFor(() => expect(toast.success).toHaveBeenCalled());
      expect(toast.error).not.toHaveBeenCalled();
    }, SLOW);
  });

  it("without write permission Save is disabled", async () => {
    store.dispatch(SignOut());
    signInWith([PERMISSIONS.BUNDLES_READ, PERMISSIONS.GROUPS_READ]);
    renderPage();
    await screen.findByTestId("group-section-2");

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  }, SLOW);

  it("an unknown bundle shows the invalid id message", async () => {
    bundlesAPI.getBundleById.mockRejectedValue(
      Object.assign(new Error("Not found"), { response: { status: 404 } })
    );
    renderPage();

    expect(
      await screen.findByText("Invalid ID or bundle data not loaded. Please try again")
    ).toBeInTheDocument();
  }, SLOW);
});
