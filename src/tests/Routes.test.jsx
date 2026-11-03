import { describe, expect, it, vi } from "vitest";

// The promotion routes exist only on promo builds, and the flag is read when the routes module
// loads, so it is set before the imports below run.
vi.hoisted(() => {
  import.meta.env.VITE_SUPPORT_PROMO = "true";
});

import { privateRoutes } from "../core/routes/allRoutes";
import { PERMISSIONS } from "../core/vairables/Permissions";

const findRoute = (routes, path) => {
  for (const route of routes) {
    if (route.path === path) return route;
    const found = route.children && findRoute(route.children, path);
    if (found) return found;
  }
  return null;
};

describe("route permissions", () => {
  it("the Add Promotion page needs the promotions write permission (MS-5053 case 16)", () => {
    expect(findRoute(privateRoutes, "/promotions/add")?.permission).toBe(PERMISSIONS.PROMOTIONS_WRITE);
  });

  it("the promotions list and the edit / view page still open with read permission", () => {
    expect(findRoute(privateRoutes, "/promotions")?.permission).toBe(PERMISSIONS.PROMOTIONS_READ);
    expect(findRoute(privateRoutes, "/promotions/:id")?.permission).toBe(PERMISSIONS.PROMOTIONS_READ);
  });
});
