import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../core/apis/axios", async (importOriginal) => ({
  // keep the real shared helpers (getApiErrorCode), mock only the HTTP client
  ...(await importOriginal()),
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import { api } from "../core/apis/axios";
import { AddBanner, editBanner, deleteBanner, getApiErrorCode } from "../core/apis/bannersAPI";
import { addVoucher, DeleteVoucher, getAllVouchers, toggleVoucherStatus } from "../core/apis/vouchersAPI";

const MULTIPART = { headers: { "Content-Type": "multipart/form-data" } };

describe("bannersAPI", () => {
  beforeEach(() => vi.clearAllMocks());

  it("AddBanner sends one multipart request with the image file", async () => {
    const image = new File(["x"], "cropped-image.jpg", { type: "image/jpeg" });
    await AddBanner({ title: "T", description: "D", platform: "web", action: "CHAT", image });

    const [url, form, config] = api.post.mock.calls[0];
    expect(url).toBe("banners");
    expect(config).toEqual(MULTIPART);
    expect(form.get("title")).toBe("T");
    expect(form.get("platform")).toBe("web");
    expect(form.get("action")).toBe("CHAT");
    expect(form.get("image")).toBeInstanceOf(File);
  });

  it("editBanner omits the image when it is the current URL and omits an empty action", async () => {
    await editBanner({ id: 3, title: "T", description: "D", platform: "web", image: "https://x/a.png" });

    const [url, form, config] = api.put.mock.calls[0];
    expect(url).toBe("banners/3");
    expect(config).toEqual(MULTIPART);
    expect(form.has("image")).toBe(false);
    expect(form.has("action")).toBe(false);
    expect(form.has("id")).toBe(false);
  });

  it("AddBanner and editBanner pass an optional upload progress callback to axios", async () => {
    const onUploadProgress = vi.fn();
    await AddBanner({ title: "T", description: "D", platform: "web" }, onUploadProgress);
    await editBanner({ id: 3, title: "New title", description: "D", platform: "web" }, onUploadProgress);

    expect(api.post.mock.calls[0][2]).toEqual({ ...MULTIPART, onUploadProgress });
    const [, form, config] = api.put.mock.calls[0];
    expect(config).toEqual({ ...MULTIPART, onUploadProgress });
    expect(form.get("title")).toBe("New title");
  });

  it("deleteBanner calls DELETE only", async () => {
    await deleteBanner(3);
    expect(api.delete).toHaveBeenCalledWith("banners/3");
  });

  it("getApiErrorCode reads the 409 code", () => {
    expect(
      getApiErrorCode({ response: { data: { developerMessage: '{"code":"duplicate_title"}' } } })
    ).toBe("duplicate_title");
    expect(getApiErrorCode({ response: { data: { developerMessage: "text" } } })).toBeNull();
    expect(getApiErrorCode(undefined)).toBeNull();
  });
});

describe("vouchersAPI", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls the admin endpoints", async () => {
    await getAllVouchers({ page: 1, page_size: 10, status: "all" });
    await addVoucher({ code: "A1", amount: 2, expired_at: "" });
    await toggleVoucherStatus({ id: 4, is_active: false });
    await DeleteVoucher(4);

    expect(api.get).toHaveBeenCalledWith("vouchers", {
      params: { page: 1, page_size: 10, status: "all" },
    });
    expect(api.post).toHaveBeenCalledWith("vouchers", { code: "A1", amount: 2, expired_at: null });
    // TEOS-136: "Generate for me" omits the code
    await addVoucher({ code: undefined, amount: 3, expired_at: "2099-01-01" });
    expect(api.post).toHaveBeenLastCalledWith("vouchers", { amount: 3, expired_at: "2099-01-01" });
    expect(api.patch).toHaveBeenCalledWith("vouchers/4/status", { is_active: false });
    expect(api.delete).toHaveBeenCalledWith("vouchers/4");
  });
});
