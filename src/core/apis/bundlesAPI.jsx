import { api } from "./apiInstance";
import { getClientIpAddress } from "./auditLogAPI";
import supabase from "./supabase";

// Rotating APP_CACHE_KEY is how the storefront is told to drop its bundle cache.
const refreshAppCacheKey = async () => {
  const { error } = await supabase
    .from("app_config")
    .select("value")
    .eq("key", "APP_CACHE_KEY")
    .single();

  if (!error) {
    const newUuid = crypto.randomUUID();
    await supabase
      .from("app_config")
      .update({ value: newUuid })
      .eq("key", "APP_CACHE_KEY");
  }
};

/*
  Active/inactive breakdown of the whole bundle table. Returned alongside the
  paginated list so the screen knows whether "Activate All" / "Deactivate All"
  would actually change anything. Two head-only count queries, no rows fetched.
*/
export const getBundlesStatusSummary = async () => {
  try {
    const [totalRes, activeRes] = await Promise.all([
      supabase.from("bundle").select("id", { count: "exact", head: true }),
      supabase
        .from("bundle")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),
    ]);

    if (totalRes?.error || activeRes?.error) {
      return {
        data: null,
        error:
          totalRes?.error?.message ||
          activeRes?.error?.message ||
          "Failed to load bundle status",
      };
    }

    const total = totalRes?.count || 0;
    const activeCount = activeRes?.count || 0;
    const inactiveCount = total - activeCount;

    return {
      data: {
        total,
        active_count: activeCount,
        inactive_count: inactiveCount,
        has_active: activeCount > 0,
        has_inactive: inactiveCount > 0,
      },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: error?.message || "Failed to load bundle status",
    };
  }
};

/*
  One audit_log row for a bundle status change. Mirrors the shape written by
  settingsAPI.jsx (old_data / new_data stringified), plus operation_details.

  old_data / new_data deliberately carry only the affected ids and the status
  either side of the change:
    { "affected_bundle_ids": ["...", "..."], "status": "active" }
  A full snapshot of every bundle would make these rows huge on a bulk action.
*/
const writeBundleStatusAuditLog = async ({
  operation,
  affectedIds,
  oldStatus,
  newStatus,
  reason,
  ipAddress,
  rowsAffected,
  userId,
}) => {
  const ids = affectedIds || [];

  const res = await api(() =>
    supabase.from("audit_log").insert([
      {
        table_name: "bundle",
        operation: operation,
        changed_by: userId || null,
        old_data: JSON.stringify({
          affected_bundle_ids: ids,
          status: oldStatus,
        }),
        new_data: JSON.stringify({
          affected_bundle_ids: ids,
          status: newStatus,
        }),
        operation_details: {
          reason: reason || null,
          ip_address: ipAddress || null,
          rows_affected: rowsAffected || 0,
        },
      },
    ])
  );

  return res?.error || null;
};

/*
  `isActive` filters the list by status: true, false, or null / undefined for no
  filter. The status summary above is deliberately left unfiltered - it counts
  the whole table so the bulk actions still know what they would change.
*/
export const getAllBundles = async (page, pageSize, name, tags, isActive) => {
  const from = page * pageSize;
  const to = from + pageSize - 1;
  const hasStatusFilter = isActive === true || isActive === false;

  try {
    const summaryPromise = getBundlesStatusSummary();

    let res;
    if (name?.trim() === "" && tags?.length === 0) {
      const listRes = await api(() => {
        let query = supabase.from("bundle").select("*", { count: "exact" });

        if (hasStatusFilter) {
          query = query.eq("is_active", isActive);
        }

        query = query.range(from, to).order("created_at", { ascending: false });

        return query;
      });

      res = listRes;
    } else {
      const listRes = await api(() => {
        let query = supabase.rpc("search_bundles", {
          p_page: page,
          p_page_size: pageSize,
          p_search_term: name?.trim(),
          p_tag_ids: tags,
          // Only sent when a status is selected, so the call still resolves
          // against a search_bundles that predates the parameter.
          ...(hasStatusFilter ? { p_is_active: isActive } : {}),
        });

        return query;
      });
      res = {
        data: listRes?.data?.items,
        count: listRes?.data?.total_count,
        error: listRes?.error,
      };
    }

    const summary = await summaryPromise;

    return { ...res, statusSummary: summary?.data || null };
  } catch (error) {
    throw error;
  }
};

/*
  Everything a status change needs once the RPC has flipped the rows: the
  audit_log entry and the storefront cache invalidation. `auditError` is
  returned separately because a failed audit write must not be reported as a
  failed operation - the bundles are already updated at that point.
*/
const finalizeStatusChange = async ({ result, operation, reason, userId }) => {
  const ipAddress = await getClientIpAddress();

  const auditError = await writeBundleStatusAuditLog({
    operation,
    affectedIds: result?.affected_bundle_ids,
    oldStatus: result?.old_status,
    newStatus: result?.new_status,
    reason,
    ipAddress,
    rowsAffected: result?.rows_affected,
    userId,
  });

  await refreshAppCacheKey();

  return { data: result, error: null, auditError };
};

export const deactivateAllBundles = async ({ reason, userId }) => {
  try {
    const res = await api(() =>
      supabase.rpc("deactivate_all_bundles", { p_reason: reason })
    );

    if (res?.error) {
      return { data: null, error: res?.error };
    }

    // No bundle was active: nothing to audit and no cache to bust.
    if (!res?.data?.success) {
      return { data: res?.data, error: null };
    }

    return finalizeStatusChange({
      result: res?.data,
      operation: "Deactivate Bundle",
      reason: reason?.trim(),
      userId,
    });
  } catch (error) {
    return {
      data: null,
      error: error?.message || "Failed to deactivate bundles",
    };
  }
};

