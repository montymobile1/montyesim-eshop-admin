import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import { toast } from "react-toastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAllAuditLogs, getAuditLogById } from "../core/apis/auditLogAPI";
import { getUsersLookup } from "../core/apis/lookupsAPI";
import AuditLogPage from "../pages/audit-log/AuditLogPage";
import { fireEvent, render, screen, waitFor, within } from "./utils/test-utils";

vi.mock("../core/apis/auditLogAPI", () => ({
  getAllAuditLogs: vi.fn(),
  getAuditLogById: vi.fn(),
}));

vi.mock("../core/apis/lookupsAPI", () => ({
  getUsersLookup: vi.fn(),
}));

const page = (rows, total = rows.length, byTable = {}) => ({
  data: { data: { data: rows, total_count: total, facets: { by_table: byTable } } },
});

const ROWS = [
  {
    id: 20,
    changed_at: "2026-10-20T10:00:00",
    table_name: "bundle",
    operation: "UPDATE",
    legacy_operation: null,
    record_id: "7",
    changed_by: { id: "u1", email: "boss@example.com" },
    ip_address: "8.8.8.8",
    reason: "supplier issue",
    rows_affected: 1,
    client_reported: false,
    summary: "Europe 5GB",
  },
  {
    id: 10,
    changed_at: "2025-05-01T10:00:00",
    table_name: "auth.users",
    operation: "BAN",
    legacy_operation: "Ban User",
    record_id: null,
    changed_by: null,
    ip_address: "1.2.3.4",
    reason: "fraud",
    rows_affected: null,
    client_reported: true,
    summary: "Banned for 24 hours",
  },
];

const lastParams = () => getAllAuditLogs.mock.calls.at(-1)[0];

