import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../core/apis/axios", async (importOriginal) => ({
  // keep the real shared helpers (getApiErrorCode), mock only the HTTP client
  ...(await importOriginal()),
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import { api } from "../core/apis/axios";
import {
  banUser,
  BAN_STATUS,
  DEFAULT_BAN_HOURS,
  getAllUsers,
  getApiErrorCode,
  getUserById,
  getUserDevices,
  getUserWalletTransactions,
  unbanUser,
} from "../core/apis/usersAPI";

describe("usersAPI", () => {
  beforeEach(() => vi.clearAllMocks());

  it("exposes the ban constants", () => {
    expect(DEFAULT_BAN_HOURS).toBe(8760);
    expect(BAN_STATUS).toEqual({ all: "all", banned: "banned", active: "active" });
  });

  it("calls the admin endpoints", async () => {
    await getAllUsers({ page: 1, page_size: 10, ban_status: "all" });
    expect(api.get).toHaveBeenCalledWith("users", { params: { page: 1, page_size: 10, ban_status: "all" } });

    await getUserById("u1");
    expect(api.get).toHaveBeenCalledWith("users/u1");

    await getUserDevices("u1", { page: 2, page_size: 10 });
    expect(api.get).toHaveBeenCalledWith("users/u1/devices", { params: { page: 2, page_size: 10 } });

    await getUserWalletTransactions("u1", { page: 1, page_size: 10 });
    expect(api.get).toHaveBeenCalledWith("users/u1/wallet-transactions", { params: { page: 1, page_size: 10 } });
  });

  it("banUser sends hours (default 8760) and the reason; unbanUser only the reason", async () => {
    await banUser({ id: "u1", reason: "fraud" });
    expect(api.post).toHaveBeenCalledWith("users/u1/ban", { hours: 8760, reason: "fraud" });

    await banUser({ id: "u1", hours: "48", reason: "fraud" });
    expect(api.post).toHaveBeenCalledWith("users/u1/ban", { hours: 48, reason: "fraud" });

    await unbanUser({ id: "u2", reason: "cleared" });
    expect(api.post).toHaveBeenCalledWith("users/u2/unban", { reason: "cleared" });
  });

  it("getApiErrorCode reads the 409 code", () => {
    expect(
      getApiErrorCode({ response: { data: { developerMessage: '{"code":"already_banned"}' } } })
    ).toBe("already_banned");
    expect(getApiErrorCode(undefined)).toBeNull();
  });
});
