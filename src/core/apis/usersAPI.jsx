import { api } from "./apiInstance";
import { getClientIpAddress } from "./auditLogAPI";
import supabase from "./supabase";

export const HOURS_PER_DAY = 24;

// 365 days, the ban duration the interface pre-fills (TEOS-63).
export const DEFAULT_BAN_DAYS = 365;

// The same duration in hours, which is what the ban is actually stored in.
export const DEFAULT_BAN_HOURS = DEFAULT_BAN_DAYS * HOURS_PER_DAY;

// What updateUserById expects to lift a ban, instead of a "<hours>h" duration.
const UNBAN_DURATION = "none";

/*
  The ban is applied and lifted with the Supabase admin API, which takes the
  duration as a string:
    { ban_duration: "8760h" }  ban for 8760 hours (365 days)
    { ban_duration: "none" }   lift the ban

  GoTrue writes auth.users.banned_until from it, refuses the sign in of a user
  whose banned_until is in the future, and lets the ban lapse on its own once
  that date passes (AC5).

  auth.admin.* is only served to a service role key, which is what
  VITE_SUPABASE_KEY holds in this project, so the shared client can make the
  call. With an anon key GoTrue answers "User not allowed" and that message is
  shown in the interface.
*/
const setBanDuration = async (userId, banDuration) => {
  const { data, error } = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: banDuration,
  });

  return { user: data?.user || null, error: error?.message || null };
};

// A ban that already lapsed is not a ban (AC5), so the date is what decides.
const isBanned = (bannedUntil) =>
  !!bannedUntil && new Date(bannedUntil).getTime() > Date.now();

/*
  users_copy does not mirror auth.users.banned_until, so the ban state of the
  rows on screen is read from the admin API, one call per row, in parallel.
  This is the same source GoTrue itself checks when the user tries to sign in.

  Rows that fail are simply left out, and {} is returned if the whole thing
  fails: the ban column is extra information and must never take the list down
  with it.
*/
const getUsersBanStatus = async (userIds) => {
  if (!userIds?.length) return {};

  try {
    const users = await Promise.all(
      userIds.map((id) =>
        supabase.auth.admin
          .getUserById(id)
          .then(({ data }) => data?.user || null)
          .catch(() => null)
      )
    );

    return Object.fromEntries(
      users.filter(Boolean).map((user) => [
        user?.id,
        {
          banned_until: user?.banned_until || null,
          is_banned: isBanned(user?.banned_until),
        },
      ])
    );
  } catch {
    return {};
  }
};

// The two values the ban status filter can take, anything else means "any".
export const BAN_STATUS = {
  banned: "banned",
  active: "active",
};

const LIST_USERS_PER_PAGE = 1000;
// 20 pages of 1000, a guard so a paging bug cannot loop forever.
const MAX_LIST_USERS_PAGES = 20;

/*
  Every banned user, as { id: banned_until }.

  A filter on ban status cannot be a column predicate, because users_copy holds
  no ban column: listUsers is the only place all the banned_until dates can be
  read at once. Bans that already lapsed are left out, so the filter agrees
  with the column and with GoTrue (AC5).

  The error is returned rather than swallowed - a filter that quietly failed
  would show the wrong rows under a filter that says otherwise, which is worse
  than showing nothing.
*/
const getBannedUsers = async () => {
  const bannedUntilById = {};

  for (let page = 1; page <= MAX_LIST_USERS_PAGES; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: LIST_USERS_PER_PAGE,
    });

    if (error) {
      return { data: null, error: error?.message || "Failed to read ban status" };
    }

    const users = data?.users || [];

    users.forEach((user) => {
      if (user?.id && isBanned(user?.banned_until)) {
        bannedUntilById[user.id] = user?.banned_until || null;
      }
    });

    // A short page is the last page.
    if (users.length < LIST_USERS_PER_PAGE) break;
  }

  return { data: bannedUntilById, error: null };
};

