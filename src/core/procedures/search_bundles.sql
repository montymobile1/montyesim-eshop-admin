/*
  # Search Bundles with Pagination

  1. Function Purpose
     - Searches bundles table across multiple fields including JSON data
     - Returns paginated results with total count for pagination
     - Supports case-insensitive partial matching

  2. Parameters
     - p_search_term: Text to search for
     - p_page: Page number (0-based)
     - p_page_size: Number of items per page
     - p_tag_ids: Optional tag filter
     - p_is_active: Optional status filter. TRUE for active only, FALSE for
       inactive only, NULL for both. src/core/apis/bundlesAPI.jsx only sends it
       when the Status filter is used

  3. Return Value
     - JSON object with "items" array and "total_count" integer
*/

CREATE OR REPLACE FUNCTION search_bundles(
  p_search_term TEXT,
  p_page INTEGER DEFAULT 0,
  p_page_size INTEGER DEFAULT 10,
  p_tag_ids UUID[] DEFAULT NULL, -- New parameter
  p_is_active BOOLEAN DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_offset INTEGER := p_page * p_page_size;
  v_items JSON;
  v_total_count INTEGER;
BEGIN
  -- Get matching records with optional tag filtering
  SELECT
    json_agg(t)
  INTO
    v_items
  FROM (
    SELECT DISTINCT b.*
    FROM bundle b
    LEFT JOIN bundle_tag bt ON b.id = bt.bundle_id
    WHERE
      (
        p_search_term IS NULL OR
        b.id::text ILIKE '%' || p_search_term || '%' OR
        b.bundle_name ILIKE '%' || p_search_term || '%' OR
        b.data->>'bundle_name' ILIKE '%' || p_search_term || '%' OR
        b.data->>'bundle_info_code' ILIKE '%' || p_search_term || '%'
      )
      AND (
        p_tag_ids IS NULL OR cardinality(p_tag_ids) = 0 OR bt.tag_id = ANY(p_tag_ids)
      )
      AND (
        p_is_active IS NULL OR b.is_active IS p_is_active
      )
    ORDER BY b.bundle_name
    LIMIT p_page_size
    OFFSET v_offset
  ) t;

  -- Get total count with the same filtering
  SELECT
    COUNT(DISTINCT b.id)
  INTO
    v_total_count
  FROM bundle b
  LEFT JOIN bundle_tag bt ON b.id = bt.bundle_id
  WHERE
    (
      p_search_term IS NULL OR
      b.id::text ILIKE '%' || p_search_term || '%' OR
      b.bundle_name ILIKE '%' || p_search_term || '%' OR
      b.data->>'bundle_name' ILIKE '%' || p_search_term || '%' OR
      b.data->>'bundle_info_code' ILIKE '%' || p_search_term || '%'
    )
    AND (
        p_tag_ids IS NULL OR cardinality(p_tag_ids) = 0 OR bt.tag_id = ANY(p_tag_ids)
    )
    AND (
        p_is_active IS NULL OR b.is_active IS p_is_active
    );

  -- Handle no result case
  IF v_items IS NULL THEN
    v_items := '[]';
  END IF;

  -- Return results
  RETURN json_build_object(
    'items', v_items,
    'total_count', v_total_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
