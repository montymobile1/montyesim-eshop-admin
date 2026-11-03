import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import AuthLayout from "../Components/layout/AuthLayout";
import { backTarget } from "../core/helpers/backTarget";

vi.mock("../Components/layout/sidebar/MuiSideNavigation ", () => ({ default: () => null }));
vi.mock("../Components/layout/TopNav", () => ({ default: () => null }));
vi.mock("../core/hooks/useRouteName", () => ({ default: () => "Page" }));

describe("backTarget", () => {
  it.each([
    // previous page known: back to it, filters included
    ["/settings/logs", "/settings?search=otp", "/settings?search=otp"],
    ["/users/u1", "/users?banStatus=banned&page=2", "/users?banStatus=banned&page=2"],
    // nothing known (reload, direct link): the section's list
    ["/settings/logs", null, "/settings"],
    ["/bundles/b1/assign", null, "/bundles"],
    // never "back" into a page below the current one
    ["/groups/g1", "/groups/g1/reorder", "/groups"],
    // the same page with other filters is not a previous page
    ["/settings/logs", "/settings/logs?key=A", "/settings"],
  ])("from %s with previous %o goes to %s", (pathname, previous, expected) => {
    expect(backTarget(pathname, previous)).toBe(expected);
  });
});

const Location = () => {
  const { pathname, search } = useLocation();
  return <div data-testid="location">{`${pathname}${search}`}</div>;
};

const Page = ({ to }) => {
  const navigate = useNavigate();
  return <button onClick={() => navigate(to)}>go</button>;
};

describe("AuthLayout back arrow", () => {
  it("returns to the previous page even after the current page changed its filters", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/settings?search=otp"]}>
        <Routes>
          <Route
            path="*"
            element={
              <AuthLayout>
                <Location />
                <Routes>
                  <Route path="/settings" element={<Page to="/settings/logs" />} />
                  <Route path="/settings/logs" element={<Page to="/settings/logs?key=A" />} />
                </Routes>
              </AuthLayout>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    await user.click(screen.getByText("go")); // -> /settings/logs
    await user.click(screen.getByText("go")); // filter applied -> /settings/logs?key=A
    expect(screen.getByTestId("location")).toHaveTextContent("/settings/logs?key=A");

    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(screen.getByTestId("location")).toHaveTextContent("/settings?search=otp");
  });
});
