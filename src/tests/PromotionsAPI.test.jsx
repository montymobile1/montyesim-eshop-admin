import { beforeEach, describe, expect, it, vi } from "vitest";

/*
  rulesAPI.jsx and promotionsAPI.jsx on the admin API: URLs, bodies and query parameters.
  The shared axios instance is mocked; no network.
*/
const { apiGet, apiPost, apiPut, apiPatch, apiDelete } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
}));

vi.mock("../core/apis/axios", () => ({
  api: { get: apiGet, post: apiPost, put: apiPut, patch: apiPatch, delete: apiDelete },
  getApiErrorCode: (error) => {
    try {
      return JSON.parse(error?.response?.data?.developerMessage)?.code ?? null;
    } catch {
      return null;
    }
  },
}));

import {
  AddPromotion,
  deletePromotion,
  editPromotion,
  getAllPromotions,
  getAllPromotionsUsage,
  getApiErrorDetails,
  getPromotionById,
  togglePromotionStatus,
} from "../core/apis/promotionsAPI";
import {
  AddRule,
  deleteRule,
  editRule,
  getAllActions,
  getAllEvents,
  getAllRules,
} from "../core/apis/rulesAPI";

beforeEach(() => {
  vi.clearAllMocks();
  [apiGet, apiPost, apiPut, apiPatch, apiDelete].forEach((fn) =>
    fn.mockResolvedValue({ data: { data: {} } })
  );
});

describe("rulesAPI", () => {
  it("lists rules, actions and events", async () => {
    const params = { page: 1, page_size: 10, search: "aa", action_id: 1 };
    await getAllRules(params);
    expect(apiGet).toHaveBeenCalledWith("promotion-rules", { params });
    await getAllActions();
    expect(apiGet).toHaveBeenCalledWith("promotion-rules/actions");
    await getAllEvents();
    expect(apiGet).toHaveBeenCalledWith("promotion-rules/events");
  });

  it("creates, edits and deletes with the documented bodies only", async () => {
    await AddRule({
      promotion_rule_action_id: 1,
      promotion_rule_event_id: 2,
      max_usage: 3,
      beneficiary: 1,
      name: "ignored",
    });
    expect(apiPost).toHaveBeenCalledWith("promotion-rules", {
      promotion_rule_action_id: 1,
      promotion_rule_event_id: 2,
      max_usage: 3,
      beneficiary: 1,
    });

    await editRule({
      id: "r1",
      promotion_rule_action_id: 1,
      promotion_rule_event_id: 2,
      max_usage: 3,
      beneficiary: 2,
    });
    expect(apiPut).toHaveBeenCalledWith("promotion-rules/r1", {
      promotion_rule_action_id: 1,
      promotion_rule_event_id: 2,
      max_usage: 3,
      beneficiary: 2,
    });

    await deleteRule("r1");
    expect(apiDelete).toHaveBeenCalledWith("promotion-rules/r1");
  });
});

describe("promotionsAPI", () => {
  it("lists promotions and usage with repeated keys for arrays", async () => {
    const params = { page: 1, page_size: 10, status: "all", rule_ids: ["a", "b"] };
    await getAllPromotions(params);
    expect(apiGet).toHaveBeenCalledWith("promotions", {
      params,
      paramsSerializer: { indexes: null },
    });

    const usageParams = { page: 1, page_size: 10, bundle_ids: ["b1"], from: "2026-01-01" };
    await getAllPromotionsUsage(usageParams);
    expect(apiGet).toHaveBeenCalledWith("promotions/usage", {
      params: usageParams,
      paramsSerializer: { indexes: null },
    });

    await getPromotionById("p1");
    expect(apiGet).toHaveBeenCalledWith("promotions/p1");
  });

  it("creates with the documented fields, omitting a null amount and never sending type or callbacks", async () => {
    await AddPromotion({
      name: "Summer",
      code: "SUMMER10",
      rule_id: "r1",
      amount: null,
      valid_from: "2026-10-01T00:00:00.000Z",
      valid_to: "2026-12-31T23:59:59.999Z",
      bundle_codes: ["EU5"],
      type: "Promo",
      callback_url: "x",
      times_used: 9,
      is_active: false,
    });
    expect(apiPost).toHaveBeenCalledWith("promotions", {
      name: "Summer",
      code: "SUMMER10",
      rule_id: "r1",
      valid_from: "2026-10-01T00:00:00.000Z",
      valid_to: "2026-12-31T23:59:59.999Z",
      bundle_codes: ["EU5"],
    });

    await AddPromotion({
      name: "Summer",
      code: "SUMMER10",
      rule_id: "r1",
      amount: 10,
      valid_from: "a",
      valid_to: "b",
    });
    expect(apiPost).toHaveBeenLastCalledWith(
      "promotions",
      expect.objectContaining({ amount: 10, bundle_codes: [] })
    );
  });

  it("edits with the editable fields, adding the immutable ones only when given", async () => {
    await editPromotion({ id: "p1", name: "Winter", bundle_codes: ["EU5"], valid_to: "2027-01-01T00:00:00Z" });
    expect(apiPut).toHaveBeenCalledWith("promotions/p1", {
      name: "Winter",
      bundle_codes: ["EU5"],
      valid_to: "2027-01-01T00:00:00Z",
    });

    await editPromotion({ id: "p1", name: "Winter", bundle_codes: [], code: "NEW1", amount: 5, rule_id: "r2",
                          valid_from: "2026-01-01T00:00:00Z", times_used: 3 });
    expect(apiPut).toHaveBeenLastCalledWith("promotions/p1", {
      name: "Winter",
      bundle_codes: [],
      code: "NEW1",
      amount: 5,
      rule_id: "r2",
      valid_from: "2026-01-01T00:00:00Z",
    });
  });

  it("toggles the status and deletes by id", async () => {
    await togglePromotionStatus({ id: "p1", is_active: false });
    expect(apiPatch).toHaveBeenCalledWith("promotions/p1/status", { is_active: false });

    await deletePromotion("p1");
    expect(apiDelete).toHaveBeenCalledWith("promotions/p1");
  });

  it("getApiErrorDetails returns the whole 409 detail object", () => {
    const error = {
      response: {
        data: { developerMessage: JSON.stringify({ code: "promotion_used", times_used: 3 }) },
      },
    };
    expect(getApiErrorDetails(error)).toEqual({ code: "promotion_used", times_used: 3 });
    expect(getApiErrorDetails({ response: { data: { developerMessage: "plain text" } } })).toBeNull();
    expect(getApiErrorDetails(null)).toBeNull();
  });
});
