import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import { Link, Route, Routes } from "react-router-dom";
import { toast } from "react-toastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignIn, SignOut } from "../Redux/reducers/AuthReducer";
import { store } from "../Redux/store";
import { PERMISSIONS } from "../core/vairables/Permissions";
import GroupsHandle, { groupSchema, linkedBundlesMessage } from "../pages/groups/GroupsHandle";
import GroupsList from "../pages/groups/GroupsList";
import GroupsTagReorder from "../pages/groups/GroupsTagReorder";
import { act, render, screen, waitFor, within } from "./utils/test-utils";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("react-toastify", async () => {
  const actual = await vi.importActual("react-toastify");
  return {
    ...actual,
    toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  };
});

// The crop canvas does not run in jsdom (as in AvatarEditor.test.jsx).
vi.mock("react-avatar-editor", () => ({ default: () => <div data-testid="avatar-editor" /> }));

vi.mock("../core/apis/groupsAPI", async () => {
  const actual = await vi.importActual("../core/apis/groupsAPI");
  return {
    getApiErrorCode: actual.getApiErrorCode,
    getApiErrorDetails: actual.getApiErrorDetails,
    getAllGroups: vi.fn(),
    getGroupById: vi.fn(),
    addGroup: vi.fn(),
    editGroup: vi.fn(),
    deleteGroup: vi.fn(),
    toggleGroupStatus: vi.fn(),
    updateTagGroupsOrder: vi.fn(),
  };
});

import * as groupsAPI from "../core/apis/groupsAPI";

const signInWith = (permissions) =>
  store.dispatch(
    SignIn({
      access_token: "token",
      refresh_token: "refresh",
      expires_in: 3600,
      user: { id: "id", email: "a@example.com", role: "admin", permissions },
    })
  );

const TAG_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TAG_ID_2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ICON_URL = "https://storage.example.com/media/Regions/a.png";

const GROUP = {
  id: 7,
  name: "Regions",
  type: 1,
  group_category: "on_land",
  is_active: true,
  created_at: "2026-10-20T10:00:00",
  updated_at: "2026-10-20T10:00:00",
  tag_count: 2,
};

const DETAIL = {
  ...GROUP,
  tags: [
    { id: TAG_ID, name: "Middle East", icon: ICON_URL, sorting_number: 1, data: { alternative_country: "me,gulf" } },
    { id: TAG_ID_2, name: "Africa", icon: ICON_URL, sorting_number: 2, data: null },
  ],
  top_countries_count: null,
};

const listResponse = {
  data: { data: { data: [GROUP], total_count: 1, facets: { all: 1, active: 1, inactive: 0 } } },
};

const apiError = (status, developerMessage) =>
  Object.assign(new Error("Request failed"), {
    response: { status, data: developerMessage ? { developerMessage } : {} },
  });

const openRowMenu = () =>
  userEvent.click(screen.getByRole("button", { name: "Actions for Regions" }));

