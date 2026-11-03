import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { toast } from "react-toastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignIn, SignOut } from "../Redux/reducers/AuthReducer";
import { store } from "../Redux/store";
import { PERMISSIONS } from "../core/vairables/Permissions";
import BannersList from "../pages/banners/BannersList";
import HandleBanners from "../pages/banners/HandleBanners";
import { act, render, screen, waitFor } from "./utils/test-utils";

vi.mock("react-toastify", async () => {
  const actual = await vi.importActual("react-toastify");
  return {
    ...actual,
    toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  };
});

vi.mock("../core/apis/bannersAPI", async () => {
  const actual = await vi.importActual("../core/apis/bannersAPI");
  return {
    getApiErrorCode: actual.getApiErrorCode,
    getAllBanners: vi.fn(),
    getBannerById: vi.fn(),
    AddBanner: vi.fn(),
    editBanner: vi.fn(),
    deleteBanner: vi.fn(),
  };
});

// The real image input opens a crop dialog; a plain file input sets the File directly.
vi.mock("../Components/form-component/FormComponent", async () => {
  const actual = await vi.importActual("../Components/form-component/FormComponent");
  return {
    ...actual,
    FormSingleImageUpload: ({ onChange, helperText }) => (
      <div>
        <input
          type="file"
          aria-label="banner image"
          onChange={(e) => onChange(e.target.files[0])}
        />
        {helperText && <span>{helperText}</span>}
      </div>
    ),
  };
});

import * as bannersAPI from "../core/apis/bannersAPI";

const signInWith = (permissions) =>
  store.dispatch(
    SignIn({
      access_token: "token",
      refresh_token: "refresh",
      expires_in: 3600,
      user: { id: "id", email: "a@example.com", role: "admin", permissions },
    })
  );

const BANNER = {
  id: 3,
  title: "Refer now",
  description: "Invite your friends",
  image_url:
    "https://storage.example.com/media/banners-web/a.png",
  action: "REFER_NOW",
  platform: "web",
  is_active: true,
  created_at: "2026-10-20T10:00:00",
};

const listResponse = {
  data: { data: { data: [BANNER], total_count: 1, facets: { all: 1, active: 1, inactive: 0 } } },
};

