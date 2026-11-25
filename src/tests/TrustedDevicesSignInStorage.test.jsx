import { webcrypto } from "node:crypto";
import { combineReducers, configureStore } from "@reduxjs/toolkit";
import axios from "axios";
import { persistReducer, persistStore } from "redux-persist";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  api,
  API_BASE_URL,
  getSignOutReason,
  NETWORK_ERROR_MESSAGE,
  NO_REFRESH_URLS,
  refreshEndsSession,
  signOutLocally,
  SIGN_OUT_REASONS,
} from "../core/apis/axios";
import { queryClient } from "../core/apis/ReactQueryInstance";
import { DEVICE_KEY_STORAGE } from "../core/helpers/deviceInfo";
import {
  createEncryptedStorage,
  getAuthStorage,
  isEncryptedStorageSupported,
  memoryOnlyStorage,
} from "../core/helpers/encryptedStorage";
import AuthSlice, { SignIn, SignOut, TokensRefreshed } from "../Redux/reducers/AuthReducer";
import {
  AUTH_PERSIST_KEY,
  authPersistConfig,
  persistConfig,
  persistMigrations,
  PERSIST_VERSION,
  persistor,
  store,
} from "../Redux/store";

/*
  TEOS-256 FE-1: encrypted auth storage (contract D2, process comment 3.4) and the
  device-aware refresh / sign-out (contract sections 2 and 3).
  jsdom has no IndexedDB: the key store is injected; Node's WebCrypto does AES-GCM.
*/

const subtle = webcrypto.subtle;

const memoryKeyStore = () => {
  let key = null;
  return {
    get: vi.fn(async () => key),
    set: vi.fn(async (value) => {
      key = value;
    }),
  };
};

const memoryBacking = () => {
  const items = new Map();
  return {
    items,
    getItem: (name) => (items.has(name) ? items.get(name) : null),
    setItem: (name, value) => items.set(name, String(value)),
    removeItem: (name) => items.delete(name),
  };
};

const user = { id: "admin-id", email: "admin@example.com", role: "admin", permissions: [] };
const signInPayload = {
  access_token: "access-SECRET-1",
  refresh_token: "refresh-SECRET-1",
  expires_in: 3600,
  user,
  device_id: "device-1",
};

const allBrowserStorage = () =>
  [window.localStorage, window.sessionStorage]
    .flatMap((storage) => Object.keys(storage).map((key) => `${key}=${storage.getItem(key)}`))
    .join("\n");

