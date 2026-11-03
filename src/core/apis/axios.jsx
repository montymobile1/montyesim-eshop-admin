import axios from "axios";
import { toast } from "react-toastify";
import { SignOut, TokensRefreshed } from "../../Redux/reducers/AuthReducer";
import { persistor, store } from "../../Redux/store";
import { queryClient } from "./ReactQueryInstance";

export const API_BASE_URL = `${(import.meta.env.VITE_API_BASE_URL || "").replace(
  /\/+$/,
  ""
)}/api/v1/admin`;

// These endpoints answer 401 for wrong credentials / a dead refresh token,
// so a 401 from them must never start a refresh.
const NO_REFRESH_URLS = ["auth/login", "auth/refresh"];

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  (config) => {
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

export const refreshAccessToken = () => {
  if (!refreshPromise) {
    const refresh_token = store?.getState()?.authentication?.refresh_token;

    refreshPromise = (
      refresh_token
        ? axios.post(`${API_BASE_URL}/auth/refresh`, { refresh_token })
        : Promise.reject(new Error("No refresh token"))
    )
      .then((res) => {
        const data = res?.data?.data;
        if (!data?.access_token) {
          throw new Error("Invalid refresh response");
        }
        store.dispatch(TokensRefreshed(data));
        return data.access_token;
      })
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
};

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

export const endSession = (reason) => {
  // the reason is kept in the store too: the route guard usually redirects first (TEOS-145)
  store.dispatch(SignOut(reason));
  queryClient.clear();
  // Write the signed-out state to storage before leaving the page,
  // otherwise the old session could be rehydrated after the redirect.
  return Promise.resolve(persistor?.flush?.())
    .catch(() => {})
    .finally(() => redirectToSignIn(reason));
};

const isNoRefreshUrl = (url = "") =>
  NO_REFRESH_URLS.some((endpoint) => url.includes(endpoint));

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error?.config;
    const status = error?.response?.status;

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
        // session, so there is nothing to keep; any other failure is an expiry.
        const reason =
          refreshError?.response?.status === 403 ? "access_removed" : "expired";
        endSession(reason);
        error.message = SIGN_OUT_REASONS[reason];
        throw error;
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
export const getApiErrorCode = (error) => {
  try {
    return JSON.parse(error?.response?.data?.developerMessage)?.code ?? null;
  } catch {
    return null;
  }
};
