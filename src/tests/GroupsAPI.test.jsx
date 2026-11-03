import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../core/apis/axios", async (importOriginal) => ({
  // keep the real shared helpers (getApiErrorCode), mock only the HTTP client
  ...(await importOriginal()),
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import { api } from "../core/apis/axios";
import {
  addGroup,
  deleteGroup,
  editGroup,
  getAllGroups,
  getApiErrorDetails,
  getGroupById,
  getGroupTags,
  toGroupFormData,
  toggleGroupStatus,
  updateTagGroupsOrder,
} from "../core/apis/groupsAPI";

const MULTIPART = { headers: { "Content-Type": "multipart/form-data" } };
const TAG_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TAG_ID_2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ICON_URL = "https://storage.example.com/media/Regions/a.png";

describe("groupsAPI", () => {
  beforeEach(() => vi.clearAllMocks());

  it("addGroup sends one multipart request: payload JSON plus icon_<client_key> files", async () => {
    const icon = new File(["x"], "icon.png", { type: "image/png" });
    await addGroup({
      group: { name: "Regions", type: 1, group_category: "on_land" },
      tags: [
        { id: null, name: "Middle East", icon, alternative_country: ["me", "gulf"] },
        { id: null, name: "Africa", icon: null, alternative_country: [] },
      ],
      deletedTags: [],
    });

    const [url, form, config] = api.post.mock.calls[0];
    expect(url).toBe("groups");
    expect(config).toEqual(MULTIPART);
    expect(JSON.parse(form.get("payload"))).toEqual({
      name: "Regions",
      type: 1,
      group_category: "on_land",
      tags: [
        { client_key: "n0", name: "Middle East", alternative_country: ["me", "gulf"] },
        { client_key: "n1", name: "Africa", alternative_country: [] },
      ],
    });
    expect(form.get("icon_n0")).toBeInstanceOf(File);
    expect(form.has("icon_n1")).toBe(false);
    expect([...form.keys()]).toEqual(["icon_n0", "payload"]);
  });

  it("editGroup sends only changed icons, remove_icon for cleared ones and the deleted ids", async () => {
    const icon = new File(["x"], "icon.png", { type: "image/png" });
    await editGroup({
      id: 7,
      group: { name: "Regions", type: 1, group_category: "on_land" },
      tags: [
        { id: TAG_ID, name: "Middle East", icon: ICON_URL, alternative_country: "me, gulf" },
        { id: TAG_ID_2, name: "Africa", icon: null, alternative_country: [] },
        { id: null, name: "Europe", icon, alternative_country: [] },
      ],
      deletedTags: [{ id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" }],
    });

    const [url, form, config] = api.put.mock.calls[0];
    expect(url).toBe("groups/7");
    expect(config).toEqual(MULTIPART);
    expect(JSON.parse(form.get("payload"))).toEqual({
      name: "Regions",
      type: 1,
      group_category: "on_land",
      new_tags: [{ client_key: "n2", name: "Europe", alternative_country: [] }],
      updated_tags: [
        { id: TAG_ID, name: "Middle East", remove_icon: false, alternative_country: ["me", "gulf"] },
        { id: TAG_ID_2, name: "Africa", remove_icon: true, alternative_country: [] },
      ],
      deleted_tag_ids: ["cccccccc-cccc-4ccc-8ccc-cccccccccccc"],
    });
    expect(form.get("icon_n2")).toBeInstanceOf(File);
    expect(form.has(`icon_${TAG_ID}`)).toBe(false);
    expect(form.has("id")).toBe(false);
  });

  it("passes an optional onUploadProgress to the multipart create and update calls", async () => {
    const onUploadProgress = vi.fn();
    const payload = { group: { name: "Regions", type: 1, group_category: "on_land" }, tags: [] };
    await addGroup(payload, onUploadProgress);
    await editGroup({ id: 7, ...payload }, onUploadProgress);

    expect(api.post.mock.calls[0][2]).toEqual({ ...MULTIPART, onUploadProgress });
    expect(api.put.mock.calls[0][2]).toEqual({ ...MULTIPART, onUploadProgress });
  });

  it("a new icon on an existing tag is sent as icon_<tag id>", () => {
    const icon = new File(["x"], "icon.png", { type: "image/png" });
    const form = toGroupFormData(
      { group: {}, tags: [{ id: TAG_ID, name: "Middle East", icon }] },
      true
    );
    expect(form.get(`icon_${TAG_ID}`)).toBeInstanceOf(File);
    expect(JSON.parse(form.get("payload")).updated_tags[0].remove_icon).toBe(false);
  });

  it("calls the admin endpoints", async () => {
    await getAllGroups({ page: 1, page_size: 10, status: "all" });
    await getGroupById(7);
    await getGroupById(7, "mid");
    await getGroupTags(7);
    await toggleGroupStatus({ id: 7, is_active: false });
    await updateTagGroupsOrder({ id: 7, tag_ids: [TAG_ID_2, TAG_ID] });
    await deleteGroup(7);

    expect(api.get).toHaveBeenCalledWith("groups", {
      params: { page: 1, page_size: 10, status: "all" },
    });
    expect(api.get).toHaveBeenCalledWith("groups/7", { params: undefined });
    expect(api.get).toHaveBeenCalledWith("groups/7", { params: { tag_search: "mid" } });
    expect(api.get).toHaveBeenCalledWith("groups/7/tags");
    expect(api.patch).toHaveBeenCalledWith("groups/7/status", { is_active: false });
    expect(api.put).toHaveBeenCalledWith("groups/7/tags/order", { tag_ids: [TAG_ID_2, TAG_ID] });
    expect(api.delete).toHaveBeenCalledWith("groups/7");
  });

  it("getApiErrorDetails reads the whole 409 detail", () => {
    expect(
      getApiErrorDetails({
        response: { data: { developerMessage: '{"code":"linked_bundles","bundle_count":3}' } },
      })
    ).toEqual({ code: "linked_bundles", bundle_count: 3 });
    expect(getApiErrorDetails({ response: { data: { developerMessage: "text" } } })).toBeNull();
    expect(getApiErrorDetails(undefined)).toBeNull();
  });
});
