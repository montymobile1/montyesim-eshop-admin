import "@testing-library/jest-dom";
import { render, screen } from "./utils/test-utils";
import { describe, expect, it, vi } from "vitest";
import OrdersPage from "../pages/orders/OrdersPage";
import AuthLayout from "../Components/layout/AuthLayout";

// Mock useLocation to return /orders pathname
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useLocation: () => ({
      pathname: "/orders",
      search: "",
      hash: "",
      state: null,
      key: "default",
    }),
  };
});

describe("Orders Page", () => {
  it("renders page components", () => {
    render(
      <AuthLayout>
        <OrdersPage />
      </AuthLayout>
    );

    expect(
      screen.getByRole("heading", { name: /Orders/i, level: 1 })
    ).toBeInTheDocument();
  });
});
