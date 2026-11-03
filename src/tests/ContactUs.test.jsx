import "@testing-library/jest-dom";
import { fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AuthLayout from "../Components/layout/AuthLayout";
import { getAllMessages } from "../core/apis/contactusAPI";
import ContactusPage from "../pages/contact-us/ContactusPage";
import { render, screen, waitFor, within } from "./utils/test-utils";

// The page runs on the real router location: each test starts on /contact-us (beforeEach)
// and the list follows the URL both ways (TEOS-287), so a fixed mocked location can't be used.

vi.mock("../core/apis/contactusAPI", () => ({
  getAllMessages: vi.fn(),
}));

const listResponse = (rows, total = rows.length) => ({
  data: { data: { data: rows, total_count: total } },
});

const MESSAGES = [
  {
    id: 7,
    email: "jane@example.com",
    content: "My eSIM does not activate",
    created_at: "2026-10-01T10:00:00",
  },
];

const NO_FILTERS = { search: undefined, from: undefined, to: undefined };

const renderPage = () =>
  render(
    <AuthLayout>
      <ContactusPage />
    </AuthLayout>
  );

const lastCallParams = () => getAllMessages.mock.calls.at(-1)[0];
const searchInput = () =>
  screen.getByPlaceholderText("Search by email or message");
const dateInputs = (container) =>
  container.querySelectorAll('input[type="date"]');

describe("Contact us Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, "", "/contact-us");
    getAllMessages.mockResolvedValue(listResponse(MESSAGES, 1));
  });

  it("render page component", () => {
    renderPage();

    expect(
      screen.getByRole("heading", { name: /Contact Us/i, level: 1 })
    ).toBeInTheDocument();
  });

  it("opens on page 1 and lists the messages", async () => {
    renderPage();

    expect(await screen.findByText("jane@example.com")).toBeInTheDocument();
    expect(getAllMessages.mock.calls[0][0]).toEqual({
      page: 1,
      page_size: 10,
      ...NO_FILTERS,
    });
  });

  it("search (email or message) goes back to page 1 and is kept in the URL", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/contact-us?page=2");
    renderPage();
    await screen.findByText("jane@example.com");

    await user.type(searchInput(), "activate");
    await user.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() =>
      expect(lastCallParams()).toEqual({
        page: 1,
        page_size: 10,
        ...NO_FILTERS,
        search: "activate",
      })
    );
    expect(window.location.search).toContain("search=activate");
  });

  it("date range sends from / to on page 1 and keeps them in the URL", async () => {
    window.history.pushState({}, "", "/contact-us?page=3");
    const { container } = renderPage();
    await screen.findByText("jane@example.com");
    const [fromInput, toInput] = dateInputs(container);

    fireEvent.change(fromInput, { target: { value: "2026-10-01" } });
    fireEvent.change(toInput, { target: { value: "2026-10-21" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() =>
      expect(lastCallParams()).toEqual({
        page: 1,
        page_size: 10,
        search: undefined,
        from: "2026-10-01",
        to: "2026-10-21",
      })
    );
    expect(window.location.search).toContain("from=2026-10-01");
    expect(window.location.search).toContain("to=2026-10-21");
  });

  it("the next page keeps the search and the dates", async () => {
    const user = userEvent.setup();
    window.history.pushState(
      {},
      "",
      "/contact-us?search=jane&from=2026-10-01&to=2026-10-21"
    );
    getAllMessages.mockResolvedValue(listResponse(MESSAGES, 25));
    renderPage();
    await screen.findByText("jane@example.com");

    await user.click(screen.getByRole("button", { name: /next page/i }));

    await waitFor(() =>
      expect(lastCallParams()).toEqual({
        page: 2,
        page_size: 10,
        search: "jane",
        from: "2026-10-01",
        to: "2026-10-21",
      })
    );
  });

  it("restores the search and dates from the URL", async () => {
    window.history.pushState(
      {},
      "",
      "/contact-us?search=jane&pageSize=25&from=2026-10-01&to=bad"
    );

    renderPage();

    await waitFor(() => expect(getAllMessages).toHaveBeenCalled());
    expect(getAllMessages.mock.calls[0][0]).toEqual({
      page: 1,
      page_size: 25,
      search: "jane",
      from: "2026-10-01",
      to: undefined,
    });
    expect(searchInput()).toHaveValue("jane");
  });

  it("the search input stops at 100 characters", async () => {
    renderPage();
    await screen.findByText("jane@example.com");

    expect(searchInput()).toHaveAttribute("maxLength", "100");
    fireEvent.change(searchInput(), { target: { value: "x".repeat(150) } });
    expect(searchInput().value).toHaveLength(100);
  });

  it("a search over 100 characters in the URL is cut to 100", async () => {
    window.history.pushState({}, "", `/contact-us?search=${"y".repeat(120)}`);

    renderPage();

    await waitFor(() => expect(getAllMessages).toHaveBeenCalled());
    expect(getAllMessages.mock.calls[0][0].search).toHaveLength(100);
  });

  it("to before from: validation message and no request", async () => {
    const { container } = renderPage();
    await screen.findByText("jane@example.com");
    const calls = getAllMessages.mock.calls.length;
    const [fromInput, toInput] = dateInputs(container);

    fireEvent.change(fromInput, { target: { value: "2026-10-10" } });
    fireEvent.change(toInput, { target: { value: "2026-10-01" } });

    expect(await screen.findByText(/must be on or after/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
    fireEvent.keyDown(searchInput(), { key: "Enter" });
    expect(getAllMessages.mock.calls.length).toBe(calls);
  });

  it("Clear filters resets the search and the dates", async () => {
    const user = userEvent.setup();
    window.history.pushState(
      {},
      "",
      "/contact-us?search=jane&from=2026-10-01&to=2026-10-21&page=1"
    );
    renderPage();
    await screen.findByText("jane@example.com");

    await user.click(screen.getByRole("button", { name: "Clear filters" }));

    await waitFor(() =>
      expect(lastCallParams()).toEqual({ page: 1, page_size: 10, ...NO_FILTERS })
    );
    expect(searchInput()).toHaveValue("");
  });

  it("renders HTML in a message as literal text", async () => {
    getAllMessages.mockResolvedValue(
      listResponse([
        { ...MESSAGES[0], content: '<script>alert("x")</script><b>bold</b>' },
      ])
    );

    const { container } = renderPage();

    expect(
      await screen.findByText('<script>alert("x")</script><b>bold</b>')
    ).toBeInTheDocument();
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("td b")).toBeNull();
  });

  it("a long message is truncated and expands in place", async () => {
    const user = userEvent.setup();
    const long = `${"a".repeat(150)} END`;
    getAllMessages.mockResolvedValue(
      listResponse([{ ...MESSAGES[0], content: long }])
    );
    renderPage();
    await screen.findByText("jane@example.com");

    expect(screen.queryByText(long)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Expand" }));

    expect(screen.getByText(long)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Collapse" }));
    expect(screen.queryByText(long)).not.toBeInTheDocument();
  });

  it("Arabic text is shown with dir=auto and line breaks kept", async () => {
    const arabic = "مرحبا\nكيف حالك";
    getAllMessages.mockResolvedValue(
      listResponse([{ ...MESSAGES[0], content: arabic }])
    );
    renderPage();

    const text = await screen.findByText(
      (_, node) => node?.tagName === "SPAN" && node.textContent === arabic
    );
    expect(text).toHaveAttribute("dir", "auto");
    expect(text).toHaveClass("whitespace-pre-wrap");
  });

  it("the email is a mailto link", async () => {
    renderPage();

    const link = await screen.findByRole("link", { name: "jane@example.com" });
    expect(link).toHaveAttribute("href", "mailto:jane@example.com");
  });

  it("is read-only: no edit or delete actions", async () => {
    renderPage();
    const row = (await screen.findByText("jane@example.com")).closest("tr");

    expect(within(row).getByRole("button", { name: "view" })).toBeInTheDocument();
    expect(within(row).queryByRole("button", { name: "edit" })).toBeNull();
    expect(within(row).queryByRole("button", { name: "delete" })).toBeNull();
  });

  it("a page past the end moves back to the last page", async () => {
    window.history.pushState({}, "", "/contact-us?page=9");
    getAllMessages.mockImplementation(async (params) =>
      params.page === 10 ? listResponse([], 15) : listResponse(MESSAGES, 15)
    );

    renderPage();

    await waitFor(() => expect(lastCallParams()).toMatchObject({ page: 2 }));
  });

  it("opens the message detail", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("jane@example.com");

    await user.click(screen.getByRole("button", { name: "view" }));

    expect(await screen.findByText("Contact Us Detail")).toBeInTheDocument();
  });

  it("shows the empty state", async () => {
    getAllMessages.mockResolvedValue(listResponse([], 0));

    renderPage();

    expect(await screen.findByText("No Messages Found")).toBeInTheDocument();
  });
});
