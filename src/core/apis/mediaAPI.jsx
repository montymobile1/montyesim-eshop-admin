import { api } from "./apiInstance";
import supabase from "./supabase";

export const deleteImageFromSupabase = async (tagId, path) => {
  if (!path) return;

  const { error } = await supabase.storage
    .from("media")
    .remove([decodeURIComponent(path)]);

  if (error) {
    throw error;
  } else {
    const res = await api(() => {
      let query = supabase.from("tag").update({ icon: null }).eq("id", tagId);
      return query;
    });

    return res;
  }
};

export const uploadImage = async (payload) => {
  try {
    /*EXPLANATION
I am adding a uuid to cover the following scenario:
in case user uploaded a new one with same name :"blue"
and had a deleted tag with icon name : "blue"
so to not delete the newly replaced one we added uuids

*/
    const uuid = crypto.randomUUID();
    const imageRes = await api(() => {
      let query = supabase.storage
        .from("media")
        .upload(
          `${payload?.group_name}/${uuid}-${payload?.name}.png`,
          payload?.icon,
          {
            cacheControl: "3600",
            upsert: true,
          }
        );

      return query;
    });

    if (!imageRes.data) {
      imageRes.data = {};
    }

    imageRes.data["generatedUUID"] = uuid;
    return imageRes;
  } catch (error) {
    throw error;
  }
};