describe("encrypted storage engine", () => {
  it("round-trips a value and stores only ciphertext", async () => {
    const backing = memoryBacking();
    const storage = createEncryptedStorage({ keyStore: memoryKeyStore(), subtle, backing });

    await storage.setItem("persist:auth", JSON.stringify({ refresh_token: "refresh-SECRET-1" }));

    const raw = backing.items.get("persist:auth");
    expect(raw).toBeTruthy();
    expect(raw).not.toContain("refresh-SECRET-1");
    const payload = JSON.parse(raw);
    expect(payload).toEqual({ v: 1, iv: expect.any(String), data: expect.any(String) });
    expect(atob(payload.iv)).toHaveLength(12);
    expect(await storage.getItem("persist:auth")).toBe(
      JSON.stringify({ refresh_token: "refresh-SECRET-1" })
    );
  });

  it("creates one AES-GCM key, non-extractable, and reuses it", async () => {
    const keyStore = memoryKeyStore();
    const storage = createEncryptedStorage({ keyStore, subtle, backing: memoryBacking() });

    await storage.setItem("a", "1");
    await storage.setItem("a", "2");

    expect(keyStore.set).toHaveBeenCalledTimes(1);
    const key = keyStore.set.mock.calls[0][0];
    expect(key.extractable).toBe(false);
    expect(key.algorithm.name).toBe("AES-GCM");
    await expect(subtle.exportKey("raw", key)).rejects.toBeTruthy();
  });

  it("uses a fresh IV on every write", async () => {
    const backing = memoryBacking();
    const storage = createEncryptedStorage({ keyStore: memoryKeyStore(), subtle, backing });

    await storage.setItem("a", "same value");
    const first = JSON.parse(backing.items.get("a"));
    await storage.setItem("a", "same value");
    const second = JSON.parse(backing.items.get("a"));

    expect(second.iv).not.toBe(first.iv);
    expect(second.data).not.toBe(first.data);
  });

  it("a copy of the storage is useless with another browser's key: dropped, not returned", async () => {
    const backing = memoryBacking();
    await createEncryptedStorage({ keyStore: memoryKeyStore(), subtle, backing }).setItem("a", "secret");

    const otherBrowser = createEncryptedStorage({ keyStore: memoryKeyStore(), subtle, backing });
    expect(await otherBrowser.getItem("a")).toBeNull();
    expect(backing.items.has("a")).toBe(false);
  });

  it("an old plain value is dropped, not returned", async () => {
    const backing = memoryBacking();
    backing.setItem("persist:auth", JSON.stringify({ refresh_token: "plain" }));
    const storage = createEncryptedStorage({ keyStore: memoryKeyStore(), subtle, backing });

    expect(await storage.getItem("persist:auth")).toBeNull();
    expect(backing.items.has("persist:auth")).toBe(false);
  });

  it("never falls back to plain text when the key store fails", async () => {
    const backing = memoryBacking();
    const keyStore = {
      get: vi.fn(async () => {
        throw new Error("IndexedDB blocked");
      }),
      set: vi.fn(),
    };
    const storage = createEncryptedStorage({ keyStore, subtle, backing });

    await storage.setItem("persist:auth", "refresh-SECRET-1");

    expect(backing.items.size).toBe(0);
    expect(await storage.getItem("persist:auth")).toBeNull();
  });

  it("writes land in order, the last state wins", async () => {
    const backing = memoryBacking();
    const storage = createEncryptedStorage({ keyStore: memoryKeyStore(), subtle, backing });

    await Promise.all([storage.setItem("a", "1"), storage.setItem("a", "2"), storage.setItem("a", "3")]);

    expect(await storage.getItem("a")).toBe("3");
  });

  it("removeItem deletes the ciphertext", async () => {
    const backing = memoryBacking();
    const storage = createEncryptedStorage({ keyStore: memoryKeyStore(), subtle, backing });
    await storage.setItem("a", "1");
    await storage.removeItem("a");
    expect(backing.items.has("a")).toBe(false);
  });

  it("without IndexedDB (jsdom, some private modes) the auth slice is not persisted at all", async () => {
    expect(globalThis.indexedDB).toBeUndefined();
    expect(isEncryptedStorageSupported()).toBe(false);
    expect(getAuthStorage()).toBe(memoryOnlyStorage);
    await memoryOnlyStorage.setItem("persist:auth", "x");
    expect(await memoryOnlyStorage.getItem("persist:auth")).toBeNull();
  });
});

describe("store persist config", () => {
  it("case 17: the root persist (plain localStorage) no longer holds the auth slice", () => {
    expect(persistConfig.whitelist).not.toContain("authentication");
    expect(persistConfig.whitelist).toEqual(expect.arrayContaining(["sidebar", "theme"]));
  });

  it("case 17: the auth slice has its own config on the encrypted engine, without the access token", () => {
    expect(authPersistConfig.key).toBe(AUTH_PERSIST_KEY);
    expect(authPersistConfig.whitelist).toContain("refresh_token");
    expect(authPersistConfig.whitelist).not.toContain("access_token");
    expect(authPersistConfig.whitelist).not.toContain("signOutReason");
    // jsdom: no IndexedDB, so the engine is the no-op one (never plain localStorage)
    expect(authPersistConfig.storage).toBe(memoryOnlyStorage);
  });

  it("the version bump drops the old plain session", () => {
    expect(PERSIST_VERSION).toBe(2);
    const migrated = persistMigrations[2]({
      authentication: { refresh_token: "old-plain", isAuthenticated: true },
      sidebar: { open: true },
      theme: { mode: "light" },
      _persist: { version: 1, rehydrated: true },
    });
    expect(migrated).not.toHaveProperty("authentication");
    expect(migrated.sidebar).toEqual({ open: true });
  });

  it("case 16: after sign-in, localStorage and sessionStorage hold no readable token", async () => {
    store.dispatch(SignIn(signInPayload));
    store.dispatch(TokensRefreshed({ ...signInPayload, access_token: "access-SECRET-2" }));
    await persistor.flush();

    const everything = allBrowserStorage();
    expect(everything).not.toContain("SECRET");
    // the device key is allowed: it is not a token
    expect(DEVICE_KEY_STORAGE).toBe("admin_device_key");
    store.dispatch(SignOut());
  });

  it("case 16: with the encrypted engine on localStorage, the stored auth slice is ciphertext", async () => {
    const storage = createEncryptedStorage({ keyStore: memoryKeyStore(), subtle, backing: window.localStorage });
    const authReducer = persistReducer({ ...authPersistConfig, storage }, AuthSlice);
    const testStore = configureStore({
      reducer: combineReducers({ authentication: authReducer }),
      middleware: (getDefault) => getDefault({ serializableCheck: false }),
    });
    const testPersistor = persistStore(testStore);
    await waitBootstrapped(testPersistor);

    testStore.dispatch(SignIn(signInPayload));
    await testPersistor.flush();

    expect(window.localStorage.getItem("persist:auth")).toBeTruthy();
    expect(allBrowserStorage()).not.toContain("SECRET");
    window.localStorage.removeItem("persist:auth");
  });
});

