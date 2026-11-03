import axios from "axios";
import { toast } from "react-toastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  api,
  CONTENT_TOO_LARGE_MESSAGE,
  FORBIDDEN_MESSAGE,
  NETWORK_ERROR_MESSAGE,
  SIGN_OUT_REASONS,
  signInUrl,
} from "../core/apis/axios";
import { SignIn, SignOut } from "../Redux/reducers/AuthReducer";
import { store } from "../Redux/store";

vi.mock("react-toastify", async () => {
  const actual = await vi.importActual("react-toastify");
  return { ...actual, toast: { ...actual.toast, error: vi.fn() } };
});

const user = {
  id: "admin-id",
  email: "admin@example.com",
  role: "admin",
  permissions: ["admin.users.read"],
};

const FORBIDDEN_BODY = {
  status: "failed",
  data: null,
  title: "You do not have permission to perform this action.",
  message: "You do not have permission to perform this action.",
  developerMessage: "admin.devices.read",
  responseCode: 403,
};

// Fake transport: every request answers `status` with `body`.
const answer = (status, body) =>
  vi.fn(async (config) => {
    throw new axios.AxiosError(
      `Request failed with status code ${status}`,
      "ERR_BAD_REQUEST",
      config,
      null,
      { data: body, status, statusText: "", headers: {}, config }
    );
  });

// Fake transport: no response at all (server down, DNS, offline).
const unreachable = vi.fn(async (config) => {
  throw new axios.AxiosError("Network Error", "ERR_NETWORK", config, null, undefined);
});

describe("api instance: 403 and network errors (TEOS-144, TEOS-145)", () => {
  let originalAdapter;

  beforeEach(() => {
    originalAdapter = api.defaults.adapter;
    window.history.pushState({}, "", "/signin");
    vi.clearAllMocks();
    store.dispatch(
      SignIn({ access_token: "token", refresh_token: "refresh", expires_in: 3600, user })
    );
  });

  afterEach(() => {
    api.defaults.adapter = originalAdapter;
    store.dispatch(SignOut());
    vi.restoreAllMocks();
  });

  it("a 403 on a read shows the API's permission message once and keeps the session", async () => {
    api.defaults.adapter = answer(403, FORBIDDEN_BODY);
    const refreshSpy = vi.spyOn(axios, "post");

    const error = await api.get("devices").catch((e) => e);

    expect(error.isForbidden).toBe(true);
    expect(error.message).toBe(FORBIDDEN_BODY.message);
    expect(toast.error).toHaveBeenCalledWith(FORBIDDEN_BODY.message, {
      toastId: "admin-forbidden",
    });
    // no retry, no refresh, no sign-out
    expect(api.defaults.adapter).toHaveBeenCalledTimes(1);
    expect(refreshSpy).not.toHaveBeenCalled();
    expect(store.getState().authentication.isAuthenticated).toBe(true);
  });

  it("a 403 without a message body falls back to the generic permission text", async () => {
    api.defaults.adapter = answer(403, {});

    const error = await api.get("devices").catch((e) => e);

    expect(error.message).toBe(FORBIDDEN_MESSAGE);
  });

  it("a 403 on a write is left to the page (no toast here), with the API message on the error", async () => {
    api.defaults.adapter = answer(403, FORBIDDEN_BODY);

    const error = await api.post("users/1/ban", {}).catch((e) => e);

    expect(error.isForbidden).toBe(true);
    expect(error.message).toBe(FORBIDDEN_BODY.message);
    expect(toast.error).not.toHaveBeenCalled();
    expect(store.getState().authentication.isAuthenticated).toBe(true);
  });

  it("no response at all becomes 'Service unavailable, try again.' instead of 'Network Error'", async () => {
    api.defaults.adapter = unreachable;

    const error = await api.post("auth/login", { email: "a@b.co", password: "x" }).catch((e) => e);

    expect(error.message).toBe(NETWORK_ERROR_MESSAGE);
  });

  it("a 413 keeps the API's message, which names the limit (TEOS-191)", async () => {
    const message = "At most 200 new icons can be uploaded in one save.";
    api.defaults.adapter = answer(413, { status: "failed", title: message, message, responseCode: 413 });

    const error = await api.post("groups", {}).catch((e) => e);

    expect(error.message).toBe(message);
  });

  it("a 413 without an API message (sent by the proxy) says the content is too large (TEOS-191)", async () => {
    api.defaults.adapter = answer(413, "<html>413 Request Entity Too Large</html>");

    const error = await api.post("groups", {}).catch((e) => e);

    expect(error.message).toBe(CONTENT_TOO_LARGE_MESSAGE);
  });

  it("a 403 on refresh (admin role removed) signs out with the 'access removed' reason", async () => {
    api.defaults.adapter = answer(401, { message: "Unauthorized" });
    vi.spyOn(axios, "post").mockRejectedValue(
      Object.assign(new Error("Request failed with status code 403"), {
        response: { status: 403, data: { developerMessage: "ADMIN_ROLE_REQUIRED" } },
      })
    );

    const error = await api.get("devices").catch((e) => e);

    expect(error.message).toBe(SIGN_OUT_REASONS.access_removed);
    expect(store.getState().authentication.isAuthenticated).toBe(false);
  });

  it("any other refresh failure signs out as an expired session", async () => {
    api.defaults.adapter = answer(401, { message: "Unauthorized" });
    vi.spyOn(axios, "post").mockRejectedValue(
      Object.assign(new Error("Request failed with status code 401"), {
        response: { status: 401, data: {} },
      })
    );

    const error = await api.get("devices").catch((e) => e);

    expect(error.message).toBe(SIGN_OUT_REASONS.expired);
    expect(store.getState().authentication.isAuthenticated).toBe(false);
  });

  it("the sign-in redirect carries the page to return to and the reason", () => {
    expect(signInUrl("/devices", "access_removed")).toBe(
      "/signin?next=%2Fdevices&reason=access_removed"
    );
    expect(signInUrl("/devices")).toBe("/signin?next=%2Fdevices");
  });
});
