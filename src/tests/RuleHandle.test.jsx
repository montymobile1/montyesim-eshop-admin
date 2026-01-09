import "@testing-library/jest-dom";
import { render, screen, waitFor } from "./utils/test-utils";
import { describe, expect, it, vi, beforeEach } from "vitest";
import RuleHandle from "../Components/page-component/rules/RuleHandle";

// Mock the API calls
vi.mock("../core/apis/rulesAPI", () => ({
  getAllActions: vi.fn(() =>
    Promise.resolve({
      status: 200,
      data: [
        { id: 1, name: "Action 1" },
        { id: 2, name: "Action 2" },
      ],
    })
  ),
  getAllEvents: vi.fn(() =>
    Promise.resolve({
      status: 200,
      data: [
        { id: 1, name: "Event 1" },
        { id: 2, name: "Event 2" },
      ],
    })
  ),
  AddRule: vi.fn(),
  editRule: vi.fn(),
}));

// Mock toast
vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("RuleHandle", () => {
  const mockOnClose = vi.fn();
  const mockRefetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the dialog with form", () => {
    render(
      <RuleHandle onClose={mockOnClose} refetch={mockRefetch} data={null} />
    );

    // Check if dialog is rendered
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("renders all required labels", () => {
    const { container } = render(
      <RuleHandle onClose={mockOnClose} refetch={mockRefetch} data={null} />
    );

    // Check all labels are present by their text content
    expect(screen.getByText("Action*")).toBeInTheDocument();
    expect(screen.getByText("Event*")).toBeInTheDocument();
    expect(screen.getByText("Max Usage*")).toBeInTheDocument();
    expect(screen.getByText("Beneficiary*")).toBeInTheDocument();
  });

  it("renders all input fields", async () => {
    render(
      <RuleHandle onClose={mockOnClose} refetch={mockRefetch} data={null} />
    );

    // Wait for API calls to complete and check for placeholders
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Select Action")).toBeInTheDocument();
    });

    expect(screen.getByPlaceholderText("Select Event")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter Max Usage")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Select beneficiary")).toBeInTheDocument();
  });

  it("renders heading for Add Rule when data is null", () => {
    render(
      <RuleHandle onClose={mockOnClose} refetch={mockRefetch} data={null} />
    );

    expect(screen.getByText("Add Rule")).toBeInTheDocument();
  });

  it("renders heading for Edit Rule when data is provided", () => {
    const mockData = {
      id: 1,
      promotion_rule_action: { id: 1, name: "Action 1" },
      promotion_rule_event: { id: 1, name: "Event 1" },
      max_usage: 10,
      beneficiary: 1,
    };

    render(
      <RuleHandle onClose={mockOnClose} refetch={mockRefetch} data={mockData} />
    );

    expect(screen.getByText("Edit Rule")).toBeInTheDocument();
  });

  it("renders Cancel and Save buttons", () => {
    render(
      <RuleHandle onClose={mockOnClose} refetch={mockRefetch} data={null} />
    );

    expect(screen.getByRole("button", { name: /Cancel/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Save/i })).toBeInTheDocument();
  });

  it("renders close button", () => {
    render(
      <RuleHandle onClose={mockOnClose} refetch={mockRefetch} data={null} />
    );

    const closeButton = screen.getByRole("button", { name: /close/i });
    expect(closeButton).toBeInTheDocument();
  });
});
