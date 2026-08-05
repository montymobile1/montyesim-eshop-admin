import { api } from "./apiInstance";
import supabase from "./supabase";

/*
  The browser cannot read its own public IP, so it is resolved server side from
  the request headers. Falls back to null - the IP is only recorded "when
  available", and a missing IP must never block the operation being audited.
*/
export const getClientIpAddress = async () => {
  try {
    const { data, error } = await supabase.rpc("get_client_ip_address");

    return error ? null : data || null;
  } catch {
    return null;
  }
};

/*
  audit_log stores old_data / new_data as JSON strings and operation_details as
  jsonb, so a row can arrive either already parsed or still as text depending on
  the column type. Normalise both here instead of at every render site.
*/
export const parseAuditJson = (value) => {
  if (value == null) return null;
  if (typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const buildUserLabel = (user) => {
  const firstName = user?.metadata?.first_name || "";
  const lastName = user?.metadata?.last_name || "";
  const fullName = `${firstName} ${lastName}`.trim();

  return fullName || user?.email || user?.metadata?.email || null;
};

export const getAllAuditLogs = async ({ page, pageSize, tableName }) => {
  const from = page * pageSize;
  const to = from + pageSize - 1;

  try {
    const res = await api(() => {
      let query = supabase.from("audit_log").select("*", { count: "exact" });

      if (tableName?.trim()) {
        query = query.ilike("table_name", `%${tableName.trim()}%`);
      }

      query = query.range(from, to).order("changed_at", { ascending: false });

      return query;
    });

    if (res?.error) {
      return res;
    }

    // Resolve the actor ids to something readable in one extra round trip.
    const userIds = [
      ...new Set((res?.data || []).map((row) => row?.changed_by).filter(Boolean)),
    ];

    let userMap = {};
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from("users_copy")
        .select("id, email, metadata")
        .in("id", userIds);

      userMap = Object.fromEntries((users || []).map((u) => [u.id, u]));
    }

    return {
      ...res,
      data: (res?.data || []).map((row) => {
        const user = userMap[row?.changed_by] || null;
        const details = parseAuditJson(row?.operation_details) || {};

        return {
          ...row,
          user,
          changed_by_label: buildUserLabel(user) || row?.changed_by || null,
          operation_details: details,
          reason: details?.reason ?? null,
          ip_address: details?.ip_address ?? null,
          rows_affected: details?.rows_affected ?? null,
          hours_banned: details?.hours_banned ?? null,
        };
      }),
    };
  } catch (error) {
    return { data: [], count: 0, error: error?.message || "Failed to load logs" };
  }
};
