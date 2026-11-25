import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  readStoredRefreshToken,
  refreshAccessToken,
  REFRESH_LOCK_NAME,
  withRefreshLock,
} from "../core/apis/axios";
import { SignIn, SignOut } from "../Redux/reducers/AuthReducer";
import { AUTH_PERSIST_KEY, authPersistConfig, persistor, store } from "../Redux/store";

/*
  TEOS-256: several tabs share one session. Supabase replaces the refresh token on every
  refresh and ends the whole session when an old one is used again, so a refresh must
  use the newest token (saved by any tab) and run in one tab at a time.
*/

const STORAGE_NAME = `persist:${AUTH_PERSIST_KEY}`;

// what redux-persist writes: every field JSON-encoded inside a JSON object
const persisted = (refreshToken) =>
  JSON.stringify({
    refresh_token: JSON.stringify(refreshToken),
    isAuthenticated: "true",
    _persist: JSON.stringify({ version: 1, rehydrated: true }),
  });

const refreshed = (refreshToken) => ({
  status: 200,
  data: {
    status: "success",
    data: {
      access_token: `access-for-${refreshToken}`,
      refresh_token: refreshToken,
      expires_in: 3600,
      user: { id: "me", email: "me@x.com", role: "admin", permissions: [] },
    },
  },
});

const signInWith = (refreshToken) =>
  store.dispatch(
    SignIn({
      access_token: "old-access",
      refresh_token: refreshToken,
      expires_in: 3600,
      user: { id: "me", email: "me@x.com", role: "admin", permissions: [] },
    })
  );

let shared; // the storage every tab of the site shares (encrypted in real life)

beforeEach(() => {
  shared = null;
  vi.spyOn(authPersistConfig.storage, "getItem").mockImplementation(async (name) =>
    name === STORAGE_NAME ? shared : null
  );
  // flushing writes this tab's current refresh token to the shared storage
  vi.spyOn(persistor, "flush").mockImplementation(async () => {
    shared = persisted(store.getState().authentication.refresh_token);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  delete globalThis.navigator.locks;
  store.dispatch(SignOut());
});

describe("TEOS-256 refresh with several tabs open", () => {
  it("uses the newer refresh token another tab saved, not this tab's stale copy", async () => {
    signInWith("R1"); // this tab still holds R1 in memory
    shared = persisted("R2"); // another tab already rotated it to R2
    const post = vi.spyOn(axios, "post").mockResolvedValue(refreshed("R3"));

    await refreshAccessToken();

    expect(post.mock.calls[0][1].refresh_token).toBe("R2");
    expect(store.getState().authentication.refresh_token).toBe("R3");
    expect(shared).toBe(persisted("R3")); // saved for the next tab
  });

  it("two tabs refreshing one after the other: the second uses the token the first saved", async () => {
    const post = vi
      .spyOn(axios, "post")
      .mockResolvedValueOnce(refreshed("R2"))
      .mockResolvedValueOnce(refreshed("R3"));

    signInWith("R1");
    shared = persisted("R1");
    await refreshAccessToken(); // tab A: R1 -> R2, saved

    signInWith("R1"); // tab B: its memory still has R1
    await refreshAccessToken();

    expect(post.mock.calls.map(([, body]) => body.refresh_token)).toEqual(["R1", "R2"]);
  });

  it("nothing readable in storage: the in-memory refresh token is used, as before", async () => {
    signInWith("R1");
    const post = vi.spyOn(axios, "post").mockResolvedValue(refreshed("R2"));

    shared = "not json";
    await refreshAccessToken();
    expect(post.mock.calls[0][1].refresh_token).toBe("R1");
  });

  it("runs inside the browser-wide lock, and saves before the lock is released", async () => {
    const order = [];
    globalThis.navigator.locks = {
      request: vi.fn(async (name, task) => {
        order.push(`lock ${name}`);
        const result = await task();
        order.push("unlock");
        return result;
      }),
    };
    persistor.flush.mockImplementation(async () => {
      order.push("saved");
      shared = persisted(store.getState().authentication.refresh_token);
    });
    signInWith("R1");
    vi.spyOn(axios, "post").mockResolvedValue(refreshed("R2"));

    await refreshAccessToken();

    expect(order).toEqual([`lock ${REFRESH_LOCK_NAME}`, "saved", "unlock"]);
  });

  it("without the Web Locks API the refresh still runs", async () => {
    expect(await withRefreshLock(async () => "done")).toBe("done");
  });

  it("readStoredRefreshToken reads the saved token, else null", async () => {
    shared = persisted("R9");
    expect(await readStoredRefreshToken()).toBe("R9");
    shared = null;
    expect(await readStoredRefreshToken()).toBeNull();
  });
});
