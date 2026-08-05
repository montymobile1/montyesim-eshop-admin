/*
  # audit_log.operation_details  (TEOS-64)

  Adds the column the bulk bundle actions use to store the extra context of an
  operation, next to the existing old_data / new_data columns.

  Written by src/core/apis/bundlesAPI.jsx as, for example:
    { "reason": "...", "ip_address": "1.2.3.4", "rows_affected": 12 }

  Idempotent - safe to re-run.
*/

ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS operation_details JSONB;