describe("Groups list", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/groups");
    vi.clearAllMocks();
    groupsAPI.getAllGroups.mockResolvedValue(listResponse);
  });

  afterEach(() => {
    store.dispatch(SignOut());
    vi.unstubAllEnvs();
  });

  it("loads page 1 with status=all and shows the tab counts and tag count", async () => {
    signInWith([PERMISSIONS.GROUPS_READ, PERMISSIONS.GROUPS_WRITE]);
    render(<GroupsList />);

    expect(await screen.findByText("Regions")).toBeInTheDocument();
    expect(groupsAPI.getAllGroups).toHaveBeenCalledWith({
      page: 1,
      page_size: 10,
      status: "all",
      search: undefined,
    });
    expect(await screen.findByRole("tab", { name: "Active (1)" })).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("a page past the end moves to the last valid page and replaces the URL (TEOS-286)", async () => {
    signInWith([PERMISSIONS.GROUPS_READ]);
    window.history.pushState({}, "", "/groups?pageSize=10&page=99");
    groupsAPI.getAllGroups.mockImplementation(async (params) => ({
      data: {
        data: { ...listResponse.data.data, data: params.page === 3 ? [GROUP] : [], total_count: 21 },
      },
    }));
    render(<GroupsList />);

    // two requests in a row (the empty page, then the last one): more time under load
    expect(await screen.findByText("Regions", {}, { timeout: 5000 })).toBeInTheDocument();
    expect(groupsAPI.getAllGroups).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3 }));
    // TEOS-287: the out-of-range URL is replaced, not pushed (navigate is mocked in this file)
    expect(mockNavigate).toHaveBeenLastCalledWith(
      "/groups?status=all&pageSize=10&page=2",
      expect.objectContaining({ replace: true })
    );
  });

  it("restores the Type and Category filters from the URL and sends them (TEOS-174)", async () => {
    window.history.pushState({}, "", "/groups?type=2&category=at_sea");
    signInWith([PERMISSIONS.GROUPS_READ]);
    render(<GroupsList />);

    await screen.findByText("Regions");
    expect(groupsAPI.getAllGroups).toHaveBeenCalledWith(
      expect.objectContaining({ type: 2, group_category: "at_sea", page: 1 })
    );
    expect(screen.getByDisplayValue("Flat")).toBeInTheDocument();
    expect(screen.getByDisplayValue("At Sea")).toBeInTheDocument();
  });

  it("ignores Type and Category values the API does not accept", async () => {
    window.history.pushState({}, "", "/groups?type=9&category=foo");
    signInWith([PERMISSIONS.GROUPS_READ]);
    render(<GroupsList />);

    await screen.findByText("Regions");
    const params = groupsAPI.getAllGroups.mock.calls[0][0];
    expect(params.type).toBeUndefined();
    expect(params.group_category).toBeUndefined();
  });

  it("choosing a Category and applying filters from page 1 (TEOS-174)", async () => {
    window.history.pushState({}, "", "/groups?page=2");
    signInWith([PERMISSIONS.GROUPS_READ]);
    render(<GroupsList />);
    await screen.findByText("Regions");

    await userEvent.click(screen.getByPlaceholderText("Select Category"));
    await userEvent.click(await screen.findByRole("option", { name: "On Land" }));
    await userEvent.click(screen.getByRole("button", { name: /apply/i }));

    await waitFor(() =>
      expect(groupsAPI.getAllGroups).toHaveBeenLastCalledWith(
        expect.objectContaining({ group_category: "on_land", page: 1 })
      )
    );
  });

  it("the status switch asks for confirmation (no reason), then PATCHes the opposite state and refreshes", async () => {
    signInWith([PERMISSIONS.GROUPS_READ, PERMISSIONS.GROUPS_WRITE]);
    groupsAPI.toggleGroupStatus.mockResolvedValue({ data: { data: { id: 7, is_active: false } } });
    render(<GroupsList />);
    await screen.findByText("Regions");

    await userEvent.click(screen.getByRole("checkbox", { name: "status of Regions" }));
    expect(screen.getByText(/Are you sure you want to deactivate/)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(groupsAPI.toggleGroupStatus).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Deactivate" }));

    expect(groupsAPI.toggleGroupStatus).toHaveBeenCalledWith({ id: 7, is_active: false });
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    await waitFor(() => expect(groupsAPI.getAllGroups).toHaveBeenCalledTimes(2));
  });

  it("delete calls the API only and refreshes the list", async () => {
    signInWith([PERMISSIONS.GROUPS_READ, PERMISSIONS.GROUPS_WRITE]);
    groupsAPI.deleteGroup.mockResolvedValue({ status: 204 });
    render(<GroupsList />);
    await screen.findByText("Regions");

    await openRowMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: /^Delete/ }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

    expect(groupsAPI.deleteGroup).toHaveBeenCalledWith(7);
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    await waitFor(() => expect(groupsAPI.getAllGroups).toHaveBeenCalledTimes(2));
  });

  it("409 linked_bundles on delete opens the notice with the bundle count", async () => {
    signInWith([PERMISSIONS.GROUPS_READ, PERMISSIONS.GROUPS_WRITE]);
    groupsAPI.deleteGroup.mockRejectedValue(
      apiError(409, JSON.stringify({ code: "linked_bundles", bundle_count: 3 }))
    );
    render(<GroupsList />);
    await screen.findByText("Regions");

    await openRowMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: /^Delete/ }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

    expect(await screen.findByText(/linked to 3 bundles/)).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("shows a Bundles column next to Tags with bundle_count (TEOS-173)", async () => {
    groupsAPI.getAllGroups.mockResolvedValue({
      data: { data: { data: [{ ...GROUP, bundle_count: 5 }], total_count: 1, facets: { all: 1, active: 1, inactive: 0 } } },
    });
    signInWith([PERMISSIONS.GROUPS_READ]);
    render(<GroupsList />);
    await screen.findByText("Regions");

    const headers = screen.getAllByRole("columnheader").map((cell) => cell.textContent);
    expect(headers.indexOf("Bundles")).toBe(headers.indexOf("Tags") + 1);
    const row = screen.getByText("Regions").closest("tr");
    const cells = within(row).getAllByRole("cell").map((cell) => cell.textContent);
    expect(cells[headers.indexOf("Tags")]).toBe("2");
    expect(cells[headers.indexOf("Bundles")]).toBe("5");
  });

  it("the delete confirmation mentions the bundles using the group (TEOS-173)", async () => {
    groupsAPI.getAllGroups.mockResolvedValue({
      data: { data: { data: [{ ...GROUP, bundle_count: 1 }], total_count: 1, facets: { all: 1, active: 1, inactive: 0 } } },
    });
    signInWith([PERMISSIONS.GROUPS_READ, PERMISSIONS.GROUPS_WRITE]);
    render(<GroupsList />);
    await screen.findByText("Regions");

    await openRowMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: /^Delete/ }));
    expect(screen.getByText(/It is used by 1 bundle, so/)).toBeInTheDocument();
  });

  it("without write permission there is no add, edit, delete or reorder and the switch is disabled", async () => {
    signInWith([PERMISSIONS.GROUPS_READ]);
    render(<GroupsList />);
    await screen.findByText("Regions");

    expect(screen.queryByRole("button", { name: "Add" })).not.toBeInTheDocument();
    // no action is allowed, so the row has no ⋯ menu at all
    expect(screen.queryByRole("button", { name: "Actions for Regions" })).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "status of Regions" })).toBeDisabled();
  });

  it("the row ⋯ menu lists Edit, Reorder tags and Delete, each with its description line (TEOS-177)", async () => {
    vi.stubEnv("VITE_GROUP_TAG_ORDERING", "true");
    signInWith([PERMISSIONS.GROUPS_READ, PERMISSIONS.GROUPS_WRITE]);
    render(<GroupsList />);
    await screen.findByText("Regions");

    await openRowMenu();
    const items = screen.getAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "EditChange the group's name, type and tags",
      "Reorder tagsSet the order tags appear in the app",
      "DeleteRemove the group and its tags (only when no bundle uses it)",
    ]);

    await userEvent.click(screen.getByRole("menuitem", { name: /^Reorder tags/ }));
    expect(mockNavigate).toHaveBeenCalledWith("/groups/7/reorder");
  });

  it("Edit in the row menu opens the group", async () => {
    signInWith([PERMISSIONS.GROUPS_READ, PERMISSIONS.GROUPS_WRITE]);
    render(<GroupsList />);
    await screen.findByText("Regions");

    await openRowMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: /^Edit/ }));
    expect(mockNavigate).toHaveBeenCalledWith("/groups/7");
  });

  it("cancelling the status confirmation changes nothing", async () => {
    signInWith([PERMISSIONS.GROUPS_READ, PERMISSIONS.GROUPS_WRITE]);
    render(<GroupsList />);
    await screen.findByText("Regions");

    await userEvent.click(screen.getByRole("checkbox", { name: "status of Regions" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByText(/Are you sure you want to deactivate/)).not.toBeInTheDocument();
    expect(groupsAPI.toggleGroupStatus).not.toHaveBeenCalled();
    expect(screen.getByRole("checkbox", { name: "status of Regions" })).toBeChecked();
  });

  it("the Add button sits above the status tabs", async () => {
    signInWith([PERMISSIONS.GROUPS_READ, PERMISSIONS.GROUPS_WRITE]);
    render(<GroupsList />);
    await screen.findByText("Regions");

    const add = screen.getByRole("button", { name: "Add" });
    const tabs = screen.getByRole("tablist", { name: "Group status" });
    expect(add.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("the status column shows an Active / Inactive label next to the switch (TEOS-178)", async () => {
    signInWith([PERMISSIONS.GROUPS_READ, PERMISSIONS.GROUPS_WRITE]);
    groupsAPI.getAllGroups.mockResolvedValue({
      data: {
        data: {
          data: [GROUP, { ...GROUP, id: 8, name: "Old", is_active: false }],
          total_count: 2,
          facets: { all: 2, active: 1, inactive: 1 },
        },
      },
    });
    render(<GroupsList />);
    await screen.findByText("Regions");

    const regionsRow = screen.getByText("Regions").closest("tr");
    const oldRow = screen.getByText("Old").closest("tr");
    expect(within(regionsRow).getByText("Active")).toBeInTheDocument();
    expect(within(oldRow).getByText("Inactive")).toBeInTheDocument();
  });

  it("while the delete runs, Confirm and Cancel are disabled and Confirm reads 'Deleting...' (TEOS-179)", async () => {
    signInWith([PERMISSIONS.GROUPS_READ, PERMISSIONS.GROUPS_WRITE]);
    let finish;
    groupsAPI.deleteGroup.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    render(<GroupsList />);
    await screen.findByText("Regions");

    await openRowMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: /^Delete/ }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

    const confirm = await screen.findByRole("button", { name: "Deleting..." });
    expect(confirm).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(groupsAPI.deleteGroup).toHaveBeenCalledTimes(1);

    finish({ status: 204 });
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Deleting..." })).not.toBeInTheDocument()
    );
  });
});

describe("Group edit page", () => {
  // withNav: the header Back arrow (data-leave-target, as in AuthLayout) and a sidebar link
  const renderEdit = ({ withNav = false } = {}) => {
    window.history.pushState({}, "", "/groups/7");
    return render(
      <>
        {withNav && (
          <>
            <button type="button" aria-label="Back" data-leave-target="/groups" />
            <Link to="/bundles">Bundles sidebar</Link>
          </>
        )}
        <Routes>
          <Route path="/groups/:id" element={<GroupsHandle />} />
        </Routes>
      </>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    groupsAPI.getGroupById.mockResolvedValue({ data: { data: DETAIL } });
    signInWith([PERMISSIONS.GROUPS_READ, PERMISSIONS.GROUPS_WRITE]);
  });

  afterEach(() => store.dispatch(SignOut()));

  it("loads the group and saves in one request with the existing tags and icons kept", async () => {
    groupsAPI.editGroup.mockResolvedValue({ data: { data: DETAIL } });
    renderEdit();

    expect(await screen.findByDisplayValue("Regions")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Middle East")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(groupsAPI.editGroup).toHaveBeenCalledTimes(1));
    expect(groupsAPI.editGroup).toHaveBeenCalledWith({
      id: "7",
      group: { name: "Regions", type: 1, group_category: "on_land" },
      tags: [
        { id: TAG_ID, name: "Middle East", icon: ICON_URL, alternative_country: ["me", "gulf"] },
        { id: TAG_ID_2, name: "Africa", icon: ICON_URL, alternative_country: [] },
      ],
      deletedTags: [],
    }, expect.any(Function));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    // TEOS-189: back to the list, not one step back in the browser history
    expect(mockNavigate).toHaveBeenCalledWith("/groups");
    expect(mockNavigate).not.toHaveBeenCalledWith(-1);
  });

  it("two tags whose names only differ by case are refused before any request (TEOS-186)", async () => {
    renderEdit();
    const africa = await screen.findByDisplayValue("Africa");

    await userEvent.clear(africa);
    await userEvent.type(africa, "middle EAST ");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect((await screen.findAllByText("Tag name is not unique")).length).toBe(2);
    expect(groupsAPI.editGroup).not.toHaveBeenCalled();
  });

  it("a tag name of 61 characters is refused, 60 is fine (TEOS-185)", async () => {
    groupsAPI.editGroup.mockResolvedValue({ data: { data: DETAIL } });
    renderEdit();
    const africa = await screen.findByDisplayValue("Africa");

    await userEvent.clear(africa);
    await userEvent.type(africa, "y".repeat(61));
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByText(/at most 60 characters/)).toBeInTheDocument();
    expect(groupsAPI.editGroup).not.toHaveBeenCalled();

    await userEvent.type(africa, "{backspace}");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(groupsAPI.editGroup).toHaveBeenCalledTimes(1));
  });

  it("a 413 shows the API's message, like any other error (TEOS-191)", async () => {
    const message = "At most 200 new icons can be uploaded in one save.";
    // error.message as the axios instance sets it from the API's message
    groupsAPI.editGroup.mockRejectedValue(
      Object.assign(new Error(message), { response: { status: 413, data: { message } } })
    );
    renderEdit();
    await screen.findByDisplayValue("Regions");

    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(message));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("while saving, Submit stays disabled and the upload progress is shown", async () => {
    let finish;
    groupsAPI.editGroup.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    renderEdit();
    await screen.findByDisplayValue("Regions");

    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(groupsAPI.editGroup).toHaveBeenCalledTimes(1));
    const onUploadProgress = groupsAPI.editGroup.mock.calls[0][1];
    expect(onUploadProgress).toEqual(expect.any(Function));
    expect(screen.getByRole("button", { name: "Submitting..." })).toBeDisabled();
    expect(screen.getByRole("progressbar", { name: "save progress" })).toHaveAttribute(
      "aria-valuenow",
      "0"
    );

    act(() => onUploadProgress({ loaded: 50, total: 100 }));
    expect(screen.getByRole("progressbar", { name: "save progress" })).toHaveAttribute(
      "aria-valuenow",
      "50"
    );
    expect(screen.getByText("50%")).toBeInTheDocument();

    await act(async () => finish({ data: { data: DETAIL } }));
    await waitFor(() =>
      expect(screen.queryByRole("progressbar", { name: "save progress" })).not.toBeInTheDocument()
    );
  });

  it("leaving with unsaved changes asks for confirmation, and Leave goes back", async () => {
    renderEdit();
    await screen.findByDisplayValue("Regions");

    await userEvent.type(screen.getByDisplayValue("Regions"), "X");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(await screen.findByText(/Leave without saving/)).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Leave" }));
    expect(mockNavigate).toHaveBeenCalledWith("/groups");
  });

  it("removing a tag counts as an unsaved change", async () => {
    renderEdit();
    await screen.findByDisplayValue("Regions");

    await userEvent.click(screen.getAllByRole("button", { name: "remove tag" })[1]);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(await screen.findByText(/Leave without saving/)).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("leaving a clean form goes back without asking", async () => {
    renderEdit();
    await screen.findByDisplayValue("Regions");

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(mockNavigate).toHaveBeenCalledWith("/groups");
    expect(screen.queryByText(/Leave without saving/)).not.toBeInTheDocument();
  });

  it("removing a tag sends its id in deletedTags", async () => {
    groupsAPI.editGroup.mockResolvedValue({ data: { data: DETAIL } });
    renderEdit();
    await screen.findByDisplayValue("Regions");

    await userEvent.click(screen.getAllByRole("button", { name: "remove tag" })[1]);
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(groupsAPI.editGroup).toHaveBeenCalledTimes(1));
    const sent = groupsAPI.editGroup.mock.calls[0][0];
    expect(sent.deletedTags).toEqual([{ id: TAG_ID_2 }]);
    expect(sent.tags.map((tag) => tag.id)).toEqual([TAG_ID]);
  });

  it("409 duplicate_group_name lands on the name field, without any pre-check request", async () => {
    groupsAPI.editGroup.mockRejectedValue(
      apiError(409, JSON.stringify({ code: "duplicate_group_name" }))
    );
    renderEdit();
    await screen.findByDisplayValue("Regions");

    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("Name is not unique")).toBeInTheDocument();
    expect(groupsAPI.getAllGroups).not.toHaveBeenCalled();
  });

  it("409 duplicate_tag_name lands on the tag name field", async () => {
    groupsAPI.editGroup.mockRejectedValue(
      apiError(409, JSON.stringify({ code: "duplicate_tag_name" }))
    );
    renderEdit();
    await screen.findByDisplayValue("Regions");

    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("Tag name is not unique")).toBeInTheDocument();
  });

  it("409 linked_bundles restores the removed tags and names them (TEOS-196)", async () => {
    groupsAPI.editGroup.mockRejectedValue(
      apiError(409, JSON.stringify({
        code: "linked_bundles",
        bundle_count: 2,
        tag_ids: [TAG_ID_2],
        tags: [{ id: TAG_ID_2, name: "Africa" }],
      }))
    );
    renderEdit();
    await screen.findByDisplayValue("Regions");

    await userEvent.click(screen.getAllByRole("button", { name: "remove tag" })[1]);
    expect(screen.queryByDisplayValue("Africa")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("“Africa” is used by 2 bundles and can't be removed.")
    );
    expect(await screen.findByDisplayValue("Africa")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Middle East")).toBeInTheDocument();

    // the restored tag is an existing tag again, no longer deleted
    groupsAPI.editGroup.mockResolvedValue({ data: { data: DETAIL } });
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(groupsAPI.editGroup).toHaveBeenCalledTimes(2));
    const sent = groupsAPI.editGroup.mock.calls[1][0];
    expect(sent.deletedTags).toEqual([]);
    expect(sent.tags).toContainEqual({ id: TAG_ID_2, name: "Africa", icon: ICON_URL, alternative_country: [] });
  });

  it("linkedBundlesMessage lists several tags and falls back without tags (TEOS-196)", () => {
    expect(
      linkedBundlesMessage({ bundle_count: 1, tags: [{ id: "a", name: "a3" }] })
    ).toBe("“a3” is used by 1 bundle and can't be removed.");
    expect(
      linkedBundlesMessage({ bundle_count: 4, tags: [{ id: "a", name: "a3" }, { id: "b", name: "b4" }] })
    ).toBe("“a3”, “b4” are used by 4 bundles and can't be removed.");
    expect(linkedBundlesMessage({ code: "linked_bundles", bundle_count: 3 })).toBe(
      "A removed tag is linked to 3 bundle(s). Unlink them before removing it."
    );
  });

  it("an unknown id shows the not-loaded message", async () => {
    groupsAPI.getGroupById.mockRejectedValue(apiError(404));
    renderEdit();

    expect(
      await screen.findByText("Invalid ID or group data not loaded. Please try again")
    ).toBeInTheDocument();
  });

  it("shows a form-shaped skeleton until the group is loaded into the form", async () => {
    let finish;
    groupsAPI.getGroupById.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    renderEdit();

    expect(screen.getByTestId("groups-handle-skeleton")).toBeInTheDocument();
    expect(screen.getAllByTestId("groups-handle-skeleton-tag").length).toBeGreaterThan(0);
    expect(screen.queryByPlaceholderText("Enter Name")).not.toBeInTheDocument();

    await act(async () => finish({ data: { data: DETAIL } }));

    expect(await screen.findByDisplayValue("Regions")).toBeInTheDocument();
    expect(screen.queryByTestId("groups-handle-skeleton")).not.toBeInTheDocument();
  });

  describe("limits of the API (TEOS-191, TEOS-192)", () => {
    const values = (tags) => ({
      name: "Regions",
      type: { id: 1, enum: "group" },
      group_category: { id: "on_land" },
      tags,
    });
    const tag = (index, extra = {}) => ({
      tag_id: `id-${index}`,
      name: `Tag ${index}`,
      icon: ICON_URL,
      search_keyword: [],
      ...extra,
    });
    const messagesOf = (formValues) =>
      groupSchema
        .validate(formValues, { abortEarly: false })
        .then(() => [])
        .catch((error) => error.errors);

    it("at most 500 tags", async () => {
      const many = (count) => Array.from({ length: count }, (_, index) => tag(index));
      expect(await messagesOf(values(many(500)))).toEqual([]);
      expect(await messagesOf(values(many(501)))).toContain("A group can have at most 500 tags");
    });

    it("the new icons together stay under the 50 MB form limit (TEOS-188)", async () => {
      const icon = () => new Blob([new Uint8Array(1024 * 1024)], { type: "image/png" });
      const message =
        "The new icons are too large together (at most 50 MB in one save); save the group with fewer new icons, then add the rest";
      const withIcons = (count) =>
        Array.from({ length: count }, (_, index) => tag(index, { icon: icon() }));

      expect(await messagesOf(values(withIcons(49)))).toEqual([]);
      expect(await messagesOf(values(withIcons(50)))).toContain(message);
    });

    it("a tag name of only spaces is refused in a regular group (TEOS-192)", async () => {
      expect(await messagesOf(values([tag(0, { name: "   " })]))).toContain(
        "Name cannot be only spaces"
      );
      expect(await messagesOf(values([tag(0, { name: " Gulf " })]))).toEqual([]);
    });

    it("a search keyword cannot be blank", async () => {
      expect(await messagesOf(values([tag(0, { search_keyword: ["gulf", "   "] })]))).toContain(
        "Search keywords cannot be blank"
      );
      expect(await messagesOf(values([tag(0, { search_keyword: ["gulf"] })]))).toEqual([]);
    });

    it("an icon is required for a new tag only (TEOS-195)", async () => {
      expect(await messagesOf(values([tag(0, { icon: null })]))).toEqual([]);
      expect(await messagesOf(values([tag(0, { tag_id: null, icon: null })]))).toContain(
        "Icon is a required field"
      );
    });
  });

  it("a new tag without an icon is refused before any request (TEOS-195)", async () => {
    renderEdit();
    await screen.findByDisplayValue("Regions");

    await userEvent.click(screen.getByRole("button", { name: "Add tag" }));
    const names = screen.getAllByPlaceholderText("Enter Name");
    await userEvent.type(names[names.length - 1], "Asia");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("Icon is a required field")).toBeInTheDocument();
    expect(groupsAPI.editGroup).not.toHaveBeenCalled();
  });

  it("clearing the icon of an existing tag saves with remove_icon: true (TEOS-195)", async () => {
    groupsAPI.editGroup.mockResolvedValue({ data: { data: DETAIL } });
    renderEdit();
    await screen.findByDisplayValue("Regions");

    await userEvent.click(screen.getAllByRole("button", { name: /a\.png/ })[0]);
    await userEvent.click(screen.getByTestId("DeleteIcon").closest("button"));
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(groupsAPI.editGroup).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("Icon is a required field")).not.toBeInTheDocument();
    const { id, ...sent } = groupsAPI.editGroup.mock.calls[0][0];
    expect(id).toBe("7");
    expect(sent.tags[0]).toMatchObject({ id: TAG_ID, icon: null });

    const { toGroupFormData } = await vi.importActual("../core/apis/groupsAPI");
    const payload = JSON.parse(toGroupFormData(sent, true).get("payload"));
    expect(payload.updated_tags).toEqual([
      expect.objectContaining({ id: TAG_ID, remove_icon: true }),
      expect.objectContaining({ id: TAG_ID_2, remove_icon: false }),
    ]);
  });

  it("the header Back arrow asks first when the form changed (TEOS-193)", async () => {
    renderEdit({ withNav: true });
    await screen.findByDisplayValue("Regions");

    await userEvent.type(screen.getByDisplayValue("Regions"), "X");
    await userEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(await screen.findByText(/Leave without saving/)).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Leave" }));
    expect(mockNavigate).toHaveBeenCalledWith("/groups");
  });

  it("a sidebar link asks first when the form changed (TEOS-193)", async () => {
    renderEdit({ withNav: true });
    await screen.findByDisplayValue("Regions");

    await userEvent.type(screen.getByDisplayValue("Regions"), "X");
    await userEvent.click(screen.getByRole("link", { name: "Bundles sidebar" }));

    expect(await screen.findByText(/Leave without saving/)).toBeInTheDocument();
    expect(window.location.pathname).toBe("/groups/7");
    await userEvent.click(screen.getByRole("button", { name: "Leave" }));
    expect(mockNavigate).toHaveBeenCalledWith("/bundles");
  });

  it("a clean form leaves by a sidebar link without asking", async () => {
    renderEdit({ withNav: true });
    await screen.findByDisplayValue("Regions");

    await userEvent.click(screen.getByRole("link", { name: "Bundles sidebar" }));

    expect(screen.queryByText(/Leave without saving/)).not.toBeInTheDocument();
    expect(window.location.pathname).toBe("/bundles");
  });

  it("after a successful save nothing asks before leaving (TEOS-193)", async () => {
    groupsAPI.editGroup.mockResolvedValue({ data: { data: DETAIL } });
    renderEdit({ withNav: true });
    await screen.findByDisplayValue("Regions");

    await userEvent.type(screen.getByDisplayValue("Regions"), "X");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/groups"));
    expect(screen.queryByText(/Leave without saving/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.queryByText(/Leave without saving/)).not.toBeInTheDocument();
  });

  it("without write permission the form is read-only", async () => {
    store.dispatch(SignOut());
    signInWith([PERMISSIONS.GROUPS_READ]);
    renderEdit();
    await screen.findByDisplayValue("Regions");

    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
  });
});

