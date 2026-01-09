import "@testing-library/jest-dom";
import { render, screen } from "./utils/test-utils";
import { describe, expect, it, vi } from "vitest";
import DevicesPage from "../pages/devices/DevicesPage";
import AuthLayout from "../Components/layout/AuthLayout";

// Mock useLocation to return /devices pathname
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useLocation: () => ({
      pathname: "/devices",
      search: "",
      hash: "",
      state: null,
      key: "default",
    }),
  };
});

describe("Devices Page", () => {
  it("render page component", () => {
    render(
      <AuthLayout>
        <DevicesPage />
      </AuthLayout>
    );

    expect(
      screen.getByRole("heading", { name: /Devices/i, level: 1 })
    ).toBeInTheDocument();
  });
});
