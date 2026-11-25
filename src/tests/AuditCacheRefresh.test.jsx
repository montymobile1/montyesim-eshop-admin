import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, AUDIT_QUERY_KEYS } from "../core/apis/axios";
import { queryClient } from "../core/apis/ReactQueryInstance";
import { SignIn, SignOut } from "../Redux/reducers/AuthReducer";
import { store } from "../Redux/store";

const user = { id: "admin-id", email: "admin@example.com", role: "super_admin", permissions: [] };

// Fake transport: every request answers 200.
const ok = vi.fn(async (config) => ({ data: { status: "success", data: {} }, status: 200, statusText: "OK",
  headers: {}, config }));

const failing = vi.fn(async (config) => {
  throw new axios.AxiosError("Request failed with status code 422", "ERR_BAD_REQUEST", config, null,
    { data: { message: "bad" }, status: 422, statusText: "", headers: {}, config });
});

describe("audit log cache after an admin action", () => {
  let originalAdapter;
  let invalidate;

  beforeEach(() => {
    originalAdapter = api.defaults.adapter;
    store.dispatch(SignIn({ access_token: "access", refresh_token: "refresh", expires_in: 3600, user }));
    invalidate = vi.spyOn(queryClient, "invalidateQueries");
  });

  afterEach(() => {
    api.defaults.adapter = originalAdapter;
    store.dispatch(SignOut());
    vi.restoreAllMocks();
  });

  it("covers the audit log (list and detail) and the settings history", () => {
    expect(AUDIT_QUERY_KEYS).toEqual([["audit-log"], ["settings-history"]]);
  });

  it.each([
    ["post", "vouchers"],
    ["put", "settings"],
    ["patch", "bundles/7"],
    ["delete", "me/devices/dev-1"],
    ["post", "referrals/export"],
  ])("a successful %s %s marks them stale", async (method, url) => {
    api.defaults.adapter = ok;

    await api.request({ method, url });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["audit-log"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["settings-history"] });
  });

  it("a read (GET) does not", async () => {
    api.defaults.adapter = ok;

    await api.get("audit-log");

    expect(invalidate).not.toHaveBeenCalled();
  });

  it("a failed write does not", async () => {
    api.defaults.adapter = failing;

    await expect(api.post("vouchers", {})).rejects.toBeTruthy();

    expect(invalidate).not.toHaveBeenCalled();
  });

  it("a cached audit log page is refetched on its next visit", async () => {
    queryClient.setQueryData(["audit-log", { page: 1 }], { rows: [] });
    queryClient.setQueryData(["audit-log", "detail", "20"], { id: 20 });
    api.defaults.adapter = ok;

    await api.post("vouchers", {});

    expect(queryClient.getQueryState(["audit-log", { page: 1 }]).isInvalidated).toBe(true);
    expect(queryClient.getQueryState(["audit-log", "detail", "20"]).isInvalidated).toBe(true);
    queryClient.clear();
  });
});
