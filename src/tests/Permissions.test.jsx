import "@testing-library/jest-dom";
import {
  act,
  cleanup,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { WithPermission } from "../core/hoc/WithPermission";
import usePermission from "../core/hooks/usePermission";
import { PERMISSIONS } from "../core/vairables/Permissions";
import {
  SignIn,
  SignOut,
  UpdateAuthInfo,
} from "../Redux/reducers/AuthReducer";
import { store } from "../Redux/store";

const signInWith = (permissions) =>
  store.dispatch(
    SignIn({
      access_token: "token",
      refresh_token: "refresh",
      expires_in: 3600,
      user: {
        id: "id",
        email: "admin@example.com",
        role: "admin",
        permissions,
      },
    })
  );

const wrapper = ({ children }) => (
  <Provider store={store}>
    <MemoryRouter>{children}</MemoryRouter>
  </Provider>
);

describe("usePermission", () => {
  afterEach(() => {
    cleanup();
    store.dispatch(SignOut());
  });

  it("is true only for permissions the admin has", () => {
    signInWith([PERMISSIONS.USERS_READ]);

    expect(
      renderHook(() => usePermission(PERMISSIONS.USERS_READ), { wrapper })
        .result.current
    ).toBe(true);
    expect(
      renderHook(() => usePermission(PERMISSIONS.USERS_BAN), { wrapper })
        .result.current
    ).toBe(false);
  });

  it("is false when signed out", () => {
    const { result } = renderHook(
      () => usePermission(PERMISSIONS.USERS_READ),
      { wrapper }
    );
    expect(result.current).toBe(false);
  });

  it("follows permission changes from /auth/me", () => {
    signInWith([PERMISSIONS.USERS_READ]);
    const { result, rerender } = renderHook(
      () => usePermission(PERMISSIONS.SETTINGS_READ),
      { wrapper }
    );
    expect(result.current).toBe(false);

    act(() => {
      store.dispatch(
        UpdateAuthInfo({
          id: "id",
          email: "admin@example.com",
          role: "super_admin",
          permissions: [PERMISSIONS.USERS_READ, PERMISSIONS.SETTINGS_READ],
        })
      );
    });
    rerender();
    expect(result.current).toBe(true);
  });
});

describe("WithPermission", () => {
  afterEach(() => {
    cleanup();
    store.dispatch(SignOut());
  });

  it("renders the children when the admin has the permission", () => {
    signInWith([PERMISSIONS.SETTINGS_READ]);
    render(
      <WithPermission permission={PERMISSIONS.SETTINGS_READ}>
        <div>Settings content</div>
      </WithPermission>,
      { wrapper }
    );

    expect(screen.getByText("Settings content")).toBeInTheDocument();
  });

  it("renders the access denied page (not page not found) without the permission (TEOS-222)", () => {
    signInWith([PERMISSIONS.USERS_READ]);
    render(
      <WithPermission permission={PERMISSIONS.SETTINGS_READ}>
        <div>Settings content</div>
      </WithPermission>,
      { wrapper }
    );

    expect(screen.queryByText("Settings content")).not.toBeInTheDocument();
    expect(screen.getByText("Access Denied")).toBeInTheDocument();
    expect(screen.getByText("You don't have permission to view this page.")).toBeInTheDocument();
    expect(screen.queryByText("Page Not Found")).not.toBeInTheDocument();
  });

  it("renders a custom fallback when given", () => {
    signInWith([]);
    render(
      <WithPermission permission={PERMISSIONS.AUDIT_READ} fallback={null}>
        <div>Audit content</div>
      </WithPermission>,
      { wrapper }
    );

    expect(screen.queryByText("Audit content")).not.toBeInTheDocument();
    expect(screen.queryByText("Access Denied")).not.toBeInTheDocument();
  });
});