const waitBootstrapped = (p) =>
  new Promise((resolve) => {
    const check = () => p.getState().bootstrapped && resolve();
    p.subscribe(check);
    check();
  });

const makeStore = (storage) => {
  const testStore = configureStore({
    reducer: combineReducers({
      authentication: persistReducer({ ...authPersistConfig, storage }, AuthSlice),
    }),
    middleware: (getDefault) => getDefault({ serializableCheck: false }),
  });
  const testPersistor = persistStore(testStore);
  return { testStore, testPersistor, ready: waitBootstrapped(testPersistor) };
};

describe("case 10: a reload keeps the admin signed in (encrypted refresh token)", () => {
  it("rehydrates the refresh token and the user, never the access token", async () => {
    const backing = memoryBacking();
    const keyStore = memoryKeyStore();

    const before = makeStore(createEncryptedStorage({ keyStore, subtle, backing }));
    await before.ready;
    before.testStore.dispatch(SignIn(signInPayload));
    await before.testPersistor.flush();
    expect(backing.items.get("persist:auth")).not.toContain("SECRET");

    // "reload": a new store on the same storage and key
    const after = makeStore(createEncryptedStorage({ keyStore, subtle, backing }));
    await after.ready;
    const auth = after.testStore.getState().authentication;
    expect(auth.isAuthenticated).toBe(true);
    expect(auth.refresh_token).toBe("refresh-SECRET-1");
    expect(auth.user_info).toEqual(user);
    expect(auth.device_id).toBe("device-1");
    expect(auth.access_token).toBeNull();
  });
});

const envelope = (data, responseCode = 200, developerMessage = "") => ({
  status: responseCode < 400 ? "success" : "failed",
  data,
  message: responseCode < 400 ? "" : "Refused",
  developerMessage,
  responseCode,
});

const coded = (code) => JSON.stringify({ code });

const httpError = (config, status, developerMessage = "") => {
  const response = {
    data: envelope(null, status, developerMessage),
    status,
    statusText: "",
    headers: {},
    config,
  };
  return new axios.AxiosError(`Request failed with status code ${status}`, "ERR_BAD_REQUEST", config, null, response);
};

