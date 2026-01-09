import "@testing-library/jest-dom";
import { render, screen } from "./utils/test-utils";
import { describe, expect, it, vi } from "vitest";
import AuthLayout from "../Components/layout/AuthLayout";
import ContactusPage from "../pages/contact-us/ContactusPage";

// Mock useLocation to return /contact-us pathname
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useLocation: () => ({
      pathname: "/contact-us",
      search: "",
      hash: "",
      state: null,
      key: "default",
    }),
  };
});

describe("Contact us Page", () => {
  it("render page component", () => {
    render(
      <AuthLayout>
        <ContactusPage />
      </AuthLayout>
    );

    expect(
      screen.getByRole("heading", { name: /Contact Us/i, level: 1 })
    ).toBeInTheDocument();
  });
});
