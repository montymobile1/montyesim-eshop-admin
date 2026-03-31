import { api } from "./apiInstance";
import supabase from "./supabase";

export const getAllOrders = async ({
  page,
  pageSize,
  user,
  status,
  sortBy,
  sortDirection,
}) => {
  console.log(sortBy, sortDirection);
  const from = page * pageSize;
  const to = from + Number.parseInt(pageSize) - 1;

  try {
    // Step 1: Fetch orders
    const orderRes = await api(() => {
      let query = supabase
        .from("user_order")
        .select("*", { count: "exact" })
        .neq("order_type", "Wallet_Top_Up")
        .order(sortBy || "created_at", {
          ascending: sortDirection == "asc",
        });

      if (user) {
        query = query.eq("user_id", user);
      }

      if (status) {
        query = query.eq("order_status", status);
      }

      query = query.range(from, to);

      return query;
    });

    const userIds = [...new Set(orderRes.data.map((order) => order.user_id))];

    // Step 3: Fetch user_copy info
    const { data: users, error } = await supabase
      .from("users_copy")
      .select("id,metadata")
      .in("id", userIds);

    if (error) throw error;

    // Step 4: Merge user info into orders
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

    const enrichedOrders = orderRes.data.map((order) => ({
      ...order,
      user: userMap[order.user_id] || null,
    }));

    return {
      ...orderRes,
      data: enrichedOrders,
    };
  } catch (error) {
    console.error("Merge user info into orders failed:", error);
    throw error;
  }
};
