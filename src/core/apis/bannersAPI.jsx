import { api } from "./apiInstance";
import { deleteImage, uploadImage } from "./mediaAPI";
import supabase from "./supabase";

export const getAllBanners = async (page, pageSize, name) => {
  const from = page * pageSize;
  const to = from + pageSize - 1;
  try {
    const res = await api(() => {
      let query = supabase.from("banner").select(`* `, { count: "exact" });
      if (name?.trim()) {
        query = query.ilike("title", `%${name}%`);
      }

      query = query.range(from, to).order("created_at", { ascending: false });

      return query;
    });

    return res;
  } catch (error) {
    throw error;
  }
};

export const AddBanner = async (payload) => {
  try {
    const res = await api(async () => {
      let imageUrl = payload?.image;

      // Step 1: Upload image first (if it's a File)
      if (payload?.image instanceof File) {
        const uploaded = await uploadImage({
          group_name: "banners-web",
          name: payload?.title,
          icon: payload?.image,
        });
        console.log(uploaded, "uploaded image");
        imageUrl =
          `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/` +
          uploaded?.data?.fullPath;
      }

      // Step 2: Insert banner with image URL
      const insertResponse = await supabase
        .from("banner")
        .insert([{ ...payload, image: imageUrl }])
        .select();

      if (!insertResponse || insertResponse.error) {
        throw insertResponse.error;
      }

      return insertResponse.data;
    });

    return res;
  } catch (error) {
    throw error;
  }
};

export const editBanner = async (payload) => {
  try {
    const { id, image, ...payloadWithoutId } = payload;

    // Step 1: Check if banner exists and fetch old image
    const { data: banner, error } = await api(() => {
      return supabase
        .from("banner")
        .select("id, image")
        .eq("id", id)
        .maybeSingle();
    });

    if (!banner) {
      throw new Error("Invalid Banner ID");
    }
    if (error) {
      throw error;
    }

    let finalImageUrl = image;

    // Step 2: If new image is a File, upload it
    if (image instanceof File) {
      const uploaded = await uploadImage({
        group_name: "banners-web",
        name: payload?.title,
        icon: image,
      });

      finalImageUrl = uploaded?.url; // depends on your uploadImage return

      // Step 3: Update DB with new image
      const { data: updated, error: updateError } = await supabase
        .from("banner")
        .update({ ...payloadWithoutId, image: finalImageUrl })
        .eq("id", id)
        .select();

      if (updateError) throw updateError;

      // Step 4: Delete old image (only after successful update)
      if (banner.image) {
        await deleteImage(banner.image, "banners-web");
      }

      return updated;
    } else {
      // If no new file, just update other fields
      const { data: updated, error: updateError } = await supabase
        .from("banner")
        .update({ ...payloadWithoutId, image: finalImageUrl })
        .eq("id", id)
        .select();

      if (updateError) throw updateError;

      return updated;
    }
  } catch (error) {
    throw error;
  }
};

export const checkTitleUnique = async (payload, id) => {
  const res = await api(() => {
    let query = supabase
      .from("banner")
      .select("id")
      .eq("title", payload)
      .limit(1);

    if (id) {
      query = query.neq("id", id);
    }

    return query;
  });

  return res;
};

export const getBannerById = async (id) => {
  const res = await api(() => {
    return supabase
      .from("banner")
      .select("*")
      .eq("id", id)
      .order("created_at", { ascending: true })
      .single();
  });

  return res;
};

export const deleteBanner = async (id) => {
  try {
    const res = await api(async () => {
      const { data: banner } = await supabase
        .from("banner")
        .select("image")
        .eq("id", id)
        .maybeSingle();

      const { data, error } = await supabase
        .from("banner")
        .delete()
        .in("id", [id])
        .select();

      if (error) throw error;

      if (banner?.image) {
        try {
          await deleteImage(banner.image);
        } catch (e) {
          console.warn("Failed to delete banner image:", e.message);
        }
      }

      return data;
    });

    return res;
  } catch (error) {
    throw error;
  }
};