describe("Banners list", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/banners");
    vi.clearAllMocks();
    bannersAPI.getAllBanners.mockResolvedValue(listResponse);
  });

  afterEach(() => store.dispatch(SignOut()));

  it("loads page 1 from the API", async () => {
    signInWith([PERMISSIONS.BANNERS_READ, PERMISSIONS.BANNERS_WRITE]);
    render(<BannersList />);

    expect(await screen.findByText("Refer now")).toBeInTheDocument();
    expect(bannersAPI.getAllBanners).toHaveBeenCalledWith({
      page: 1,
      page_size: 10,
      search: undefined,
    });
  });

  it("a page past the end moves to the last valid page and replaces the URL (TEOS-289)", async () => {
    signInWith([PERMISSIONS.BANNERS_READ]);
    window.history.pushState({}, "", "/banners?pageSize=10&page=1");
    const entries = window.history.length;
    bannersAPI.getAllBanners.mockImplementation(async (params) => ({
      data: { data: { data: params.page === 1 ? [BANNER] : [], total_count: 10 } },
    }));
    render(<BannersList />);

    // two requests in a row (the empty page, then the last one): more time under load
    expect(await screen.findByText("Refer now", {}, { timeout: 5000 })).toBeInTheDocument();
    expect(bannersAPI.getAllBanners.mock.calls[0][0]).toMatchObject({ page: 2 });
    expect(bannersAPI.getAllBanners).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, page_size: 10 })
    );
    await waitFor(() => expect(window.location.search).toContain("page=0"));
    expect(screen.getByText(/1.10 of 10/)).toBeInTheDocument();
    // the out-of-range URL is replaced, not pushed (TEOS-287)
    expect(window.history.length).toBe(entries);
  });

  it("Back after a page change shows the earlier page again (TEOS-289)", async () => {
    signInWith([PERMISSIONS.BANNERS_READ]);
    bannersAPI.getAllBanners.mockImplementation(async (params) => ({
      data: {
        data: {
          data: [{ ...BANNER, id: params.page, title: `Banner p${params.page}` }],
          total_count: 25,
        },
      },
    }));
    render(<BannersList />);
    expect(await screen.findByText("Banner p1")).toBeInTheDocument();
    const entries = window.history.length;

    await userEvent.click(screen.getByRole("button", { name: /next page/i }));
    expect(await screen.findByText("Banner p2")).toBeInTheDocument();
    expect(window.history.length).toBe(entries + 1);

    window.history.back();
    expect(await screen.findByText("Banner p1")).toBeInTheDocument();
    expect(window.location.search).toContain("page=0");
  });

  it("delete calls the API only (no storage call) and refreshes", async () => {
    signInWith([PERMISSIONS.BANNERS_READ, PERMISSIONS.BANNERS_WRITE]);
    bannersAPI.deleteBanner.mockResolvedValue({ status: 204 });
    render(<BannersList />);
    await screen.findByText("Refer now");

    await userEvent.click(screen.getByRole("button", { name: "delete" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

    expect(bannersAPI.deleteBanner).toHaveBeenCalledWith(3);
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    await waitFor(() => expect(bannersAPI.getAllBanners).toHaveBeenCalledTimes(2));
  });

  it("the confirm button is disabled while the delete runs", async () => {
    signInWith([PERMISSIONS.BANNERS_READ, PERMISSIONS.BANNERS_WRITE]);
    let finish;
    bannersAPI.deleteBanner.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    render(<BannersList />);
    await screen.findByText("Refer now");

    await userEvent.click(screen.getByRole("button", { name: "delete" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

    const busy = await screen.findByRole("button", { name: "Deleting..." });
    expect(busy).toBeDisabled();
    expect(bannersAPI.deleteBanner).toHaveBeenCalledTimes(1);

    finish({ status: 204 });
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });

  it("a 404 on delete shows an info message", async () => {
    signInWith([PERMISSIONS.BANNERS_READ, PERMISSIONS.BANNERS_WRITE]);
    bannersAPI.deleteBanner.mockRejectedValue(
      Object.assign(new Error("Not found"), { response: { status: 404, data: {} } })
    );
    render(<BannersList />);
    await screen.findByText("Refer now");

    await userEvent.click(screen.getByRole("button", { name: "delete" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(toast.info).toHaveBeenCalled());
  });

  it("without write permission there is no add, edit or delete", async () => {
    signInWith([PERMISSIONS.BANNERS_READ]);
    render(<BannersList />);
    await screen.findByText("Refer now");

    expect(screen.queryByRole("button", { name: "Add" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "delete" })).not.toBeInTheDocument();
  });
});

describe("Banner edit page", () => {
  const renderEdit = () => {
    window.history.pushState({}, "", "/banners");
    window.history.pushState({}, "", "/banners/3");
    return render(
      <Routes>
        <Route path="/banners" element={<p>banners list</p>} />
        <Route path="/banners/:id" element={<HandleBanners />} />
      </Routes>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    bannersAPI.getBannerById.mockResolvedValue({ data: { data: BANNER } });
    signInWith([PERMISSIONS.BANNERS_READ, PERMISSIONS.BANNERS_WRITE]);
  });

  afterEach(() => store.dispatch(SignOut()));

  it("loads the banner and saves without a new file (image kept by the API)", async () => {
    bannersAPI.editBanner.mockResolvedValue({ data: { data: BANNER } });
    renderEdit();

    expect(await screen.findByDisplayValue("Refer now")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(bannersAPI.editBanner).toHaveBeenCalledTimes(1));
    expect(bannersAPI.editBanner).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "3",
        title: "Refer now",
        platform: "web",
        action: "REFER_NOW",
        image: BANNER.image_url,
      }),
      expect.any(Function)
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });

  it("409 duplicate_title lands on the title field", async () => {
    bannersAPI.editBanner.mockRejectedValue(
      Object.assign(new Error("Conflict"), {
        response: {
          status: 409,
          data: { developerMessage: JSON.stringify({ code: "duplicate_title" }) },
        },
      })
    );
    renderEdit();
    await screen.findByDisplayValue("Refer now");

    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("Name is not unique")).toBeInTheDocument();
  });

  it("an unknown id shows Banner not found", async () => {
    bannersAPI.getBannerById.mockRejectedValue(
      Object.assign(new Error("Not found"), { response: { status: 404, data: {} } })
    );
    renderEdit();

    expect(await screen.findByText("Banner not found")).toBeInTheDocument();
  });

  it("the title is editable on edit and is sent in the PUT", async () => {
    bannersAPI.editBanner.mockResolvedValue({ data: { data: BANNER } });
    renderEdit();
    const title = await screen.findByDisplayValue("Refer now");
    expect(title).toBeEnabled();

    await userEvent.clear(title);
    await userEvent.type(title, "Refer a friend");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() =>
      expect(bannersAPI.editBanner).toHaveBeenCalledWith(
        expect.objectContaining({ id: "3", title: "Refer a friend" }),
        expect.any(Function)
      )
    );
  });

  it("a 409 duplicate_title after renaming lands on the title field", async () => {
    bannersAPI.editBanner.mockRejectedValue(
      Object.assign(new Error("Conflict"), {
        response: {
          status: 409,
          data: { developerMessage: JSON.stringify({ code: "duplicate_title" }) },
        },
      })
    );
    renderEdit();
    const title = await screen.findByDisplayValue("Refer now");
    await userEvent.clear(title);
    await userEvent.type(title, "Taken title");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("Name is not unique")).toBeInTheDocument();
  });

  it("Cancel on a clean form leaves directly", async () => {
    renderEdit();
    await screen.findByDisplayValue("Refer now");

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(await screen.findByText("banners list")).toBeInTheDocument();
    expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();
  });

  it("Cancel with unsaved changes asks before leaving", async () => {
    renderEdit();
    const title = await screen.findByDisplayValue("Refer now");
    await userEvent.type(title, " today");

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await screen.findByText("Unsaved changes")).toBeInTheDocument();
    expect(
      screen.getByText("You have unsaved changes. Leave without saving?")
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Leave" }));
    expect(await screen.findByText("banners list")).toBeInTheDocument();
  });

  it("shows the upload progress while saving and keeps Submit disabled", async () => {
    let progress;
    let finish;
    bannersAPI.editBanner.mockImplementation((_, onUploadProgress) => {
      progress = onUploadProgress;
      return new Promise((resolve) => {
        finish = resolve;
      });
    });
    renderEdit();
    await screen.findByDisplayValue("Refer now");

    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(progress).toBeTypeOf("function"));
    act(() => progress({ loaded: 50, total: 100 }));

    expect(await screen.findByText("50%")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "save progress" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submitting..." })).toBeDisabled();

    await act(async () => finish({ data: { data: BANNER } }));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });

  it("an image over 1 MB shows a field error and sends no request", async () => {
    renderEdit();
    await screen.findByDisplayValue("Refer now");

    const big = new File([new Uint8Array(1048577)], "big.png", { type: "image/png" });
    await userEvent.upload(screen.getByLabelText("banner image"), big);
    expect(await screen.findByText("Image must be 1 MB or smaller")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(bannersAPI.editBanner).not.toHaveBeenCalled();
  });

  it("an image of exactly 1 MB is accepted", async () => {
    bannersAPI.editBanner.mockResolvedValue({ data: { data: BANNER } });
    renderEdit();
    await screen.findByDisplayValue("Refer now");

    const ok = new File([new Uint8Array(1048576)], "ok.png", { type: "image/png" });
    await userEvent.upload(screen.getByLabelText("banner image"), ok);
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(bannersAPI.editBanner).toHaveBeenCalledTimes(1));
    expect(bannersAPI.editBanner.mock.calls[0][0].image).toBe(ok);
  });

  it.each([
    ["the API's message", { message: "The image is larger than 1 MB." }, "The image is larger than 1 MB."],
    ["no API message (a proxy)", {}, "Image too large"],
  ])("a 413 with %s lands on the image field (TEOS-191)", async (_case, data, message) => {
    bannersAPI.editBanner.mockRejectedValue(
      Object.assign(new Error("Too large"), { response: { status: 413, data } })
    );
    renderEdit();
    await screen.findByDisplayValue("Refer now");

    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText(message)).toBeInTheDocument();
  });
});