export const getAllUsers = async ({ page, pageSize, name, banStatus }) => {
  const from = page * pageSize;
  const to = from + pageSize - 1;
  const filterBanned = banStatus === BAN_STATUS.banned;
  const filterActive = banStatus === BAN_STATUS.active;

  try {
    /*
      Both directions of the filter only ever need the banned ids - "Banned"
      keeps them, "Active" leaves them out - and banned users are the small
      side of the set, which is what keeps the predicate a sane size. Filtering
      inside the query, rather than on the rows already fetched, is what keeps
      the count and the pagination honest.
    */
    let bannedUntilById = null;

    if (filterBanned || filterActive) {
      const banned = await getBannedUsers();

      if (banned?.error) {
        return { data: [], count: 0, error: banned.error };
      }

      bannedUntilById = banned?.data || {};
    }

    const bannedIds = bannedUntilById ? Object.keys(bannedUntilById) : [];

    // Nobody is banned: "Banned" has no rows, and PostgREST has no valid form
    // for an empty id list anyway.
    if (filterBanned && !bannedIds.length) {
      return { data: [], count: 0, error: null };
    }

    const res = await api(() => {
      let query = supabase.from("users_copy").select("*", { count: "exact" });

      if (name?.trim()) {
        query = query.ilike("email", `%${name}%`);
      }

      if (filterBanned) {
        query = query.in("id", bannedIds);
      } else if (filterActive && bannedIds.length) {
        // Nothing to exclude when the list is empty, and the clause would be
        // invalid, so it is only added when there is something in it.
        query = query.not("id", "in", `("${bannedIds.join('","')}")`);
      }

      query = query.range(from, to);

      return query;
    });

    if (res?.error) {
      return res;
    }

    /*
      With the filter on, the ban state of every row is already known from the
      list above, so the per row lookups are skipped: an "Active" row is by
      definition not banned.
    */
    const banStatusById = bannedUntilById
      ? null
      : await getUsersBanStatus(
          (res?.data || []).map((el) => el?.id).filter(Boolean)
        );

    return {
      ...res,
      data: (res?.data || []).map((el) => {
        if (bannedUntilById) {
          const bannedUntil = bannedUntilById[el?.id] ?? null;

          return { ...el, banned_until: bannedUntil, is_banned: !!bannedUntil };
        }

        return {
          ...el,
          banned_until: banStatusById[el?.id]?.banned_until ?? null,
          is_banned: banStatusById[el?.id]?.is_banned ?? false,
        };
      }),
    };
  } catch (error) {
    throw error;
  }
};

export const getAllUsersDropdown = async ({
  page = 1,
  pageSize = 10,
  name = "",
} = {}) => {
  try {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const res = await api(() => {
      let query = supabase
        .from("users_copy")
        .select("id, email, metadata")
        .not("email", "eq", null);
      if (name.trim() !== "") {
        query = query.or(`email.ilike.%${name}%`);
      }

      query = query.range(from, to).order("email", { ascending: true });
      return query;
    });
    return res;
  } catch (err) {
    return { data: null, error: err, count: 0 };
  }
};

export const userSignout = async () => {
  api(() => supabase.auth.signOut())
    .then((result) => {
      return result;
    })
    .catch((err) => {
      throw err;
    });
};
export const getAllReferralTransactions = async (
  page,
  pageSize,
  id,
  search,
  from_user,
  referral_date
) => {
  const offset = page * pageSize;

  const { data, error } = await supabase.rpc(
    "get_referral_transactions_with_count",
    {
      p_user_id: id,
      p_limit: pageSize,
      p_offset: offset,
      p_search: search,
      p_from_email: from_user,
      p_referral_date: referral_date,
    }
  );

  if (error) throw error;

  const parsed = data;

  return {
    data: parsed.data,
    count: parsed.count,
    total: parsed.total,
  };
};

export const getAllWalletTransactions = async (
  page,
  pageSize,
  userId = null
) => {
  const offset = page * pageSize;

  const { data, error } = await supabase.rpc(
    "get_wallet_transactions_with_count",
    {
      p_user_id: userId,
      p_limit: pageSize,
      p_offset: offset,
    }
  );

  if (error) throw error;

  const parsed = data;

  return {
    data: parsed.data || [],
    count: parsed.count || 0,
    total: parsed.total || 0,
  };
};

