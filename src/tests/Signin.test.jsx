import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { store } from "../Redux/store";
import SignInPage from "../pages/authentication/SignInPage";

describe("SignInPage", () => {
  it("renders the login form", () => {
    render(
      <MemoryRouter>
        <Provider store={store}>
          <SignInPage />
        </Provider>
      </MemoryRouter>
    );

    expect(
      screen.getByRole("button", { name: /Sign In/i })
    ).toBeInTheDocument();
  });
});
