import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "./utils/test-utils";

const { apiGet, toastError, allowed } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  toastError: vi.fn(),
  allowed: { value: true },
}));

vi.mock("../core/apis/axios", () => ({ api: { get: apiGet } }));
vi.mock("react-toastify", async () => {
  const actual = await vi.importActual("react-toastify");
  return { ...actual, toast: { ...actual.toast, error: toastError } };
});
vi.mock("../core/hooks/usePermission", () => ({
  default: () => allowed.value,
  hasPermission: () => allowed.value,
}));

import {
  getBundlesLookup,
  getGroupsLookup,
  getPromotionRulesLookup,
  getTagsLookup,
  getUsersLookup,
} from "../core/apis/lookupsAPI";
import LookupSelect from "../Components/shared/lookup-select/LookupSelect";
import {
  lookupLoadOptions,
  lookupNoOptionsMessage,
  toLookupOption,
  USERS_LOOKUP_MIN_SEARCH,
} from "../Components/shared/lookup-select/lookupLoadOptions";

const lookupResponse = (data, total_count) => ({
  data: { data: { data, total_count } },
});

beforeEach(() => {
  apiGet.mockReset();
  toastError.mockReset();
  allowed.value = true;
});

describe("lookupsAPI", () => {
  it.each([
    [getUsersLookup, "users/lookup"],
    [getBundlesLookup, "bundles/lookup"],
    [getGroupsLookup, "groups/lookup"],
    [getTagsLookup, "tags/lookup"],
    [getPromotionRulesLookup, "promotion-rules/lookup"],
  ])("%o calls GET %s with the query params", async (fn, path) => {
    const response = lookupResponse([], 0);
    apiGet.mockResolvedValue(response);
    const params = { search: "ab", page: 2, page_size: 10 };

    await expect(fn(params)).resolves.toBe(response);
    expect(apiGet).toHaveBeenCalledWith(path, { params });
  });
});

describe("lookupLoadOptions", () => {
  it("sends search/page/page_size and maps items to options", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      lookupResponse(
        [{ id: "b1", label: "Europe 5GB (EU5)", bundle_code: "EU5" }],
        25
      )
    );

    const result = await lookupLoadOptions(fetcher)(" ab ", [], { page: 1 });

    expect(fetcher).toHaveBeenCalledWith({ search: "ab", page: 1, page_size: 10 });
    expect(result.options).toEqual([
      { id: "b1", value: "b1", label: "Europe 5GB (EU5)", bundle_code: "EU5" },
    ]);
    expect(result.hasMore).toBe(true);
    expect(result.additional).toEqual({ page: 2 });
  });

  it("stops when page * page_size reaches total_count", async () => {
    const fetcher = vi.fn().mockResolvedValue(lookupResponse([{ id: "x", label: "x" }], 30));

    const result = await lookupLoadOptions(fetcher)("", [], { page: 3 });

    expect(fetcher).toHaveBeenCalledWith({ search: undefined, page: 3, page_size: 10 });
    expect(result.hasMore).toBe(false);
  });

  it("can use another field as the option value", () => {
    expect(
      toLookupOption({ id: "b1", label: "EU (EU5)", bundle_code: "EU5" }, "bundle_code").value
    ).toBe("EU5");
  });

  it.each(["a", " a "])(
    "with a minimum, a shorter search (%o) sends no request and returns no options",
    async (search) => {
      const fetcher = vi.fn();

      const result = await lookupLoadOptions(fetcher, {
        minSearchLength: USERS_LOOKUP_MIN_SEARCH,
      })(search, [], { page: 1 });

      expect(fetcher).not.toHaveBeenCalled();
      expect(result).toEqual({ options: [], hasMore: false, additional: { page: 1 } });
    }
  );

  it.each([
    ["", undefined],
    ["ab", "ab"],
  ])("with a minimum, an empty or long enough search (%o) is sent", async (search, sent) => {
    const fetcher = vi.fn().mockResolvedValue(lookupResponse([], 0));

    await lookupLoadOptions(fetcher, { minSearchLength: USERS_LOOKUP_MIN_SEARCH })(search, [], {
      page: 1,
    });

    expect(fetcher).toHaveBeenCalledWith({ search: sent, page: 1, page_size: 10 });
  });

  it("explains a too short search in the menu, otherwise says No options", () => {
    const message = lookupNoOptionsMessage(USERS_LOOKUP_MIN_SEARCH);

    expect(message({ inputValue: "a" })).toBe("Search should be more than 1 character");
    expect(message({ inputValue: "ab" })).toBe("No options");
    expect(message({ inputValue: "" })).toBe("No options");
  });

  it("on error keeps the loaded options, stops paging and shows one toast", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("Server error"));

    const result = await lookupLoadOptions(fetcher)("ab", [{ value: "old" }], { page: 2 });

    expect(result).toEqual({ options: [], hasMore: false, additional: { page: 2 } });
    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledWith("Server error");
  });
});

describe("LookupSelect", () => {
  it("loads the first page when opened and shows the labels", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(lookupResponse([{ id: "u1", label: "a@x.com", email: "a@x.com" }], 1));
    const onChange = vi.fn();
    render(
      <LookupSelect
        fetcher={fetcher}
        inputId="user-input"
        placeholder="Select User Email"
        onChange={onChange}
        value={null}
      />
    );

    await userEvent.click(screen.getByText("Select User Email"));
    await userEvent.click(await screen.findByText("a@x.com"));

    expect(fetcher).toHaveBeenCalledWith({ search: undefined, page: 1, page_size: 10 });
    expect(onChange.mock.calls[0][0]).toMatchObject({ value: "u1", label: "a@x.com", email: "a@x.com" });
  });

  it("searches with the typed text", async () => {
    const fetcher = vi.fn().mockResolvedValue(lookupResponse([], 0));
    render(<LookupSelect fetcher={fetcher} inputId="tag-input" value={null} onChange={() => {}} />);

    await userEvent.type(screen.getByRole("combobox"), "ab");

    await waitFor(() =>
      expect(fetcher).toHaveBeenCalledWith({ search: "ab", page: 1, page_size: 10 })
    );
  });

  it("with minSearchLength, one typed character shows the hint and sends no search", async () => {
    const fetcher = vi.fn().mockResolvedValue(lookupResponse([], 0));
    render(
      <LookupSelect
        fetcher={fetcher}
        minSearchLength={USERS_LOOKUP_MIN_SEARCH}
        inputId="user-input"
        value={null}
        onChange={() => {}}
      />
    );

    await userEvent.type(screen.getByRole("combobox"), "a");

    expect(
      await screen.findByText("Search should be more than 1 character")
    ).toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalledWith(expect.objectContaining({ search: "a" }));
  });

  it("is disabled when the admin lacks the lookup's read permission", () => {
    allowed.value = false;
    const { container } = render(
      <LookupSelect
        fetcher={vi.fn()}
        permission="admin.users.read"
        inputId="user-input"
        value={null}
        onChange={() => {}}
      />
    );

    expect(container.querySelector("#user-input")).toBeDisabled();
  });
});