/*
  One audit_log row for a ban / unban (AC7).

  Unlike the bundle status rows, old_data and new_data are deliberately left
  NULL: a ban is not a change of application data, so everything worth keeping
  (reason, IP address, hours banned, the user it was applied to and the dates)
  belongs in operation_details.
*/
const writeUserBanAuditLog = async ({ operation, details, userId }) => {
  const res = await api(() =>
    supabase.from("audit_log").insert([
      {
        table_name: "auth.users",
        operation: operation,
        changed_by: userId || null,
        old_data: null,
        new_data: null,
        operation_details: details,
      },
    ])
  );

  return res?.error || null;
};

/*
  Bans a user for `hours` hours, 8760 (365 days) by default, with
  updateUserById({ ban_duration: "<hours>h" }).

  `auditError` is returned separately because a failed audit write must not be
  reported as a failed ban: the user is already banned at that point.
*/
export const banUser = async ({
  userId: targetUserId,
  hours = DEFAULT_BAN_HOURS,
  reason,
  adminId,
}) => {
  try {
    const banHours = Number(hours);
    const banDuration = `${banHours}h`;

    const { user, error } = await setBanDuration(targetUserId, banDuration);

    if (error) {
      return { data: null, error };
    }

    const result = {
      success: true,
      user_id: targetUserId,
      email: user?.email || null,
      banned_until: user?.banned_until || null,
      ban_duration: banDuration,
      hours_banned: banHours,
      message: `The user has been banned for ${banHours} hour(s).`,
    };

    const ipAddress = await getClientIpAddress();

    const auditError = await writeUserBanAuditLog({
      operation: "Ban User",
      details: {
        reason: reason?.trim() || null,
        ip_address: ipAddress || null,
        hours_banned: banHours,
        ban_duration: banDuration,
        user_id: targetUserId,
        user_email: result?.email || null,
        banned_at: new Date().toISOString(),
        banned_until: result?.banned_until || null,
        rows_affected: 1,
      },
      userId: adminId,
    });

    return { data: result, error: null, auditError };
  } catch (error) {
    return { data: null, error: error?.message || "Failed to ban the user" };
  }
};

/*
  Removes a ban manually (AC6): the same call as banUser, with "none" in place
  of the hours. Same audit shape too, minus the hours - an unban has no
  duration.
*/
export const unbanUser = async ({
  userId: targetUserId,
  reason,
  adminId,
  previousBannedUntil = null,
}) => {
  try {
    const { user, error } = await setBanDuration(targetUserId, UNBAN_DURATION);

    if (error) {
      return { data: null, error };
    }

    const result = {
      success: true,
      user_id: targetUserId,
      email: user?.email || null,
      ban_duration: UNBAN_DURATION,
      message:
        "The ban has been removed and the user can access the platform again.",
    };

    const ipAddress = await getClientIpAddress();

    const auditError = await writeUserBanAuditLog({
      operation: "Unban User",
      details: {
        reason: reason?.trim() || null,
        ip_address: ipAddress || null,
        hours_banned: null,
        ban_duration: UNBAN_DURATION,
        user_id: targetUserId,
        user_email: result?.email || null,
        unbanned_at: new Date().toISOString(),
        // updateUserById returns the cleared user, so the row on screen is the
        // only place the ban that was just lifted is still known.
        previous_banned_until: previousBannedUntil || null,
        rows_affected: 1,
      },
      userId: adminId,
    });

    return { data: result, error: null, auditError };
  } catch (error) {
    return { data: null, error: error?.message || "Failed to unban the user" };
  }
};

export const getUserById = async (id) => {
  try {
    const res = await api(() => {
      let query = supabase
        .from("users_copy")
        .select("*", { count: "exact" })

        .eq("id", id)
        .single();

      return query;
    });

    return res;
  } catch (error) {
    throw error;
  }
};
