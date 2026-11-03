import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, API_BASE_URL } from "../core/apis/axios";
import { queryClient } from "../core/apis/ReactQueryInstance";
import { SignIn, SignOut } from "../Redux/reducers/AuthReducer";
import { store } from "../Redux/store";

const envelope = (data, responseCode = 200) => ({
  status: responseCode < 400 ? "success" : "failed",
  totalCount: 0,
  data,
  title: "",
  message: responseCode < 400 ? "" : "Unauthorized",
  developerMessage: "",
  responseCode,
});

const user = {
  id: "admin-id",
  email: "admin@example.com",
  role: "admin",
  permissions: ["admin.users.read"],
};

/*
  Fake transport for the `api` instance: 200 for requests sent with
  `validToken`, 401 for anything else.
*/
const fakeAdapter = (validToken) =>
  vi.fn(async (config) => {
    const ok = config.headers?.Authorization === `Bearer ${validToken}`;
    const response = {
      data: ok ? envelope({ url: config.url }) : envelope(null, 401),
      status: ok ? 200 : 401,
      statusText: ok ? "OK" : "Unauthorized",
      headers: {},
      config,
    };
    if (ok) return response;
    throw new axios.AxiosError(
      "Request failed with status code 401",
      "ERR_BAD_REQUEST",
      config,
      null,
      response
    );
  });

describe("api instance: 401 handling", () => {
  let originalAdapter;

  beforeEach(() => {
    originalAdapter = api.defaults.adapter;
    // Stay on /signin so the redirect after a failed refresh is a no-op in jsdom
    window.history.pushState({}, "", "/signin");
    store.dispatch(
      SignIn({
        access_token: "expired-token",
        refresh_token: "refresh-1",
        expires_in: 3600,
        user,
      })
    );
  });

  afterEach(() => {
    api.defaults.adapter = originalAdapter;
    store.dispatch(SignOut());
    vi.restoreAllMocks();
  });

  it("sends the bearer token from Redux", async () => {
    const adapter = fakeAdapter("expired-token");
    api.defaults.adapter = adapter;

    await api.get("auth/me");

    expect(adapter.mock.calls[0][0].headers.Authorization).toBe(
      "Bearer expired-token"
    );
  });

  it("runs a single refresh for concurrent 401s and retries both requests", async () => {
    const adapter = fakeAdapter("new-token");
    api.defaults.adapter = adapter;

    let resolveRefresh;
    const refreshSpy = vi.spyOn(axios, "post").mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRefresh = () =>
            resolve({
              status: 200,
              data: envelope({
                access_token: "new-token",
                refresh_token: "refresh-2",
                expires_in: 3600,
                user,
              }),
            });
        })
    );

    const first = api.get("users");
    const second = api.get("orders");

    // Both requests got their 401 while the refresh is still pending
    await vi.waitFor(() => expect(adapter).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(refreshSpy).toHaveBeenCalled());
    // give the second 401 time to reach the interceptor
    await new Promise((resolve) => setTimeout(resolve, 0));
    resolveRefresh();

    const [firstRes, secondRes] = await Promise.all([first, second]);

    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(refreshSpy).toHaveBeenCalledWith(`${API_BASE_URL}/auth/refresh`, {
      refresh_token: "refresh-1",
    });
    expect(firstRes.data.data.url).toBe("users");
    expect(secondRes.data.data.url).toBe("orders");
    // 2 failed calls + 2 retries
    expect(adapter).toHaveBeenCalledTimes(4);
    expect(adapter.mock.calls[2][0].headers.Authorization).toBe(
      "Bearer new-token"
    );
    expect(adapter.mock.calls[3][0].headers.Authorization).toBe(
      "Bearer new-token"
    );

    const auth = store.getState().authentication;
    expect(auth.access_token).toBe("new-token");
    expect(auth.refresh_token).toBe("refresh-2");
    expect(auth.isAuthenticated).toBe(true);
  });

  it("signs out and clears the query cache when the refresh fails", async () => {
    api.defaults.adapter = fakeAdapter("never-valid");
    const clearSpy = vi.spyOn(queryClient, "clear");
    const refreshSpy = vi.spyOn(axios, "post").mockRejectedValue(
      Object.assign(new Error("Request failed with status code 401"), {
        response: { status: 401, data: envelope(null, 401) },
      })
    );

    await expect(api.get("users")).rejects.toBeTruthy();

    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(clearSpy).toHaveBeenCalled();
    const auth = store.getState().authentication;
    expect(auth.isAuthenticated).toBe(false);
    expect(auth.access_token).toBeNull();
    expect(auth.user_info).toBeNull();
  });

  it("does not refresh when the login call itself answers 401", async () => {
    api.defaults.adapter = fakeAdapter("never-valid");
    const refreshSpy = vi.spyOn(axios, "post");

    await expect(
      api.post("auth/login", { email: "a@b.c", password: "x" })
    ).rejects.toMatchObject({ message: "Unauthorized" });

    expect(refreshSpy).not.toHaveBeenCalled();
    expect(store.getState().authentication.isAuthenticated).toBe(true);
  });
});
