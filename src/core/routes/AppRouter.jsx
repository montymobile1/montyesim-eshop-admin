import React from "react";
import { Route, Routes } from "react-router-dom";
import { privateRoutes, publicRoutes } from "./allRoutes";
import { WithPermission } from "../hoc/WithPermission";

// Routes declaring a `permission` are only rendered for admins having it
const guardedElement = (route) =>
  route?.permission ? (
    <WithPermission permission={route.permission}>{route.element}</WithPermission>
  ) : (
    route?.element
  );

const AppRouter = () => {
  console.log("mounted.");
  return (
    <Routes>
      {privateRoutes?.map((route) =>
        route?.children ? (
          <Route key={route.path} path={route.path} element={route.element}>
            {route.children.map((child) => (
              <Route
                index={child?.index}
                key={child.path}
                path={child.path}
                element={guardedElement(child)}
              />
            ))}
          </Route>
        ) : (
          <Route
            key={route.path}
            index={route?.index}
            element={guardedElement(route)}
          />
        )
      )}

      {publicRoutes?.map((route) =>
        route?.children ? (
          <Route key={route.path} path={route.path} element={route.element}>
            {route.children.map((child) => (
              <Route
                index={child?.index}
                key={child.path}
                path={child.path}
                element={child.element}
              />
            ))}
          </Route>
        ) : (
          <Route
            key={route.path}
            index={route?.index}
            element={route?.element}
          />
        )
      )}
    </Routes>
  );
};

export default AppRouter;
