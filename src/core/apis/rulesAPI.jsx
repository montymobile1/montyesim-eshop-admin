import { api } from "./axios";

/*
  MS-5088: promotion rules on the admin API (backend MS-5087).
  Lists come back as res.data.data = { data: [...], total_count }.
*/

// GET /promotion-rules?search&action_id&event_id&page&page_size
export const getAllRules = (params) => api.get("promotion-rules", { params });

// GET /promotion-rules/actions -> res.data.data = [{ id, name }]
export const getAllActions = () => api.get("promotion-rules/actions");

// GET /promotion-rules/events -> res.data.data = [{ id, name }]
export const getAllEvents = () => api.get("promotion-rules/events");

// POST /promotion-rules { promotion_rule_action_id, promotion_rule_event_id, max_usage, beneficiary }
// -> 201; 409 duplicate_rule
export const AddRule = ({
  promotion_rule_action_id,
  promotion_rule_event_id,
  max_usage,
  beneficiary,
}) =>
  api.post("promotion-rules", {
    promotion_rule_action_id,
    promotion_rule_event_id,
    max_usage,
    beneficiary,
  });

// PUT /promotion-rules/{id} same body -> 200; 409 duplicate_rule
export const editRule = ({
  id,
  promotion_rule_action_id,
  promotion_rule_event_id,
  max_usage,
  beneficiary,
}) =>
  api.put(`promotion-rules/${id}`, {
    promotion_rule_action_id,
    promotion_rule_event_id,
    max_usage,
    beneficiary,
  });

// DELETE /promotion-rules/{id} -> 204; 409 rule_in_use
export const deleteRule = (ruleId) => api.delete(`promotion-rules/${ruleId}`);

// Shared helper, defined once in ./axios (kept here so pages can import it with the API).
export { getApiErrorCode } from "./axios";
