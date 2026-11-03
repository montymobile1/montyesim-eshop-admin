import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { fetchUserInfoFromAPI } from "../redux-services/authServices";

const initialState = {
  access_token: null,
  refresh_token: null,
  expires_at: null,
  user_info: null, // { id, email, role, permissions: [] }
  isLoading: false,
  isAuthenticated: false,
  // TEOS-145: why the session ended ("access_removed" | "expired"), read by the
  // route guard so the sign-in URL carries ?reason=; null for a normal logout
  signOutReason: null,
};

// GET /auth/me: refreshes role and permissions without signing in again
export const fetchUserInfo = createAsyncThunk(
  "authentication/fetchUserInfo",
  async () => {
    return await fetchUserInfoFromAPI();
  }
);

// expires_in is in seconds (from POST /auth/login and /auth/refresh)
const getExpiresAt = (expiresIn) =>
  expiresIn ? Date.now() + Number(expiresIn) * 1000 : null;

const getUserInfo = (user) =>
  user
    ? {
        id: user?.id ?? null,
        email: user?.email ?? null,
        role: user?.role ?? null,
        permissions: Array.isArray(user?.permissions) ? user.permissions : [],
      }
    : null;

const AuthSlice = createSlice({
  name: "authentication",
  initialState,
  reducers: {
    // payload = data of POST /auth/login
    SignIn: (state, action) => {
      return {
        ...state,
        access_token: action?.payload?.access_token,
        refresh_token: action?.payload?.refresh_token,
        expires_at: getExpiresAt(action?.payload?.expires_in),
        user_info: getUserInfo(action?.payload?.user),
        isAuthenticated: true,
        signOutReason: null,
      };
    },
    // payload = data of POST /auth/refresh
    TokensRefreshed: (state, action) => {
      return {
        ...state,
        access_token: action?.payload?.access_token,
        refresh_token: action?.payload?.refresh_token,
        expires_at: getExpiresAt(action?.payload?.expires_in),
        user_info: action?.payload?.user
          ? getUserInfo(action?.payload?.user)
          : state.user_info,
      };
    },
    // payload = data of GET /auth/me
    UpdateAuthInfo: (state, action) => {
      return {
        ...state,
        user_info: getUserInfo(action?.payload),
      };
    },
    // payload = optional reason ("access_removed" | "expired"); none for a normal logout
    SignOut: (state, action) => {
      return { ...initialState, signOutReason: action?.payload || null };
    },
    // the sign-in page has the reason in its URL: an old one must not come back later
    ClearSignOutReason: (state) => {
      state.signOutReason = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUserInfo.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchUserInfo.fulfilled, (state, action) => {
        // 403: the account lost its admin role, so the session is useless
        if (action.payload?.status === 403) {
          return { ...initialState, signOutReason: "access_removed" };
        }
        const me = action.payload?.data?.data;
        if (me) {
          state.user_info = getUserInfo(me);
        }
        // any other failure keeps the permissions already known
        // (401 is handled by the axios interceptor: refresh or sign out)
        state.isLoading = false;
      })
      .addCase(fetchUserInfo.rejected, (state) => {
        state.isLoading = false;
      });
  },
});

export const {
  SignIn,
  TokensRefreshed,
  UpdateAuthInfo,
  SignOut,
  ClearSignOutReason,
} = AuthSlice.actions;
export default AuthSlice.reducer;
