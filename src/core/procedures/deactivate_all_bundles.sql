/*
  # Deactivate All Bundles  (TEOS-64)

  1. Function Purpose
     - Atomically sets is_active = FALSE on every currently active bundle
     - Already inactive bundles are left untouched
     - Returns only the affected ids plus the before/after status, which is all
       the caller needs to write a compact audit_log entry

  2. Parameters
     - p_reason: Mandatory reason, cannot be only spaces. Validated here as a
       backstop for the UI rule; the reason itself is stored in audit_log by
       the caller (src/core/apis/bundlesAPI.jsx)

  3. Return Value
     - Success : { "success": true, "rows_affected": <int>,
                   "affected_bundle_ids": [...],
                   "old_status": "active", "new_status": "inactive",
                   "message": "..." }
     - No-op   : { "success": false, "rows_affected": 0, "message": "..." }
     - Failure : { "error": "..." }  -- surfaced by src/core/apis/apiInstance.jsx

  4. Notes
     - SECURITY INVOKER (default): runs with the caller's rights and respects RLS
     - Authorization (super admin only), the audit_log entry and the
       APP_CACHE_KEY rotation are handled on the client side
*/

CREATE OR REPLACE FUNCTION deactivate_all_bundles(p_reason TEXT)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_reason TEXT := btrim(COALESCE(p_reason, ''));
  v_ids    JSONB;
  v_count  INTEGER;
BEGIN
  IF v_reason = '' THEN
    RETURN json_build_object(
      'error', 'A reason is required to deactivate all bundles.'
    );
  END IF;

  -- The WHERE clause is what keeps already inactive bundles unchanged.
  WITH updated AS (
    UPDATE public.bundle
       SET is_active = FALSE
     WHERE is_active IS TRUE
    RETURNING id
  )
  SELECT
    COALESCE(jsonb_agg(id ORDER BY id), '[]'::jsonb),
    COUNT(*)::int
  INTO v_ids, v_count
  FROM updated;

  IF v_count = 0 THEN
    RETURN json_build_object(
      'success',       FALSE,
      'rows_affected', 0,
      'message',       'All bundles are already inactive.'
    );
  END IF;

  RETURN json_build_object(
    'success',             TRUE,
    'rows_affected',       v_count,
    'affected_bundle_ids', v_ids,
    'old_status',          'active',
    'new_status',          'inactive',
    'message',             format(
      'All active bundles have been successfully deactivated. %s bundle(s) affected.',
      v_count
    )
  );

exception
  when others then
    raise notice 'Rollback due to error: %', sqlerrm;
    -- No need for explicit ROLLBACK; PostgreSQL will auto-rollback the function on exception
    return json_build_object('error', sqlerrm);
END;
$$;

REVOKE ALL ON FUNCTION deactivate_all_bundles(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION deactivate_all_bundles(TEXT) TO authenticated;
