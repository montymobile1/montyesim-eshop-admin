import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../core/apis/axios", async (importOriginal) => ({
  // keep the real shared helpers (getApiErrorCode), mock only the HTTP client
  ...(await importOriginal()),
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import { api } from "../core/apis/axios";
import {
  exportFileName,
  exportReferrals,
  getAllReferrals,
  getReferralsFilterUser,
  readExportError,
} from "../core/apis/referralsAPI";

describe("referralsAPI", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getAllReferrals calls GET /referrals with the page and the non-empty filters", async () => {
    await getAllReferrals({
      page: 2,
      page_size: 25,
      user_id: "u1",
      search: " abc ",
      from_email: "",
      date: undefined,
    });

    expect(api.get).toHaveBeenCalledWith("referrals", {
      params: {
        page: 2,
        page_size: 25,
        user_id: "u1",
        search: "abc",
        from_email: undefined,
        date: undefined,
      },
    });
  });

  it("exportReferrals posts the filters and asks for a blob", async () => {
    await exportReferrals({ search: "abc", date: "2026-10-20" });

    expect(api.post).toHaveBeenCalledWith(
      "referrals/export",
      { user_id: undefined, search: "abc", from_email: undefined, date: "2026-10-20" },
      { responseType: "blob" }
    );
  });

  it("getReferralsFilterUser reads one user from the lookup by id", async () => {
    await getReferralsFilterUser("u1");
    expect(api.get).toHaveBeenCalledWith("users/lookup", { params: { id: "u1" } });
  });

  it("exportFileName is a dated xlsx name", () => {
    expect(exportFileName(new Date(2026, 9, 21, 12, 30, 45))).toBe(
      "referrals-2026-10-21-123045.xlsx"
    );
  });

  it("readExportError parses a JSON body carried as a Blob", async () => {
    const body = JSON.stringify({
      message: "Validation failed",
      developerMessage: JSON.stringify({ code: "too_many_rows", total: 9, cap: 5 }),
    });
    const blob = { text: () => Promise.resolve(body) };

    await expect(
      readExportError({ response: { status: 422, data: blob } })
    ).resolves.toEqual({ status: 422, code: "too_many_rows", message: "Validation failed" });
  });

  it("readExportError handles plain bodies, unreadable blobs and network errors", async () => {
    await expect(
      readExportError({
        response: { status: 403, data: { message: "Forbidden", developerMessage: "admin.referrals.export" } },
      })
    ).resolves.toEqual({ status: 403, code: null, message: "Forbidden" });

    await expect(
      readExportError({
        message: "Network Error",
        response: { status: 502, data: { text: () => Promise.resolve("<html>") } },
      })
    ).resolves.toEqual({ status: 502, code: null, message: "Network Error" });

    await expect(readExportError(new Error("Network Error"))).resolves.toEqual({
      status: null,
      code: null,
      message: "Network Error",
    });
  });
});
