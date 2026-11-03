import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import { toast } from "react-toastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

// these tests type into forms; a loaded CI machine needs more than the 5 s default
vi.setConfig({ testTimeout: 30000 });
import RuleHandle from "../Components/page-component/rules/RuleHandle";
import { render, screen, waitFor } from "./utils/test-utils";

// MS-5088: the modal on the admin API (rulesAPI mocked).
vi.mock("../core/apis/rulesAPI", async () => {
  const actual = await vi.importActual("../core/apis/rulesAPI");
  return {
    getApiErrorCode: actual.getApiErrorCode,
    getAllActions: vi.fn(() =>
      Promise.resolve({
        data: {
          data: [
            { id: 1, name: "Action 1" },
            { id: 2, name: "Action 2" },
          ],
        },
      })
    ),
    getAllEvents: vi.fn(() =>
      Promise.resolve({
        data: {
          data: [
            { id: 1, name: "Event 1" },
            { id: 2, name: "Event 2" },
          ],
        },
      })
    ),
    AddRule: vi.fn(),
    editRule: vi.fn(),
  };
});

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

import * as rulesAPI from "../core/apis/rulesAPI";

const conflict = (code) =>
  Object.assign(new Error("Conflict"), {
    response: { status: 409, data: { developerMessage: JSON.stringify({ code }) } },
  });

const pickOption = async (placeholder, optionText) => {
  await userEvent.click(screen.getByPlaceholderText(placeholder));
  await userEvent.click(await screen.findByText(optionText));
};

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

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("renders all required labels", () => {
    render(
      <RuleHandle onClose={mockOnClose} refetch={mockRefetch} data={null} />
    );

    expect(screen.getByText("Action*")).toBeInTheDocument();
    expect(screen.getByText("Event*")).toBeInTheDocument();
    expect(screen.getByText("Max Usage*")).toBeInTheDocument();
    expect(screen.getByText("Beneficiary*")).toBeInTheDocument();
  });

  it("renders all input fields and fetches actions and events once", async () => {
    render(
      <RuleHandle onClose={mockOnClose} refetch={mockRefetch} data={null} />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Select Action")).toBeInTheDocument();
    });

    expect(screen.getByPlaceholderText("Select Event")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter Max Usage")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Select beneficiary")).toBeInTheDocument();
    await waitFor(() => expect(rulesAPI.getAllActions).toHaveBeenCalledTimes(1));
    expect(rulesAPI.getAllEvents).toHaveBeenCalledTimes(1);
  });

  it("renders heading for Add Rule when data is null", () => {
    render(
      <RuleHandle onClose={mockOnClose} refetch={mockRefetch} data={null} />
    );

    expect(screen.getByText("Add Rule")).toBeInTheDocument();
  });

  it("renders heading for Edit Rule and prefills from the API row", async () => {
    const mockData = {
      id: "r1",
      action: { id: 1, name: "Action 1" },
      event: { id: 1, name: "Event 1" },
      max_usage: 10,
      beneficiary: 1,
    };

    render(
      <RuleHandle onClose={mockOnClose} refetch={mockRefetch} data={mockData} />
    );

    expect(screen.getByText("Edit Rule")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter Max Usage")).toHaveValue(10);
    expect(screen.getByPlaceholderText("Select Action")).toHaveValue("Action 1");
    expect(screen.getByPlaceholderText("Select Action")).toBeDisabled();
  });

  it("renders Cancel, Save and close buttons", () => {
    render(
      <RuleHandle onClose={mockOnClose} refetch={mockRefetch} data={null} />
    );

    expect(screen.getByRole("button", { name: /Cancel/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Save/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /close/i })).toBeInTheDocument();
  });

  it("add sends POST with ids only, then refetches and closes", async () => {
    rulesAPI.AddRule.mockResolvedValue({ status: 201, data: {} });
    render(
      <RuleHandle onClose={mockOnClose} refetch={mockRefetch} data={null} />
    );

    await pickOption("Select Action", "Action 2");
    await pickOption("Select Event", "Event 1");
    await userEvent.type(screen.getByPlaceholderText("Enter Max Usage"), "3");
    await pickOption("Select beneficiary", "Sender");
    await userEvent.click(screen.getByRole("button", { name: /Save/i }));

    await waitFor(() => expect(rulesAPI.AddRule).toHaveBeenCalledTimes(1));
    expect(rulesAPI.AddRule).toHaveBeenCalledWith({
      promotion_rule_action_id: 2,
      promotion_rule_event_id: 1,
      max_usage: 3,
      beneficiary: 1,
    });
    // TEOS-211: a JSON number, never "3"
    expect(typeof rulesAPI.AddRule.mock.calls[0][0].max_usage).toBe("number");
    await waitFor(() => expect(mockRefetch).toHaveBeenCalled());
    expect(mockOnClose).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalled();
  });

  it("409 duplicate_rule shows the message in the modal and keeps it open", async () => {
    rulesAPI.AddRule.mockRejectedValue(conflict("duplicate_rule"));
    render(
      <RuleHandle onClose={mockOnClose} refetch={mockRefetch} data={null} />
    );

    await pickOption("Select Action", "Action 1");
    await pickOption("Select Event", "Event 2");
    await userEvent.type(screen.getByPlaceholderText("Enter Max Usage"), "1");
    await pickOption("Select beneficiary", "Sender & Receiver");
    await userEvent.click(screen.getByRole("button", { name: /Save/i }));

    expect(
      await screen.findByText(
        "A rule with the same action, event, and usage limit already exists."
      )
    ).toBeInTheDocument();
    expect(mockOnClose).not.toHaveBeenCalled();
    expect(mockRefetch).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("edit sends PUT with the rule id", async () => {
    rulesAPI.editRule.mockResolvedValue({ status: 200, data: {} });
    render(
      <RuleHandle
        onClose={mockOnClose}
        refetch={mockRefetch}
        data={{
          id: "r9",
          action: { id: 1, name: "Action 1" },
          event: { id: 2, name: "Event 2" },
          max_usage: 5,
          beneficiary: 1,
        }}
      />
    );

    await pickOption("Select beneficiary", "Sender & Receiver");
    await userEvent.click(screen.getByRole("button", { name: /Save/i }));

    await waitFor(() => expect(rulesAPI.editRule).toHaveBeenCalledTimes(1));
    expect(rulesAPI.editRule).toHaveBeenCalledWith({
      id: "r9",
      promotion_rule_action_id: 1,
      promotion_rule_event_id: 2,
      max_usage: 5,
      beneficiary: 2,
    });
  });

  it("edit sends max_usage as a number even when the row holds a string (TEOS-211)", async () => {
    rulesAPI.editRule.mockResolvedValue({ status: 200, data: {} });
    render(
      <RuleHandle
        onClose={mockOnClose}
        refetch={mockRefetch}
        data={{
          id: "r9",
          action: { id: 1, name: "Action 1" },
          event: { id: 2, name: "Event 2" },
          max_usage: "7",
          beneficiary: 1,
        }}
      />
    );

    await screen.findByDisplayValue("7");
    await userEvent.click(screen.getByRole("button", { name: /Save/i }));

    await waitFor(() => expect(rulesAPI.editRule).toHaveBeenCalledTimes(1));
    const sent = rulesAPI.editRule.mock.calls[0][0];
    expect(sent.max_usage).toBe(7);
    expect(JSON.stringify(sent)).toContain('"max_usage":7');
  });
});
