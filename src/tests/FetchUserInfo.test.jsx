import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMe } from "../core/apis/authAPI";
import {
  fetchUserInfo,
  SignIn,
  SignOut,
} from "../Redux/reducers/AuthReducer";
import { store } from "../Redux/store";

vi.mock("../core/apis/authAPI", () => ({
  getMe: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  refreshSession: vi.fn(),
}));

const auth = () => store.getState().authentication;

describe("fetchUserInfo (GET /auth/me)", () => {
  beforeEach(() => {
    store.dispatch(
      SignIn({
        access_token: "token",
        refresh_token: "refresh",
        expires_in: 3600,
        user: {
          id: "id",
          email: "admin@example.com",
          role: "admin",
          permissions: ["admin.users.read"],
        },
      })
    );
  });

  afterEach(() => {
    store.dispatch(SignOut());
    vi.clearAllMocks();
  });

  it("replaces role and permissions with the ones from the API", async () => {
    getMe.mockResolvedValue({
      data: {
        status: "success",
        data: {
          id: "id",
          email: "admin@example.com",
          role: "super_admin",
          permissions: ["admin.users.read", "admin.settings.read"],
        },
      },
    });

    await store.dispatch(fetchUserInfo());

    expect(auth().user_info.role).toBe("super_admin");
    expect(auth().user_info.permissions).toContain("admin.settings.read");
    expect(auth().isAuthenticated).toBe(true);
    expect(auth().isLoading).toBe(false);
  });

  it("signs out when the account lost its admin role (403)", async () => {
    getMe.mockRejectedValue({ response: { status: 403 } });

    await store.dispatch(fetchUserInfo());

    expect(auth().isAuthenticated).toBe(false);
    expect(auth().access_token).toBeNull();
    expect(auth().user_info).toBeNull();
  });

  it("keeps the known permissions on any other failure", async () => {
    getMe.mockRejectedValue({ response: { status: 502 } });

    await store.dispatch(fetchUserInfo());

    expect(auth().isAuthenticated).toBe(true);
    expect(auth().user_info.permissions).toEqual(["admin.users.read"]);
    expect(auth().isLoading).toBe(false);
  });
});
