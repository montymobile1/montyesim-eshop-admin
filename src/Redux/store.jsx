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
import hardSet from "redux-persist/es/stateReconciler/hardSet";
import { thunk } from "redux-thunk";

const rootReducer = combineReducers({
  authentication: AuthSlice,
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
*/
const PERSIST_VERSION = 1;

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
};

const persistConfig = {
  key: "root",
  version: PERSIST_VERSION,
  migrate: createMigrate(persistMigrations, { debug: false }),
  storage,
  stateReconciler: hardSet,
  whitelist: ["authentication", "sidebar", "theme"],
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