describe("Group tag reorder page", () => {
  const TAG_ID_3 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const ASIA = { id: TAG_ID_3, name: "Asia", icon: ICON_URL, sorting_number: 3, data: null };

  const renderReorder = ({ withLink = false } = {}) => {
    window.history.pushState({}, "", "/groups/7/reorder");
    return render(
      <>
        {withLink && <Link to="/groups">Groups sidebar</Link>}
        <Routes>
          <Route path="/groups/:id/reorder" element={<GroupsTagReorder />} />
        </Routes>
      </>
    );
  };

  const rowNames = () =>
    screen
      .getAllByRole("listitem")
      .map((row) => within(row).getByText(/^(Middle East|Africa|Asia)$/).textContent);

  const saveButton = () => screen.getByRole("button", { name: "Save" });

  beforeEach(() => {
    vi.clearAllMocks();
    groupsAPI.getGroupById.mockResolvedValue({ data: { data: DETAIL } });
    signInWith([PERMISSIONS.GROUPS_READ, PERMISSIONS.GROUPS_WRITE]);
  });

  afterEach(() => store.dispatch(SignOut()));

  it("sends the ordered tag ids only, and shows top_countries_count from the group", async () => {
    groupsAPI.getGroupById.mockResolvedValue({
      data: { data: { ...DETAIL, name: "Countries", top_countries_count: 12 } },
    });
    groupsAPI.updateTagGroupsOrder.mockResolvedValue({ data: { data: { tag_ids: [TAG_ID_2, TAG_ID] } } });
    renderReorder();

    expect(await screen.findByText("Middle East")).toBeInTheDocument();
    expect(screen.getByText(/first 12 countries/)).toBeInTheDocument();
    expect(groupsAPI.getGroupById).toHaveBeenCalledWith("7");

    await userEvent.click(screen.getByRole("button", { name: "move Africa to top" }));
    await userEvent.click(saveButton());

    await waitFor(() => expect(groupsAPI.updateTagGroupsOrder).toHaveBeenCalledTimes(1));
    expect(groupsAPI.updateTagGroupsOrder).toHaveBeenCalledWith({ id: "7", tag_ids: [TAG_ID_2, TAG_ID] });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Tag Reordered successfully"));
  });

  it("Save is disabled until the order changes, with Nothing to save shown (TEOS-202)", async () => {
    renderReorder();
    await screen.findByText("Middle East");

    expect(saveButton()).toBeDisabled();
    expect(screen.getByText("Nothing to save")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "move Africa to top" }));
    expect(saveButton()).toBeEnabled();
    expect(screen.queryByText("Nothing to save")).not.toBeInTheDocument();

    // moving it back gives the loaded order again: nothing to save
    await userEvent.click(screen.getByRole("button", { name: "move Middle East to top" }));
    expect(saveButton()).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "sort alphabetically" }));
    expect(rowNames()).toEqual(["Africa", "Middle East"]);
    expect(saveButton()).toBeEnabled();
    expect(groupsAPI.updateTagGroupsOrder).not.toHaveBeenCalled();
  });

  it("Reset restores the loaded order without any request (TEOS-205)", async () => {
    renderReorder();
    await screen.findByText("Middle East");
    const reset = screen.getByRole("button", { name: "Reset" });
    expect(reset).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "move Africa to top" }));
    expect(rowNames()).toEqual(["Africa", "Middle East"]);
    expect(reset).toBeEnabled();

    await userEvent.click(reset);
    expect(rowNames()).toEqual(["Middle East", "Africa"]);
    expect(reset).toBeDisabled();
    expect(saveButton()).toBeDisabled();
    expect(groupsAPI.updateTagGroupsOrder).not.toHaveBeenCalled();
    expect(groupsAPI.getGroupById).toHaveBeenCalledTimes(1);
  });

  it("the search highlights matching tags and never hides any (TEOS-203)", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    renderReorder();
    await screen.findByText("Middle East");
    const search = screen.getByPlaceholderText("Search tags by name");

    await userEvent.type(search, "afr");
    expect(rowNames()).toEqual(["Middle East", "Africa"]);
    const [middleEast, africa] = screen.getAllByRole("listitem");
    expect(africa).toHaveAttribute("data-highlighted", "true");
    expect(middleEast).toHaveAttribute("data-highlighted", "false");
    expect(scrollIntoView).toHaveBeenCalled();
    // still reorderable while searching
    await userEvent.click(screen.getByRole("button", { name: "move Africa to top" }));
    expect(rowNames()).toEqual(["Africa", "Middle East"]);

    await userEvent.clear(search);
    await userEvent.type(search, "zzz");
    expect(rowNames()).toEqual(["Africa", "Middle East"]);
    expect(screen.getByText("No match")).toBeInTheDocument();
    expect(screen.queryByText("No Tags Found")).not.toBeInTheDocument();
    delete Element.prototype.scrollIntoView;
  });

  it("Cancel goes to /groups, and asks first when the order changed (TEOS-204)", async () => {
    renderReorder();
    await screen.findByText("Middle East");

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mockNavigate).toHaveBeenCalledWith("/groups");
    mockNavigate.mockClear();

    await userEvent.click(screen.getByRole("button", { name: "move Africa to top" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await screen.findByText(/Leave without saving/)).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Leave" }));
    expect(mockNavigate).toHaveBeenCalledWith("/groups");
    expect(mockNavigate).not.toHaveBeenCalledWith(-1);
  });

  it("an in-app link is held while the order changed (TEOS-204)", async () => {
    renderReorder({ withLink: true });
    await screen.findByText("Middle East");

    await userEvent.click(screen.getByRole("button", { name: "move Africa to top" }));
    await userEvent.click(screen.getByRole("link", { name: "Groups sidebar" }));

    expect(await screen.findByText(/Leave without saving/)).toBeInTheDocument();
    expect(window.location.pathname).toBe("/groups/7/reorder");

    await userEvent.click(screen.getByRole("button", { name: "Leave" }));
    expect(mockNavigate).toHaveBeenCalledWith("/groups");
  });

  it("after Save the page stays and shows the order the API returned (TEOS-207)", async () => {
    // the server stored another order (last writer wins)
    groupsAPI.updateTagGroupsOrder.mockResolvedValue({ data: { data: { tag_ids: [TAG_ID, TAG_ID_2] } } });
    renderReorder();
    await screen.findByText("Middle East");

    await userEvent.click(screen.getByRole("button", { name: "move Africa to top" }));
    await userEvent.click(saveButton());

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Tag Reordered successfully"));
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(rowNames()).toEqual(["Middle East", "Africa"]);
    expect(saveButton()).toBeDisabled();
    expect(screen.getByText("Nothing to save")).toBeInTheDocument();
  });

  it.each([
    ["incomplete_order", 422, JSON.stringify({ code: "incomplete_order", missing_tag_ids: [TAG_ID_3] })],
    ["tag_not_in_group", 422, JSON.stringify({ code: "tag_not_in_group", tag_ids: [TAG_ID_2] })],
    ["a 409 with incomplete_order", 409, JSON.stringify({ code: "incomplete_order" })],
  ])("a stale tag set (%s) offers a Reload of the current tags (TEOS-206)", async (_, status, developerMessage) => {
    groupsAPI.updateTagGroupsOrder.mockRejectedValue(apiError(status, developerMessage));
    renderReorder();
    await screen.findByText("Middle East");

    await userEvent.click(screen.getByRole("button", { name: "move Africa to top" }));
    await userEvent.click(saveButton());

    expect(await screen.findByText("Tags changed since you opened this page")).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();

    groupsAPI.getGroupById.mockResolvedValue({ data: { data: { ...DETAIL, tags: [...DETAIL.tags, ASIA] } } });
    await userEvent.click(screen.getByRole("button", { name: "Reload" }));

    expect(await screen.findByText("Asia")).toBeInTheDocument();
    expect(groupsAPI.getGroupById).toHaveBeenCalledTimes(2);
    expect(rowNames()).toEqual(["Middle East", "Africa", "Asia"]);
    expect(screen.queryByText("Tags changed since you opened this page")).not.toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
  });

  it("a failed save keeps the page and shows the API message", async () => {
    groupsAPI.updateTagGroupsOrder.mockRejectedValue(
      Object.assign(new Error("Something went wrong"), {
        response: { status: 500, data: { developerMessage: "db_down" } },
      })
    );
    renderReorder();
    await screen.findByText("Middle East");

    await userEvent.click(screen.getByRole("button", { name: "move Africa to top" }));
    await userEvent.click(saveButton());

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Something went wrong"));
    expect(toast.error).not.toHaveBeenCalledWith("db_down");
    expect(screen.getByText("Middle East")).toBeInTheDocument();
    expect(screen.queryByText("Tags changed since you opened this page")).not.toBeInTheDocument();
    expect(saveButton()).toBeEnabled();
  });

  it("on the Countries group a divider stays after the first top_countries_count tags (TEOS-208)", async () => {
    groupsAPI.getGroupById.mockResolvedValue({
      data: { data: { ...DETAIL, name: "Countries", tags: [...DETAIL.tags, ASIA], top_countries_count: 1 } },
    });
    renderReorder();
    await screen.findByText("Middle East");

    const dividerFollows = (row) =>
      !!(
        row.compareDocumentPosition(screen.getByTestId("top-countries-divider")) &
        Node.DOCUMENT_POSITION_FOLLOWING
      );
    const assertDividerAfterFirst = () => {
      const rows = screen.getAllByRole("listitem");
      expect(dividerFollows(rows[0])).toBe(true);
      expect(dividerFollows(rows[1])).toBe(false);
    };

    expect(screen.getByText("Top countries limit (1)")).toBeInTheDocument();
    expect(screen.getByText(/rest appear after “View All”/)).toBeInTheDocument();
    assertDividerAfterFirst();

    await userEvent.click(screen.getByRole("button", { name: "move Asia to top" }));
    expect(rowNames()).toEqual(["Asia", "Middle East", "Africa"]);
    assertDividerAfterFirst();
  });

  it("no divider without top_countries_count", async () => {
    renderReorder();
    await screen.findByText("Middle East");
    expect(screen.queryByTestId("top-countries-divider")).not.toBeInTheDocument();
  });

  it.each([404, 422])("an unknown group (%s) is Group not found with a way back (TEOS-209)", async (status) => {
    groupsAPI.getGroupById.mockRejectedValue(apiError(status));
    renderReorder();

    expect(await screen.findByText("Group not found")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Groups" })).toHaveAttribute("href", "/groups");
    expect(screen.queryByText(/try again/)).not.toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("a group without tags shows the empty state and never sends an order (TEOS-198)", async () => {
    groupsAPI.getGroupById.mockResolvedValue({ data: { data: { ...DETAIL, tags: [] } } });
    renderReorder();

    expect(await screen.findByText("No Tags Found")).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
    expect(groupsAPI.updateTagGroupsOrder).not.toHaveBeenCalled();
  });

  it("a server error keeps the retry message", async () => {
    groupsAPI.getGroupById.mockRejectedValue(apiError(500));
    renderReorder();

    expect(await screen.findByText("Unable to fetch group tags. Please try again")).toBeInTheDocument();
    expect(screen.queryByText("Group not found")).not.toBeInTheDocument();
  });
});
