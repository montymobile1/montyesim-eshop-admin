import "@testing-library/jest-dom";
import axios from "axios";
import { Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../core/apis/axios";
import RouteWrapper from "../core/routes/RouteWrapper";
import SignInPage from "../pages/authentication/SignInPage";
import { fetchUserInfo, SignIn, SignOut } from "../Redux/reducers/AuthReducer";
import { store } from "../Redux/store";
import { act, render, screen, waitFor } from "./utils/test-utils";

/*
  TEOS-145 case B: the private-route guard redirects to /signin as soon as the store is
  signed out, before endSession's own redirect runs. The reason must reach the sign-in
  URL anyway, so the page explains why the session ended.
  The real guard, sign-in page and axios refresh path run together here.
*/

vi.mock("../Components/layout/AuthLayout", () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock("../Components/layout/MainLayout", () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock("../Redux/redux-services/authServices", () => ({ fetchUserInfoFromAPI: vi.fn() }));

import { fetchUserInfoFromAPI } from "../Redux/redux-services/authServices";

const user = { id: "admin-id", email: "admin@example.com", role: "admin", permissions: [] };

const httpError = (status) => (config) => {
  throw new axios.AxiosError(`Request failed with status code ${status}`, "ERR_BAD_REQUEST", config, null, {
    data: { title: "failed", responseCode: status },
    status,
    statusText: "",
    headers: {},
    config,
  });
};

const renderApp = () =>
  render(
    <Routes>
      <Route path="/" element={<RouteWrapper shouldbeLoggedIn={true} />}>
        <Route path="/devices" element={<div>Devices page</div>} />
      </Route>
      <Route path="/signin" element={<RouteWrapper shouldbeLoggedIn={false} />}>
        <Route index element={<SignInPage />} />
      </Route>
    </Routes>
  );

describe("sign-out reason on the sign-in page (TEOS-145)", () => {
  let originalAdapter;

  beforeEach(() => {
    originalAdapter = api.defaults.adapter;
    store.dispatch(SignIn({ access_token: "expired", refresh_token: "refresh-1", expires_in: 3600, user }));
    window.history.pushState({}, "", "/devices");
  });

  afterEach(() => {
    api.defaults.adapter = originalAdapter;
    store.dispatch(SignOut());
    vi.restoreAllMocks();
  });

  const failRefreshWith = async (status) => {
    api.defaults.adapter = vi.fn(httpError(401));
    vi.spyOn(axios, "post").mockImplementation(async (url) => httpError(status)({ url }));
    await act(async () => {
      await api.get("devices").catch(() => {});
    });
  };

  it("a refresh refused with 403 (role removed) shows 'Admin access was removed'", async () => {
    renderApp();
    expect(screen.getByText("Devices page")).toBeInTheDocument();

    await failRefreshWith(403);

    expect(await screen.findByTestId("sign-out-reason")).toHaveTextContent(
      "Admin access was removed from this account."
    );
    expect(window.location.pathname).toBe("/signin");
    expect(window.location.search).toContain("next=%2Fdevices");
    expect(window.location.search).toContain("reason=access_removed");
  });

  // TEOS-256: a 5xx or no answer keeps the session (TrustedDevicesSignInStorage.test.jsx)
  it("any other refusal of the refresh (401) shows 'Your session has expired'", async () => {
    renderApp();

    await failRefreshWith(401);

    expect(await screen.findByTestId("sign-out-reason")).toHaveTextContent(
      "Your session has expired. Please sign in again."
    );
    expect(window.location.search).toContain("reason=expired");
  });

  it("GET /auth/me refused with 403 on app load shows 'Admin access was removed'", async () => {
    fetchUserInfoFromAPI.mockResolvedValue({ status: 403 });
    renderApp();

    await act(async () => {
      await store.dispatch(fetchUserInfo());
    });

    expect(await screen.findByTestId("sign-out-reason")).toHaveTextContent(
      "Admin access was removed from this account."
    );
  });

  it("a normal logout shows no reason", async () => {
    renderApp();

    act(() => {
      store.dispatch(SignOut());
    });

    await waitFor(() => expect(window.location.pathname).toBe("/signin"));
    expect(window.location.search).not.toContain("reason=");
    expect(screen.queryByTestId("sign-out-reason")).not.toBeInTheDocument();
  });

  it("the stored reason is cleared once shown, so a later visit shows no stale message", async () => {
    renderApp();
    await failRefreshWith(403);
    await screen.findByTestId("sign-out-reason");

    await waitFor(() => expect(store.getState().authentication.signOutReason).toBeNull());
  });
});
