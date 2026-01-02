import { api } from "./apiInstance";
import supabase from "./supabase";

export const getAllVouchers = async ({ page, pageSize, search }) => {
  const from = page * pageSize;
  const to = from + pageSize - 1;

  try {
    const voucherRes = await api(() => {
      let query = supabase
        .from("voucher")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });

      if (search?.trim()) {
        query = query.ilike("code", `%${search}%`);
      }

      query = query.range(from, to);

      return query;
    });

    const userIds = [
      ...new Set(
        voucherRes.data
          ?.map((order) => order.used_by)
          .filter((id) => id != null)
      ),
    ];

    // Step 3: Fetch user_copy info
    const { data: users, error } = await supabase
      .from("users_copy")
      .select("id,email")
      .in("id", userIds);

    if (error) throw error;

    const userMap = Object.fromEntries(users?.map((u) => [u.id, u]));
    const enrichedOrders = voucherRes.data?.map((order) => ({
      ...order,
      user: userMap[order.used_by] || null,
    }));

    return {
      ...voucherRes,
      data: enrichedOrders,
    };
  } catch (error) {
    throw error;
  }
};

export const checkVoucherCodeUnique = async (payload, id) => {
  return api(() => {
    let query = supabase
      .from("voucher")
      .select("id")
      .eq("code", payload)
      .limit(1);

    if (id) {
      query = query.neq("id", id);
    }

    return query;
  });
};

export const toggleVoucherStatus = async ({ id, currentValue }) => {
  return api(() =>
    supabase
      .from("voucher")
      .update({ is_active: !currentValue })
      .eq("id", id)
      .select()
  );
};

export const DeleteVoucher = async (voucherId) => {
  return api(() => supabase.from("voucher").delete().eq("id", voucherId));
};
export const addVoucher = async ({ code, amount, expired_at }) => {
  return api(() =>
    supabase.from("voucher").insert([{ code, amount, expired_at }])
  );
};
