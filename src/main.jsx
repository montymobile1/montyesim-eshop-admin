import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";

import "./index.css";
import { PersistGate } from "redux-persist/integration/react";
import { persistor, store } from "./Redux/store.jsx";
import SuspenseLoading from "./Components/shared/suspense-loading/SuspenseLoading.jsx";
import React, { Suspense } from "react";
import localizedFormat from "dayjs/plugin/localizedFormat";
import relativeTime from "dayjs/plugin/relativeTime";
import advancedFormat from "dayjs/plugin/advancedFormat";
import dayjs from "dayjs";
import App from "./App";

dayjs.extend(advancedFormat);
dayjs.extend(relativeTime);
dayjs.extend(localizedFormat);

createRoot(document.getElementById("root")).render(
  <Provider store={store}>
    <PersistGate loading={null} persistor={persistor}>
      <Suspense fallback={<SuspenseLoading />}>
        <App />
      </Suspense>
    </PersistGate>
  </Provider>
);
