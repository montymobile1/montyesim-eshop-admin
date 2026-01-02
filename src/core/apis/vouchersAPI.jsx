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
  try {
    const res = await api(() => {
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

    return res;
  } catch (error) {
    throw error;
  }
};

export const toggleVoucherStatus = async ({ id, currentValue }) => {
  try {
    const res = await api(() => {
      let query = supabase
        .from("voucher")
        .update({ is_active: !currentValue })
        .eq("id", id)
        .select();

      return query;
    });
    return res;
  } catch (error) {
    throw error;
  }
};

export const DeleteVoucher = async (voucherId) => {
  try {
    const res = await api(() => {
      let query = supabase.from("voucher").delete().eq("id", voucherId);

      return query;
    });

    return res;
  } catch (error) {
    throw error;
  }
};

export const addVoucher = async ({ code, amount, expired_at }) => {
  try {
    const res = await api(() => {
      return supabase.from("voucher").insert([
        {
          code,
          amount,
          expired_at,
        },
      ]);
    });

    return res;
  } catch (error) {
    throw error;
  }
};