describe("Audit log page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, "", "/audit-log");
    getAllAuditLogs.mockResolvedValue(page(ROWS, 57, { bundle: 40, "auth.users": 17 }));
    getUsersLookup.mockResolvedValue({ data: { data: { data: [], total_count: 0 } } });
  });

  it("opens on page 1 with no filters and shows the projected rows", async () => {
    render(<AuditLogPage />);

    expect(await screen.findByText("boss@example.com")).toBeInTheDocument();
    expect(lastParams()).toEqual({
      page: 1,
      page_size: 10,
      table: undefined,
      operation: undefined,
      changed_by: undefined,
      from: undefined,
      to: undefined,
    });
    expect(screen.getByText("supplier issue")).toBeInTheDocument();
    expect(screen.getByText("Deleted user")).toBeInTheDocument();
  });

  it("legacy rows show IP reported by browser, API rows do not", async () => {
    render(<AuditLogPage />);
    await screen.findByText("boss@example.com");

    const legacy = screen.getByText("1.2.3.4").closest("tr");
    expect(within(legacy).getByText("IP reported by browser")).toBeInTheDocument();
    const apiRow = screen.getByText("8.8.8.8").closest("tr");
    expect(within(apiRow).queryByText("IP reported by browser")).not.toBeInTheDocument();
  });

  it("has no edit or delete action anywhere", async () => {
    render(<AuditLogPage />);
    await screen.findByText("boss@example.com");

    expect(screen.queryByRole("button", { name: "edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "delete" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "view" })).toHaveLength(2);
  });

  it("table select shows the facet counts and sends table on page 1", async () => {
    const user = userEvent.setup();
    render(<AuditLogPage />);
    await screen.findByText("boss@example.com");

    await user.click(screen.getByPlaceholderText("Select Table"));
    await user.click(await screen.findByRole("option", { name: "auth.users (17)" }));
    await user.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => expect(lastParams()).toMatchObject({ table: "auth.users", page: 1 }));
    expect(window.location.search).toContain("table=auth.users");
  });

  it("operation select sends operation", async () => {
    const user = userEvent.setup();
    render(<AuditLogPage />);
    await screen.findByText("boss@example.com");

    await user.click(screen.getByPlaceholderText("Select Operation"));
    await user.click(await screen.findByRole("option", { name: "BAN" }));
    await user.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => expect(lastParams()).toMatchObject({ operation: "BAN", page: 1 }));
  });

  it("to before from: field error and no request", async () => {
    const { container } = render(<AuditLogPage />);
    await screen.findByText("boss@example.com");
    const calls = getAllAuditLogs.mock.calls.length;
    const [fromInput, toInput] = container.querySelectorAll('input[type="date"]');

    fireEvent.change(fromInput, { target: { value: "2026-10-10" } });
    fireEvent.change(toInput, { target: { value: "2026-10-01" } });

    expect(await screen.findByText(/must be on or after/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(getAllAuditLogs.mock.calls.length).toBe(calls);
  });

  it("a stale URL with an unknown table restores the defaults with a notice", async () => {
    const info = vi.spyOn(toast, "info");
    window.history.pushState({}, "", "/audit-log?table=users;drop&page=3");
    render(<AuditLogPage />);

    await waitFor(() => expect(getAllAuditLogs).toHaveBeenCalled());
    expect(lastParams()).toMatchObject({ table: undefined, page: 1 });
    expect(info).toHaveBeenCalled();
  });

  it("empty -> the table keeps its headers and shows the No audit entries row", async () => {
    getAllAuditLogs.mockResolvedValueOnce(page([], 0));
    render(<AuditLogPage />);

    expect(await screen.findByText("No audit entries")).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    ["Table Name", "Operation", "Changed By", "Changed At", "Rows Affected", "Reason", "IP Address"].forEach(
      (name) => expect(screen.getByRole("columnheader", { name })).toBeInTheDocument()
    );
  });

  it("error -> error toast and the same table with the empty row, no Retry", async () => {
    const error = vi.spyOn(toast, "error");
    getAllAuditLogs.mockRejectedValue(new Error("boom"));
    render(<AuditLogPage />);

    expect(await screen.findByText("No audit entries")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Table Name" })).toBeInTheDocument();
    await waitFor(() => expect(error).toHaveBeenCalledWith("Failed to load the audit log"));
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    expect(screen.queryByText("Failed to load the audit log")).not.toBeInTheDocument();
  });

  it("the detail is loaded by id and shows old/new data with hidden secrets", async () => {
    const user = userEvent.setup();
    getAuditLogById.mockResolvedValue({
      data: {
        data: {
          ...ROWS[0],
          hours_banned: null,
          old_data: { bundle_name: "Europe 5GB", api_token: "***" },
          new_data: { bundle_name: "Europe 10GB", api_token: "***" },
          operation_details: {},
          parse_error: false,
        },
      },
    });
    render(<AuditLogPage />);
    await screen.findByText("boss@example.com");

    await user.click(screen.getAllByRole("button", { name: "view" })[0]);

    expect(await screen.findByText("Old Data")).toBeInTheDocument();
    expect(getAuditLogById).toHaveBeenCalledWith(20);
    expect(screen.getByText(/Europe 10GB/)).toBeInTheDocument();
    expect(screen.queryByText(/\*\*\*/)).not.toBeInTheDocument();
    expect(screen.getAllByText(/"hidden"/).length).toBe(2);
  });

  it("a BAN detail shows Banned until and Previous ban end, N/A when there was none (TEOS-150)", async () => {
    const user = userEvent.setup();
    getAuditLogById.mockResolvedValue({
      data: {
        data: {
          ...ROWS[1],
          hours_banned: 24,
          old_data: null,
          new_data: null,
          operation_details: {
            hours_banned: 24,
            banned_until: "2026-10-21T10:00:00Z",
            previous_banned_until: null,
          },
          parse_error: false,
        },
      },
    });
    render(<AuditLogPage />);
    await screen.findByText("boss@example.com");

    await user.click(screen.getAllByRole("button", { name: "view" })[1]);

    const bannedUntil = (await screen.findByText("Banned until")).parentElement;
    expect(bannedUntil).toHaveTextContent(/\d{2}-10-2026 \d{2}:\d{2}/);
    const previous = screen.getByText("Previous ban end").parentElement;
    expect(previous).toHaveTextContent("N/A");
    expect(screen.getByText("Operation Details")).toBeInTheDocument();
  });
});
