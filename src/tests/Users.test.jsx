import "@testing-library/jest-dom";
import { render, screen } from "./utils/test-utils";
import { describe, expect, it, vi } from "vitest";
import UsersPage from "../pages/users/UsersPage";
import AuthLayout from "../Components/layout/AuthLayout";

// Mock useLocation to return /users pathname
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useLocation: () => ({
      pathname: "/users",
      search: "",
      hash: "",
      state: null,
      key: "default",
    }),
  };
});

describe("Users Page", () => {
  it("render page component", () => {
    render(
      <AuthLayout>
        <UsersPage />
      </AuthLayout>
    );

    expect(
      screen.getByRole("heading", { name: /Users/i, level: 1 })
    ).toBeInTheDocument();
  });
});
