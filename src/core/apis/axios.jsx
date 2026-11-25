import axios from "axios";
import { toast } from "react-toastify";
import { SignOut, TokensRefreshed } from "../../Redux/reducers/AuthReducer";
import { AUTH_PERSIST_KEY, authPersistConfig, persistor, store } from "../../Redux/store";
import { collectDevice } from "../helpers/deviceInfo";
import { queryClient } from "./ReactQueryInstance";

export const API_BASE_URL = `${(import.meta.env.VITE_API_BASE_URL || "").replace(
  /\/+$/,
  ""
)}/api/v1/admin`;

// These endpoints answer 401 for wrong credentials / a dead refresh token,
// so a 401 from them must never start a refresh.
// TEOS-307: auth/reset-password carries the reset link's token, not the session.
// TEOS-256: the code step runs before there is a session.
export const NO_REFRESH_URLS = [
  "auth/login",
  "auth/refresh",
  "auth/reset-password",
  "auth/verify-device",
  "auth/resend-code",
];

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  async (config) => {
    // TEOS-256: the access token is not persisted. After a reload the slice has only
    // the (decrypted) refresh token, so the first call gets a new access token first.
    const auth = store?.getState()?.authentication;
    if (
      auth?.isAuthenticated &&
      !auth?.access_token &&
      auth?.refresh_token &&
      !isNoRefreshUrl(config?.url)
    ) {
      try {
        await refreshAccessToken();
      } catch (refreshError) {
        // the response interceptor below must pass it on untouched
        throw handleRefreshFailure(refreshError, refreshError);
      }
    }
    const token = store?.getState()?.authentication?.access_token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/*
  Single-flight refresh: while a refresh is running, every other 401 waits for
  the same promise instead of starting its own refresh.
  Uses plain axios (not `api`) so the refresh call never goes through these
  interceptors.
*/
let refreshPromise = null;

/*
  Several tabs of the portal share one session. Supabase replaces the refresh token on
  every refresh, and an old refresh token used again (outside its ~10 s grace period) is
  treated as stolen: the whole session is ended, every tab signed out.
  So a refresh:
  1. runs in one tab at a time (Web Locks API: a browser-wide lock per site);
  2. uses the NEWEST refresh token: the one another tab may have saved meanwhile in the
     shared (encrypted) storage, not this tab's in-memory copy;
  3. writes the new one to that storage before the lock is released, so the next tab
     reads it.
  Without Web Locks (very old browsers) or without the encrypted storage, it still
  works per tab, as before.
*/
export const REFRESH_LOCK_NAME = "admin-auth-refresh";

export const withRefreshLock = (task) => {
  const locks = globalThis.navigator?.locks;
  if (!locks?.request) return task();
  return locks.request(REFRESH_LOCK_NAME, task);
};

// The refresh token saved (encrypted) by any tab of this portal; null when none can be read.
export const readStoredRefreshToken = async () => {
  try {
    const raw = await authPersistConfig?.storage?.getItem?.(
      `persist:${AUTH_PERSIST_KEY}`
    );
    if (!raw) return null;
    const saved = JSON.parse(raw);
    const token = saved?.refresh_token ? JSON.parse(saved.refresh_token) : null;
    return typeof token === "string" && token ? token : null;
  } catch {
    return null;
  }
};

const refreshInLock = async () => {
  const stored = await readStoredRefreshToken();
  const refresh_token =
    stored || store?.getState()?.authentication?.refresh_token;
  if (!refresh_token) {
    throw Object.assign(new Error("No refresh token"), { sessionInvalid: true });
  }
  const res = await axios.post(`${API_BASE_URL}/auth/refresh`, {
    refresh_token,
    // TEOS-256: the API checks the refresh comes from the signed-in device
    device: collectDevice(),
  });
  const data = res?.data?.data;
  if (!data?.access_token) {
    throw Object.assign(new Error("Invalid refresh response"), {
      sessionInvalid: true,
    });
  }
  store.dispatch(TokensRefreshed(data));
  try {
    // saved before the lock is released: the next tab must read this refresh token
    await persistor?.flush?.();
  } catch {
    // storage unavailable: this tab keeps working with its in-memory copy
  }
  return data.access_token;
};

export const refreshAccessToken = () => {
  if (!refreshPromise) {
    refreshPromise = Promise.resolve()
      .then(() => withRefreshLock(refreshInLock))
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

// Why a session ended, shown by the sign-in page (?reason=...). The full page reload
// of the redirect drops any toast, so the reason travels in the URL.
export const SIGN_OUT_REASONS = {
  expired: "Your session has expired. Please sign in again.",
  access_removed: "Admin access was removed from this account.",
  // TEOS-307: not a forced sign-out, the notice after a password reset
  password_reset: "Your password was changed. Sign in with the new password.",
  // TEOS-256: this device's trusted-device row was revoked (Devices page, another admin,
  // password change elsewhere)
  device_revoked: "This device was signed out.",
};

// TEOS-256: 401 codes of the device check (contract section 2)
export const DEVICE_REVOKED_CODE = "device_revoked";
// TEOS-340: the device was revoked by Admins page > Revoke access (the account lost its admin role)
export const ACCESS_REMOVED_CODE = "access_removed";

// 401 codes that end the session at once, with their sign-in page reason: a refresh would be refused too
const SESSION_ENDED_CODES = {
  [DEVICE_REVOKED_CODE]: "device_revoked",
  [ACCESS_REMOVED_CODE]: "access_removed",
};

/*
  Why a failed refresh ends the session:
  - 403 or 401 access_removed: the account lost its admin role (the API revoked the session);
  - 401 device_revoked: this device was signed out;
  - anything else (device_session_required included): an expiry.
*/
export const getSignOutReason = (error) => {
  if (error?.response?.status === 403) return "access_removed";
  return SESSION_ENDED_CODES[getApiErrorCode(error)] || "expired";
};

/*
  Does a failed refresh end the session? Only when the API refused it (401, 403) or
  answered without tokens. No answer (offline, timeout, cold start) or a 5xx says
  nothing about the refresh token: it is kept, and the next request tries again.
*/
export const refreshEndsSession = (error) => {
  if (error?.sessionInvalid) return true;
  const status = error?.response?.status;
  return status === 401 || status === 403;
};

/*
  After a failed refresh: either end the session (reason message) or keep it and give
  the page a normal error (network / service message). Returns the error to throw,
  marked so the response interceptor passes it on untouched.
*/
function handleRefreshFailure(refreshError, originalError) {
  const error = originalError || refreshError;
  if (refreshEndsSession(refreshError)) {
    const reason = getSignOutReason(refreshError);
    endSession(reason);
    error.message = SIGN_OUT_REASONS[reason];
  } else {
    error.message =
      (refreshError?.response && refreshError.response.data?.message) ||
      NETWORK_ERROR_MESSAGE;
    error.refreshFailed = true;
  }
  error._refreshHandled = true;
  return error;
}

export const FORBIDDEN_MESSAGE = "You don't have permission for this action.";
export const NETWORK_ERROR_MESSAGE = "Service unavailable, try again.";
// TEOS-191: a 413 sent by the proxy (Cloudflare / Render) never reaches the API, so it has no API message.
export const CONTENT_TOO_LARGE_MESSAGE = "Content too large.";

export const signInUrl = (pathname, reason) =>
  `/signin?next=${encodeURIComponent(pathname)}${reason ? `&reason=${reason}` : ""}`;

const redirectToSignIn = (reason) => {
  const { pathname } = window.location;
  if (pathname.startsWith("/signin")) return;
  window.location.replace(signInUrl(pathname, reason));
};

/*
  Full local sign-out, no reload and no API call: store reset (optional reason, see
  SIGN_OUT_REASONS), query cache cleared, and the signed-out state written to the
  persisted (encrypted) auth slice, so a reload cannot rehydrate the old session.
  Resolves once the write is done; never rejects. The caller navigates.
*/
export const signOutLocally = (reason = null) => {
  // the reason is kept in the store too: the route guard usually redirects first (TEOS-145)
  store.dispatch(SignOut(reason || undefined));
  queryClient.clear();
  return Promise.resolve()
    .then(() => persistor?.flush?.())
    .catch(() => {});
};

export const endSession = (reason) =>
  // Write the signed-out state to storage before leaving the page,
  // otherwise the old session could be rehydrated after the redirect.
  signOutLocally(reason).finally(() => redirectToSignIn(reason));

function isNoRefreshUrl(url = "") {
  return NO_REFRESH_URLS.some((endpoint) => (url || "").includes(endpoint));
}

/*
  The audit log and the settings history list what admins did. Any successful
  write through this instance (POST / PUT / PATCH / DELETE, exports included)
  may have added a row, so their cached pages are marked stale: an open page
  refetches now, a closed one on its next visit (not after the 3-minute cache).
*/
export const AUDIT_QUERY_KEYS = [["audit-log"], ["settings-history"]];
const WRITE_METHODS = new Set(["post", "put", "patch", "delete"]);

export const refreshAuditQueries = (config) => {
  if (!WRITE_METHODS.has((config?.method || "get").toLowerCase())) return;
  AUDIT_QUERY_KEYS.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
};

api.interceptors.response.use(
  (response) => {
    refreshAuditQueries(response?.config);
    return response;
  },
  async (error) => {
    if (error?._refreshHandled) throw error;
    const config = error?.config;
    const status = error?.response?.status;

    // TEOS-256: the device was revoked (TEOS-340: by Revoke access): a refresh would be
    // refused too, sign out now with that reason.
    const endedReason = status === 401 ? SESSION_ENDED_CODES[getApiErrorCode(error)] : undefined;
    if (endedReason && !isNoRefreshUrl(config?.url)) {
      endSession(endedReason);
      error.message = SIGN_OUT_REASONS[endedReason];
      throw error;
    }

    if (status === 401 && config && !config._retry && !isNoRefreshUrl(config.url)) {
      config._retry = true;

      // Another request already refreshed the session after this one was sent:
      // just retry with the current token.
      const sentToken = config.headers?.Authorization?.replace("Bearer ", "");
      const currentToken = store?.getState()?.authentication?.access_token;
      if (currentToken && sentToken && sentToken !== currentToken) {
        return api.request(config);
      }

      try {
        await refreshAccessToken();
      } catch (refreshError) {
        // 403 on refresh: the account lost its admin role and the API revoked the
        // session; 401 device_revoked: this device was signed out; another 401 or no
        // tokens: an expiry. No answer or a 5xx: the session is kept (one refresh
        // attempt per request, the next request tries again).
        throw handleRefreshFailure(refreshError, error);
      }
      return api.request(config);
    }

    // TEOS-144: no response at all (server down, cold start timeout, offline).
    if (!error?.response && !axios.isCancel(error)) {
      error.message = NETWORK_ERROR_MESSAGE;
      throw error;
    }

    // TEOS-145: a 403 is about this one call, the session stays. A read shows the
    // API's permission message here, once (toastId), and pages skip their own
    // "Failed to load" toast on error.isForbidden. A write leaves the message to
    // the page's handler, which shows error.message.
    if (status === 403) {
      error.isForbidden = true;
      error.message = error?.response?.data?.message || FORBIDDEN_MESSAGE;
      if ((config?.method || "get").toLowerCase() === "get") {
        toast.error(error.message, { toastId: "admin-forbidden" });
      }
      throw error;
    }

    // TEOS-191: our API's 413 names the limit that was hit; one without a message is the proxy's
    if (status === 413) {
      error.message = error?.response?.data?.message || CONTENT_TOO_LARGE_MESSAGE;
      throw error;
    }

    error.message = error?.response?.data?.message || error?.message;
    throw error;
  }
);

// Full machine detail of an API error: { code, ...extra } (e.g. bundle_count, tag_ids), or null.
export const getApiErrorDetails = (error) => {
  try {
    const parsed = JSON.parse(error?.response?.data?.developerMessage);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

// Machine code of an API error: 409 bodies carry developerMessage = '{"code": "..."}'.
// A function declaration (hoisted): the interceptors above use it.
export function getApiErrorCode(error) {
  try {
    return JSON.parse(error?.response?.data?.developerMessage)?.code ?? null;
  } catch {
    return null;
  }
}