describe("device-aware refresh and sign-out (axios)", () => {
  let originalAdapter;

  beforeEach(() => {
    originalAdapter = api.defaults.adapter;
    // stay on /signin so endSession's redirect is a no-op in jsdom
    window.history.pushState({}, "", "/signin");
  });

  afterEach(() => {
    api.defaults.adapter = originalAdapter;
    store.dispatch(SignOut());
    vi.restoreAllMocks();
  });

  it("the code-step endpoints never start a refresh", async () => {
    expect(NO_REFRESH_URLS).toEqual(expect.arrayContaining(["auth/verify-device", "auth/resend-code"]));
    store.dispatch(SignIn(signInPayload));
    api.defaults.adapter = vi.fn(async (config) => {
      throw httpError(config, 401);
    });
    const refreshSpy = vi.spyOn(axios, "post");

    await expect(api.post("auth/verify-device", {})).rejects.toBeTruthy();
    await expect(api.post("auth/resend-code", {})).rejects.toBeTruthy();
    expect(refreshSpy).not.toHaveBeenCalled();
    expect(store.getState().authentication.isAuthenticated).toBe(true);
  });

  it("after a reload (no access token) the first call refreshes first, sending the device", async () => {
    store.dispatch(SignIn({ ...signInPayload, access_token: null }));
    expect(store.getState().authentication.isAuthenticated).toBe(true);
    const adapter = vi.fn(async (config) => ({
      data: envelope({ auth: config.headers.Authorization }),
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    }));
    api.defaults.adapter = adapter;
    const refreshSpy = vi.spyOn(axios, "post").mockResolvedValue({
      status: 200,
      data: envelope({ ...signInPayload, access_token: "fresh-token", refresh_token: "refresh-2" }),
    });

    const res = await api.get("auth/me");

    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(refreshSpy).toHaveBeenCalledWith(`${API_BASE_URL}/auth/refresh`, {
      refresh_token: "refresh-SECRET-1",
      device: expect.objectContaining({ device_key: expect.any(String) }),
    });
    expect(adapter).toHaveBeenCalledTimes(1);
    expect(res.data.data.auth).toBe("Bearer fresh-token");
    expect(store.getState().authentication.refresh_token).toBe("refresh-2");
  });

  it("after a reload, a refused refresh signs out before sending the call", async () => {
    store.dispatch(SignIn({ ...signInPayload, access_token: null }));
    const adapter = vi.fn();
    api.defaults.adapter = adapter;
    vi.spyOn(axios, "post").mockImplementation(async (url) => {
      throw httpError({ url }, 401, coded("device_revoked"));
    });

    await expect(api.get("auth/me")).rejects.toMatchObject({ message: SIGN_OUT_REASONS.device_revoked });
    expect(adapter).not.toHaveBeenCalled();
    const auth = store.getState().authentication;
    expect(auth.isAuthenticated).toBe(false);
    expect(auth.signOutReason).toBe("device_revoked");
  });

  it("case 18: a call refused with 401 device_revoked signs out at once with that reason", async () => {
    store.dispatch(SignIn(signInPayload));
    api.defaults.adapter = vi.fn(async (config) => {
      throw httpError(config, 401, coded("device_revoked"));
    });
    const refreshSpy = vi.spyOn(axios, "post");

    await expect(api.get("users")).rejects.toMatchObject({ message: "This device was signed out." });

    expect(refreshSpy).not.toHaveBeenCalled();
    const auth = store.getState().authentication;
    expect(auth.isAuthenticated).toBe(false);
    expect(auth.signOutReason).toBe("device_revoked");
  });

  it("TEOS-340: a call refused with 401 access_removed signs out at once with 'Admin access was removed'", async () => {
    store.dispatch(SignIn(signInPayload));
    api.defaults.adapter = vi.fn(async (config) => {
      throw httpError(config, 401, coded("access_removed"));
    });
    const refreshSpy = vi.spyOn(axios, "post");

    await expect(api.get("users")).rejects.toMatchObject({
      message: "Admin access was removed from this account.",
    });

    expect(refreshSpy).not.toHaveBeenCalled();
    const auth = store.getState().authentication;
    expect(auth.isAuthenticated).toBe(false);
    expect(auth.signOutReason).toBe("access_removed");
  });

  it("TEOS-340: a refresh refused with 401 access_removed signs out with that reason", async () => {
    store.dispatch(SignIn(signInPayload));
    api.defaults.adapter = vi.fn(async (config) => {
      throw httpError(config, 401);
    });
    vi.spyOn(axios, "post").mockImplementation(async (url) => {
      throw httpError({ url }, 401, coded("access_removed"));
    });

    await expect(api.get("users")).rejects.toMatchObject({ message: SIGN_OUT_REASONS.access_removed });
    expect(store.getState().authentication.signOutReason).toBe("access_removed");
  });

  it("case 18: a refresh refused with 401 device_revoked signs out with that reason", async () => {
    store.dispatch(SignIn(signInPayload));
    api.defaults.adapter = vi.fn(async (config) => {
      throw httpError(config, 401);
    });
    vi.spyOn(axios, "post").mockImplementation(async (url) => {
      throw httpError({ url }, 401, coded("device_revoked"));
    });

    await expect(api.get("users")).rejects.toBeTruthy();
    expect(store.getState().authentication.signOutReason).toBe("device_revoked");
  });

  it("a refresh refused with device_session_required is an expiry", async () => {
    store.dispatch(SignIn(signInPayload));
    api.defaults.adapter = vi.fn(async (config) => {
      throw httpError(config, 401);
    });
    vi.spyOn(axios, "post").mockImplementation(async (url) => {
      throw httpError({ url }, 401, coded("device_session_required"));
    });

    await expect(api.get("users")).rejects.toMatchObject({ message: SIGN_OUT_REASONS.expired });
    expect(store.getState().authentication.signOutReason).toBe("expired");
  });

  it("getSignOutReason maps the refresh failures", () => {
    expect(getSignOutReason({ response: { status: 403 } })).toBe("access_removed");
    expect(
      getSignOutReason({ response: { status: 401, data: { developerMessage: coded("device_revoked") } } })
    ).toBe("device_revoked");
    expect(
      getSignOutReason({ response: { status: 401, data: { developerMessage: coded("access_removed") } } })
    ).toBe("access_removed");
    expect(getSignOutReason(new Error("No refresh token"))).toBe("expired");
  });
});

