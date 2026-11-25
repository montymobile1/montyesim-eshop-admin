import {
  configureStore,
  combineReducers,
  applyMiddleware,
  compose,
} from "@reduxjs/toolkit";
import { createMigrate, persistReducer, persistStore } from "redux-persist";
import storage from "redux-persist/lib/storage";
import AuthSlice from "./reducers/AuthReducer";
import ThemeReducer from "./reducers/ThemeReducer";
import SidebarReducer from "./reducers/SidebarReducer";
import { thunk } from "redux-thunk";
import { getAuthStorage } from "../core/helpers/encryptedStorage";

/*
  TEOS-256 (contract D2): the auth slice has its own persist config, written only
  through the encrypted storage engine (AES-GCM, non-extractable key in IndexedDB).
  The access token stays in memory: after a reload the first API call refreshes it
  with the refresh token. No IndexedDB / WebCrypto: the slice is not persisted at all.
*/
export const AUTH_PERSIST_KEY = "auth";
export const AUTH_PERSISTED_FIELDS = [
  "refresh_token",
  "expires_at",
  "user_info",
  "isAuthenticated",
  "device_id",
];

export const authPersistConfig = {
  key: AUTH_PERSIST_KEY,
  version: 1,
  storage: getAuthStorage(),
  whitelist: AUTH_PERSISTED_FIELDS,
};

const rootReducer = combineReducers({
  authentication: persistReducer(authPersistConfig, AuthSlice),
  sidebar: SidebarReducer,
  theme: ThemeReducer,
});

/*
  Persisted state versions.
  1: authentication moved from the legacy client session shape
     ({ access_token, refresh_token, user_token, user_info: auth provider user })
     to the admin API shape
     ({ access_token, refresh_token, expires_at, user_info: { id, email, role, permissions }, isAuthenticated }).
     Old sessions cannot be reused, so the user signs in again.
  2: TEOS-256: authentication left the root (plain localStorage) and is persisted
     encrypted under its own key. The old plain copy is dropped: everyone signs in once.
*/
export const PERSIST_VERSION = 2;

const signedOutAuthentication = {
  access_token: null,
  refresh_token: null,
  expires_at: null,
  user_info: null,
  isAuthenticated: false,
};

export const persistMigrations = {
  1: (state) => ({
    ...state,
    authentication: { ...signedOutAuthentication },
  }),
  2: (state) => {
    if (!state) return state;
    const { authentication, ...rest } = state;
    return rest;
  },
};

// autoMergeLevel1 (the default): the root only holds sidebar and theme, so a
// hardSet would wipe the authentication slice on rehydrate.
export const persistConfig = {
  key: "root",
  version: PERSIST_VERSION,
  migrate: createMigrate(persistMigrations, { debug: false }),
  storage,
  whitelist: ["sidebar", "theme"],
  debug: true,
};

// Persisted reducer
const persistedReducer = persistReducer(persistConfig, rootReducer);

const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__
  ? window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__({ trace: true, traceLimit: 25 })
  : compose;

// Create the Redux store
const store = configureStore(
  {
    reducer: persistedReducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: false,
      }),
  },
  composeEnhancers(applyMiddleware(thunk))
);

// Create a persistor for the store
const persistor = persistStore(store);

export { store, persistor };
