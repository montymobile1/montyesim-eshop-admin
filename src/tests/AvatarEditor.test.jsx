import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AvatarEditorComponent from "../Components/shared/avatar-editor/AvatarEditorComponent";

/*
  TEOS-190: the tag icon dialog accepts what the API accepts (PNG, JPEG, WebP up to 1 MB)
  instead of the old PNG-only, 100 KB rule.
*/
vi.mock("react-avatar-editor", () => ({ default: () => <div data-testid="avatar-editor" /> }));

const file = (name, type, size) => {
  const blob = new File(["x"], name, { type });
  Object.defineProperty(blob, "size", { value: size });
  return blob;
};

const renderDialog = () =>
  render(<AvatarEditorComponent value={null} onClose={vi.fn()} updateImage={vi.fn()} />);

const drop = (input, files) => fireEvent.drop(input.parentElement, { dataTransfer: { files, types: ["Files"] } });

describe("Tag icon dialog", () => {
  it("the file input accepts PNG, JPEG and WebP", () => {
    renderDialog();
    const input = document.querySelector('input[type="file"]');

    const accept = input.getAttribute("accept");
    ["image/png", "image/jpeg", "image/webp"].forEach((type) => expect(accept).toContain(type));
  });

  it.each([
    ["icon.jpg", "image/jpeg"],
    ["icon.webp", "image/webp"],
    ["icon.png", "image/png"],
  ])("a %s of 600 KB is accepted", async (name, type) => {
    renderDialog();

    drop(document.querySelector('input[type="file"]'), [file(name, type, 600 * 1024)]);

    expect(await screen.findByTestId("avatar-editor")).toBeInTheDocument();
  });

  it("a file over 1 MB is refused with the real limit in the message", async () => {
    renderDialog();

    drop(document.querySelector('input[type="file"]'), [file("big.png", "image/png", 1100 * 1024)]);

    expect(await screen.findByText("File (1100.00 KB) is larger than 1 MB")).toBeInTheDocument();
    expect(screen.queryByTestId("avatar-editor")).not.toBeInTheDocument();
  });

  it("a GIF is refused with a readable message", async () => {
    renderDialog();

    drop(document.querySelector('input[type="file"]'), [file("anim.gif", "image/gif", 10 * 1024)]);

    await waitFor(() =>
      expect(screen.getByText("The icon must be a PNG, JPEG or WebP image")).toBeInTheDocument()
    );
  });
});
