import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import TableComponent from "../Components/shared/table-component/TableComponent";
import { render, screen } from "./utils/test-utils";

const HEADERS = [{ name: "Name" }];

const renderTable = (props = {}) =>
  render(
    <TableComponent tableHeaders={HEADERS} tableData={[]} actions={true} {...props} />
  );

describe("TableComponent toolbar", () => {
  it("renders no toolbar when no page action is given", () => {
    const { container } = renderTable();

    expect(screen.queryByTestId("table-toolbar")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    // the empty actions header cell is kept for row action columns
    expect(container.querySelectorAll("thead th")).toHaveLength(2);
  });

  it("shows only the Add button above the table when onAdd is given", async () => {
    const onAdd = vi.fn();
    const { container } = renderTable({ onAdd });

    const add = screen.getByRole("button", { name: "Add" });
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "View logs" })).not.toBeInTheDocument();

    // toolbar sits before the table, nothing in the header
    const toolbar = screen.getByTestId("table-toolbar");
    const table = container.querySelector("table");
    expect(toolbar.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelector("thead button")).toBeNull();

    await userEvent.click(add);
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it("shows Edit and View logs as separate buttons", async () => {
    const onEdit = vi.fn();
    const onLogs = vi.fn();
    renderTable({ onEdit, onLogs });

    expect(screen.queryByRole("button", { name: "Add" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onLogs).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "View logs" }));
    expect(onLogs).toHaveBeenCalledTimes(1);
  });

  it("accepts custom labels", () => {
    renderTable({ onAdd: vi.fn(), addLabel: "Add group" });
    expect(screen.getByRole("button", { name: "Add group" })).toBeInTheDocument();
  });
});
