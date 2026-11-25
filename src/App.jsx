import "@fortawesome/fontawesome-free/css/all.min.css";
import { CssBaseline } from "@mui/material";
import "bootstrap/dist/css/bootstrap.min.css";
import { useEffect, useMemo } from "react";
import "react-datepicker/dist/react-datepicker.css";
import { useDispatch, useSelector } from "react-redux";
import { BrowserRouter } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import { DEVICE_KEY_STORAGE } from "./core/helpers/deviceInfo";
import AppRouter from "./core/routes/AppRouter";
import { fetchUserInfo } from "./Redux/reducers/AuthReducer";
import { persistor } from "./Redux/store";
import MontyTheme from "./theme/MontyTheme";
import getThemesConfig from "./theme/themesConfig";

async function deleteDatabase(name) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      console.warn(`Delete blocked for DB: ${name}`);
    };
  });
}

export async function clearAllCaches() {
  // Clear IndexedDB
  if (window.indexedDB && indexedDB.databases) {
    const databases = await indexedDB.databases();
    for (const db of databases) {
      await deleteDatabase(db.name);
    }
    console.log("IndexedDB cleared.");
  }

  // Clear Service Worker Cache
  if ("caches" in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
    console.log("Service Worker caches cleared.");
  }
}

function App() {
  const appVersion = __APP_VERSION__;
  // Built inside the component so brand.css is loaded before its variables are read
  const theme = useMemo(() => getThemesConfig().default, []);
  const dispatch = useDispatch();
  const { isAuthenticated } = useSelector((state) => state.authentication);

  // On every app load, re-read role and permissions for a signed-in admin
  // (login already returns them, so this only matters after a reload)
  useEffect(() => {
    if (isAuthenticated) {
      dispatch(fetchUserInfo());
    }
  }, [dispatch]);

  useEffect(() => {
    const localPackageVersion = localStorage.getItem("PACKAGE_VERSION");

    if (localPackageVersion) {
      if (localPackageVersion === appVersion) {
        console.log("Versions match. No action required");
      } else {
        persistor
          .purge()
          .then(() => {
            // TEOS-256: the device key is not a token; keeping it keeps this
            // browser's trusted device across app versions
            const deviceKey = localStorage.getItem(DEVICE_KEY_STORAGE);
            localStorage.clear();
            if (deviceKey) localStorage.setItem(DEVICE_KEY_STORAGE, deviceKey);
            sessionStorage.clear();
            clearAllCaches()
              .then(() => {
                console.log("All cache cleared due to version mismatch.");
              })
              .catch((error) => {
                console.error("Error clearing caches:", error);
              });
          })
          .catch((error) => {
            console.error("Error purging Redux Persist state:", error);
          });
      }
    } else {
      localStorage.setItem("PACKAGE_VERSION", appVersion);
    }
  }, [localStorage.getItem("PACKAGE_VERSION")]);

  return (
    <MontyTheme theme={theme} direction="ltr">
      <CssBaseline />

      <BrowserRouter>
        <div className="min-h-screen flex flex-col">
          <AppRouter />
        </div>

        <ToastContainer
          position="top-center"
          autoClose={4000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          progressClassName="Toast__progress_bar"
          closeButton={false}
        />
      </BrowserRouter>
    </MontyTheme>
  );
}

export default App;