export const activateAllBundles = async ({ reason = null, userId } = {}) => {
  try {
    const res = await api(() => supabase.rpc("activate_all_bundles"));

    if (res?.error) {
      return { data: null, error: res?.error };
    }

    // Every bundle was already active: nothing to audit and no cache to bust.
    if (!res?.data?.success) {
      return { data: res?.data, error: null };
    }

    return finalizeStatusChange({
      result: res?.data,
      operation: "Activate Bundle",
      reason: reason?.trim() || null,
      userId,
    });
  } catch (error) {
    return {
      data: null,
      error: error?.message || "Failed to activate bundles",
    };
  }
};

/*
  Flips is_active on a single bundle. A one row update needs no procedure, so
  this goes straight through supabase, then reuses the same audit_log entry and
  cache invalidation as the bulk actions.
*/
export const toggleBundleStatus = async ({
  id,
  currentValue,
  reason,
  userId,
}) => {
  try {
    const nextValue = !currentValue;

    const res = await api(() => {
      let query = supabase
        .from("bundle")
        .update({ is_active: nextValue })
        .eq("id", id)
        .select("id");

      return query;
    });

    if (res?.error) {
      return { data: null, error: res?.error };
    }

    const updated = res?.data?.[0];
    if (!updated) {
      return { data: null, error: "Bundle not found." };
    }

    // Same shape as the bulk RPCs so every bundle audit row reads alike.
    return finalizeStatusChange({
      result: {
        success: true,
        rows_affected: 1,
        affected_bundle_ids: [updated?.id],
        old_status: nextValue ? "inactive" : "active",
        new_status: nextValue ? "active" : "inactive",
        message: nextValue
          ? "The bundle has been successfully activated."
          : "The bundle has been successfully deactivated.",
      },
      operation: nextValue ? "Activate Bundle" : "Deactivate Bundle",
      reason: reason?.trim(),
      userId,
    });
  } catch (error) {
    return {
      data: null,
      error: error?.message || "Failed to update the bundle status",
    };
  }
};
export const updateBundleTitle = async (payload) => {
  try {
    const res = await api(() => {
      let query = supabase
        .from("bundle")
        .update({ bundle_name: payload?.bundle_name })
        .eq("id", payload?.id)
        .select();

      return query;
    });

    const { error } = await supabase
      .from("app_config")
      .select("value")
      .eq("key", "APP_CACHE_KEY")
      .single();

    if (!error) {
      const newUuid = crypto.randomUUID();
      await supabase
        .from("app_config")
        .update({ value: newUuid })
        .eq("key", "APP_CACHE_KEY");
    }

    return res;
  } catch (error) {
    throw error;
  }
};

export const getBundleTagsAndGroups = async (bundleId) => {
  try {
    if (!bundleId) {
      throw new Error("Bundle ID is required");
    }
    const bundleRes = await api(() => {
      let query = supabase
        .from("bundle")
        .select("bundle_name")
        .eq("id", bundleId)
        .single();

      return query;
    });

    if (bundleRes?.error) {
      return bundleRes;
    }

    const tagRes = await api(() => {
      return supabase
        .from("bundle_tag")
        .select(
          `
          id,
          tag:tag_id (
            id,
            name,
            icon,
            tag_group:tag_group_id (
              id,
              name,
              type,
              group_category
            )
          )
        `
        )
        .eq("bundle_id", bundleId);
    });

    return {
      bundleName: bundleRes?.data?.bundle_name || null,
      data: tagRes?.data || null,
      error: tagRes?.error || bundleRes?.error,
    };
  } catch (error) {
    throw error;
  }
};

export const assignTagsToBundle = async (bundleId, tagIds) => {
  if (!bundleId || !Array.isArray(tagIds)) {
    throw new Error("Invalid bundleId or tagIds");
  }

  const insertData = tagIds.map((tagId) => ({
    bundle_id: bundleId,
    tag_id: tagId,
    is_active: true,
  }));

  // 1. Upsert selected tags
  const upsertRes = await api(() => {
    let query = supabase.from("bundle_tag").upsert(insertData, {
      onConflict: ["bundle_id", "tag_id"],
    });

    return query;
  });
  if (upsertRes?.error) {
    return upsertRes;
  }

  // 2. Delete relations not in the selected list
  const deleteRes = await api(() => {
    let query = supabase
      .from("bundle_tag")
      .delete()
      .eq("bundle_id", bundleId)
      .not("tag_id", "in", `(${tagIds.join(",")})`);
    return query;
  });

  //update cache key
  const { data, error } = await supabase
    .from("app_config")
    .select("value")
    .eq("key", "APP_CACHE_KEY")
    .single();

  if (!error) {
    const newUuid = crypto.randomUUID();
    await supabase
      .from("app_config")
      .update({ value: newUuid })
      .eq("key", "APP_CACHE_KEY");
  }

  return { error: deleteRes?.error || upsertRes?.error };
};

export const getAllBundlesDropdown = async ({
  page = 1,
  pageSize = 10,
  search = "",
} = {}) => {
  try {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const res = await api(() => {
      let query = supabase.from("bundle").select(`data`, { count: "exact" });
      if (search.trim() !== "") {
        query = query.ilike("data->>bundle_code", `%${search}%`);
      }

      query = query.range(from, to).order("created_at", { ascending: false });
      return query;
    });
    return res;
  } catch (err) {
    return { data: null, error: err, count: 0 };
  }
};
