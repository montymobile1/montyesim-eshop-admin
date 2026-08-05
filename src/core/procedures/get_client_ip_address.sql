/*
  # Client IP Address  (TEOS-64)

  1. Function Purpose
     - Resolves the IP address of the caller so audit_log entries can record it
     - The browser cannot read its own public IP, but PostgREST exposes the
       incoming request headers, so the value is read server side instead

  2. Parameters
     - None

  3. Return Value
     - The client IP as text, or NULL when it cannot be determined.
       NULL is a valid answer: AC6 asks for the IP "when available"

  4. Resolution Order
     - cf-connecting-ip, then x-real-ip, then the first entry of
       x-forwarded-for, then the raw connection address
*/

CREATE OR REPLACE FUNCTION get_client_ip_address()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_headers JSONB;
  v_ip      TEXT;
BEGIN
  v_headers := NULLIF(current_setting('request.headers', TRUE), '')::jsonb;

  v_ip := COALESCE(
    v_headers ->> 'cf-connecting-ip',
    v_headers ->> 'x-real-ip',
    NULLIF(split_part(COALESCE(v_headers ->> 'x-forwarded-for', ''), ',', 1), '')
  );

  v_ip := NULLIF(btrim(COALESCE(v_ip, '')), '');

  RETURN COALESCE(v_ip, host(inet_client_addr()));

exception
  when others then
    -- Never let IP resolution break the operation being audited.
    return null;
END;
$$;

REVOKE ALL ON FUNCTION get_client_ip_address() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_client_ip_address() TO authenticated;
