import { DefaultCurrency } from "../../core/vairables/EnumData";

/*
  Shared bits of the promotions pages (MS-5051, MS-5053, MS-5055).

  A rule's action decides whether the promotion value is an amount or a percentage.
  The API row carries rule.action.name; the rules lookup only carries the rule name
  ("DISCOUNT_AMOUNT-CREATE_ORDER-3", built by the database from the action name), so
  both are accepted.
*/
export const isAmountRule = (rule) => {
  const text = String(rule?.action?.name || rule?.label || rule?.name || "").toUpperCase();
  if (text.includes("AMOUNT")) return true;
  if (text.includes("PERCENT")) return false;
  return null;
};

export const valueUnit = (rule) =>
  isAmountRule(rule) === false ? "%" : DefaultCurrency;

export const STATUS_TABS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "scheduled", label: "Scheduled" },
  { value: "expired", label: "Expired" },
];

export const statusLabel = (status) =>
  STATUS_TABS.find((tab) => tab.value === status)?.label || status || "";

export const toNumber = (value, fallback) => {
  const number = Number.parseInt(value, 10);
  return Number.isNaN(number) || number < 0 ? fallback : number;
};

// A lookup option from an API rule row ({ id, name, action, event, ... }).
export const ruleOption = (rule) =>
  rule
    ? { ...rule, value: rule.id, label: rule.name || rule.id }
    : null;

// Bundle chips from the stored codes.
export const bundleOptions = (codes) =>
  (codes || []).map((code) => ({ value: code, label: code, bundle_code: code }));
