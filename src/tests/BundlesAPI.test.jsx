import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../core/apis/axios", async (importOriginal) => ({
  // keep the real shared helpers (getApiErrorCode), mock only the HTTP client
  ...(await importOriginal()),
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import { api } from "../core/apis/axios";
import {
  assignTagsToBundle,
  bulkBundleStatus,
  getAllBundles,
  getBundleById,
  getGroupTags,
  toggleBundleStatus,
  updateBundleTitle,
} from "../core/apis/bundlesAPI";

const BID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("bundlesAPI", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists with repeated keys for tag_ids", async () => {
    await getAllBundles({ page: 1, page_size: 10, status: "all", tag_ids: ["t1", "t2"] });

    const [url, config] = api.get.mock.calls[0];
    expect(url).toBe("bundles");
    expect(config.params).toEqual({ page: 1, page_size: 10, status: "all", tag_ids: ["t1", "t2"] });
    expect(config.paramsSerializer).toEqual({ indexes: null });
  });

  it("calls the detail, rename, status, bulk and tags endpoints", async () => {
    await getBundleById(BID);
    await updateBundleTitle({ id: BID, bundle_name: "New" });
    await toggleBundleStatus({ id: BID, is_active: false, reason: " maintenance " });
    await toggleBundleStatus({ id: BID, is_active: true, reason: "" });
    await bulkBundleStatus({ is_active: false, reason: "down" });
    await assignTagsToBundle(BID, []);
    await getGroupTags(7);

    expect(api.get).toHaveBeenCalledWith(`bundles/${BID}`);
    expect(api.patch).toHaveBeenNthCalledWith(1, `bundles/${BID}`, { bundle_name: "New" });
    expect(api.patch).toHaveBeenNthCalledWith(2, `bundles/${BID}/status`, {
      is_active: false,
      reason: "maintenance",
    });
    // no reason -> the key is left out, so the API's optional field stays null
    expect(api.patch).toHaveBeenNthCalledWith(3, `bundles/${BID}/status`, { is_active: true });
    expect(api.post).toHaveBeenCalledWith("bundles/status/bulk", { is_active: false, reason: "down" });
    expect(api.put).toHaveBeenCalledWith(`bundles/${BID}/tags`, { tag_ids: [] });
    expect(api.get).toHaveBeenCalledWith("groups/7/tags");
  });

});