describe("signOutLocally (revoking this device from the Devices page)", () => {
  afterEach(() => {
    store.dispatch(SignOut());
    vi.restoreAllMocks();
  });

  it("resets the store, clears the query cache and flushes the persisted state, without a reload", async () => {
    store.dispatch(SignIn(signInPayload));
    const clearSpy = vi.spyOn(queryClient, "clear");
    const flushSpy = vi.spyOn(persistor, "flush");
    window.history.pushState({}, "", "/profile");

    await signOutLocally("device_revoked");

    const auth = store.getState().authentication;
    expect(auth.isAuthenticated).toBe(false);
    expect(auth.refresh_token).toBeNull();
    expect(auth.signOutReason).toBe("device_revoked");
    expect(clearSpy).toHaveBeenCalled();
    expect(flushSpy).toHaveBeenCalled();
    // no redirect: the caller navigates (endSession would go to /signin)
    expect(window.location.pathname).toBe("/profile");
  });

  it("without a reason it is a plain sign-out", async () => {
    store.dispatch(SignIn(signInPayload));
    await signOutLocally();
    expect(store.getState().authentication.signOutReason).toBeNull();
  });
});

// No answer at all: what axios rejects with when offline / timed out / cold start
const networkError = (config) =>
  new axios.AxiosError("Network Error", "ERR_NETWORK", config, null, undefined);

const okResponse = (config) => ({
  data: envelope({ auth: config.headers.Authorization }),
  status: 200,
  statusText: "OK",
  headers: {},
  config,
});

describe("a refresh that gets no answer or a 5xx keeps the session", () => {
  let originalAdapter;

  beforeEach(() => {
    originalAdapter = api.defaults.adapter;
    window.history.pushState({}, "", "/users");
  });

  afterEach(() => {
    api.defaults.adapter = originalAdapter;
    store.dispatch(SignOut());
    vi.restoreAllMocks();
  });

  const expectStillSignedIn = () => {
    const auth = store.getState().authentication;
    expect(auth.isAuthenticated).toBe(true);
    expect(auth.refresh_token).toBe("refresh-SECRET-1");
    expect(auth.signOutReason).toBeNull();
  };

  // a 5xx shows the API's message when it has one ("Refused" here), else the network one
  it.each([
    ["a network error", (config) => networkError(config), NETWORK_ERROR_MESSAGE],
    ["a 502", (config) => httpError(config, 502), "Refused"],
    ["a 503", (config) => httpError(config, 503), "Refused"],
  ])("after a reload, %s on refresh: still signed in, the call rejects, the next call refreshes", async (_, fail, message) => {
    store.dispatch(SignIn({ ...signInPayload, access_token: null }));
    const adapter = vi.fn(async (config) => okResponse(config));
    api.defaults.adapter = adapter;
    const refreshSpy = vi
      .spyOn(axios, "post")
      .mockImplementationOnce(async (url) => {
        throw fail({ url });
      })
      .mockResolvedValueOnce({
        status: 200,
        data: envelope({ ...signInPayload, access_token: "fresh-token", refresh_token: "refresh-2" }),
      });

    const error = await api.get("auth/me").catch((e) => e);

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe(message);
    expect(error.refreshFailed).toBe(true);
    expect(adapter).not.toHaveBeenCalled();
    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expectStillSignedIn();
    expect(window.location.pathname).toBe("/users");

    const res = await api.get("auth/me");
    expect(refreshSpy).toHaveBeenCalledTimes(2);
    expect(refreshSpy.mock.calls[1][1].refresh_token).toBe("refresh-SECRET-1");
    expect(res.data.data.auth).toBe("Bearer fresh-token");
    expect(store.getState().authentication.refresh_token).toBe("refresh-2");
  });

  it("a 401 on a call then a 502 on its refresh: the call rejects once, no loop, session kept", async () => {
    store.dispatch(SignIn(signInPayload));
    const adapter = vi.fn(async (config) => {
      throw httpError(config, 401);
    });
    api.defaults.adapter = adapter;
    const refreshSpy = vi.spyOn(axios, "post").mockImplementation(async (url) => {
      throw httpError({ url }, 502);
    });

    const error = await api.get("users").catch((e) => e);

    expect(error.response.status).toBe(401);
    expect(error.message).toBe("Refused");
    expect(error.refreshFailed).toBe(true);
    expect(adapter).toHaveBeenCalledTimes(1);
    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expectStillSignedIn();
    expect(store.getState().authentication.access_token).toBe("access-SECRET-1");
  });

  it("concurrent calls waiting on the same failed refresh all get the error", async () => {
    store.dispatch(SignIn({ ...signInPayload, access_token: null }));
    api.defaults.adapter = vi.fn(async (config) => okResponse(config));
    let failRefresh;
    const refreshSpy = vi.spyOn(axios, "post").mockImplementation(
      (url) => new Promise((_, reject) => (failRefresh = () => reject(networkError({ url }))))
    );

    const calls = [api.get("users"), api.get("orders"), api.get("auth/me")].map((p) =>
      p.then(
        () => "resolved",
        (e) => e
      )
    );
    await vi.waitFor(() => expect(refreshSpy).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 0));
    failRefresh();
    const results = await Promise.all(calls);

    expect(refreshSpy).toHaveBeenCalledTimes(1);
    results.forEach((result) => {
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe(NETWORK_ERROR_MESSAGE);
    });
    expectStillSignedIn();
  });

  it("a refresh refused with 401 still signs out", async () => {
    store.dispatch(SignIn({ ...signInPayload, access_token: null }));
    api.defaults.adapter = vi.fn(async (config) => okResponse(config));
    vi.spyOn(axios, "post").mockImplementation(async (url) => {
      throw httpError({ url }, 401);
    });

    const error = await api.get("auth/me").catch((e) => e);

    expect(error.message).toBe(SIGN_OUT_REASONS.expired);
    const auth = store.getState().authentication;
    expect(auth.isAuthenticated).toBe(false);
    expect(auth.refresh_token).toBeNull();
    expect(auth.signOutReason).toBe("expired");
  });

  it("a refresh answer without tokens signs out", async () => {
    store.dispatch(SignIn({ ...signInPayload, access_token: null }));
    api.defaults.adapter = vi.fn(async (config) => okResponse(config));
    vi.spyOn(axios, "post").mockResolvedValue({ status: 200, data: envelope(null) });

    await expect(api.get("auth/me")).rejects.toMatchObject({ message: SIGN_OUT_REASONS.expired });
    expect(store.getState().authentication.isAuthenticated).toBe(false);
  });

  it("refreshEndsSession: only 401, 403 or a tokenless answer", () => {
    expect(refreshEndsSession({ response: { status: 401 } })).toBe(true);
    expect(refreshEndsSession({ response: { status: 403 } })).toBe(true);
    expect(refreshEndsSession({ sessionInvalid: true })).toBe(true);
    expect(refreshEndsSession({ response: { status: 502 } })).toBe(false);
    expect(refreshEndsSession({ response: { status: 504 } })).toBe(false);
    expect(refreshEndsSession(new Error("Network Error"))).toBe(false);
  });
});
