import { api } from "./apiInstance";
import { deleteImageFromSupabase, uploadImage } from "./mediaAPI";
import supabase from "./supabase";

// Normalizes alternative_country into a comma-separated string, or null when empty.
const toAlternativeCountry = (value, country) => {
  console.log(value, "valueeeee", country);
  const str = Array.isArray(value) ? value.join(",") : value;
  return str?.length ? str : null;
};

/* EXPLANATION:
Countries synced from the provider carry a full `data` payload
(id / icon / country / iso3_code / zone_name / country_code / operator_list).
A country added from this admin has no such source, so we build the same shape
here — deriving the codes from the tag name (spaces -> underscores) the same way
the "regions" branch derives region_code. */
const buildCountryData = (name, id, icon) => {
  const code = name ? name.split(" ").join("_") : null;

  return {
    id: id || null,
    icon: icon || null,
    country: name || null,
    iso3_code: code,
    zone_name: "Unknown",
    country_code: code,
    operator_list: null,
  };
};

export const getAllGroups = async (page, pageSize, name, async = false) => {
  const from = async ? (page - 1) * pageSize : page * pageSize;
  const to = from + pageSize - 1;

  try {
    const res = await api(() => {
      let query = supabase.from("tag_group").select("*", { count: "exact" });

      if (name?.trim()) {
        query = query.ilike("name", `%${name}%`);
      }

      query = query.range(from, to).order("created_at", { ascending: false });

      return query;
    });

    return res;
  } catch (error) {
    console.error("error in getAllGroups:", error);
    throw error;
  }
};

export const getGroupById = async (id, search) => {
  try {
    const res = await api(() => {
      let query = supabase
        .from("tag_group")
        .select("*, tag(*)", { count: "exact" })
        .eq("id", id)
        .order("sorting_number", { referencedTable: "tag", ascending: true });

      if (search && search.trim() !== "") {
        query = query.ilike("tag.name", `%${search}%`);
      }

      return query.single();
    });

    return res;
  } catch (error) {
    console.error("error in getGroupById:", error);
    throw error;
  }
};

export const updateTagGroupsOrder = async (groups) => {
  try {
    const { data, error } = await supabase
      .from("tag")
      .upsert(groups, { onConflict: "id" })
      .select();

    if (error) throw error;

    const { error: appConfigError } = await supabase
      .from("app_config")
      .select("value")
      .eq("key", "APP_CACHE_KEY")
      .single();

    if (!appConfigError) {
      const newUuid = crypto.randomUUID();
      await supabase
        .from("app_config")
        .update({ value: newUuid })
        .eq("key", "APP_CACHE_KEY");
    }
    return data;
  } catch (err) {
    console.error("Error updating multiple tag_groups:", err);
    throw err;
  }
};
export const toggleGroupStatus = async ({ id, currentValue }) => {
  try {
    const res = await api(() => {
      let query = supabase
        .from("tag_group")
        .update({ is_active: !currentValue })
        .eq("id", id)
        .select();

      return query;
    });

    return res;
  } catch (error) {
    console.error("error in toggleGroupStatus:", error);
    throw error;
  }
};

export async function cleanupTagUploadedIcons(tagsWithUploadedIcons) {
  if (!tagsWithUploadedIcons?.length) return;

  const bucketName = "media";

  const deletePromises = tagsWithUploadedIcons
    .filter((tag) => tag.icon)
    .map((tag) => {
      const publicUrl = tag.icon;
      const prefix = `/storage/v1/object/public/${bucketName}/`;

      const path = publicUrl.startsWith(prefix)
        ? publicUrl.slice(prefix.length)
        : publicUrl;

      if (!path || path.startsWith("http")) return null;
      return deleteImageFromSupabase(tag?.id, path);
    })
    .filter(Boolean); // Remove any nulls

  await Promise.all(deletePromises);
}

export const addGroup = async (payload) => {
  const { group: groupPayload, tag: tagPayload } = payload;

  const uploadPromises = tagPayload.map(async (el) => {
    if (el.icon) {
      try {
        const res = await uploadImage({
          group_name: encodeURIComponent(groupPayload?.name),
          name: encodeURIComponent(el?.name),
          icon: el.icon,
        });

        if (res?.error) return { ...el, error: res };

        const publicUrl = res?.data?.path
          ? `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/media/${
              res.data.path
            }`
          : null;

        return {
          ...el,
          id: res?.data?.generatedUUID,
          icon: publicUrl,
          data: {
            ...(el?.data || {}),
            ...(groupPayload?.name?.toLowerCase() == "regions" && {
              guid: res?.data?.generatedUUID,
              icon: publicUrl,
              zone_name: encodeURIComponent(el?.name),
              region_code: encodeURIComponent(el?.name)?.split(" ").join("_"),
              region_name: encodeURIComponent(el?.name),
            }),
            ...(groupPayload?.name?.toLowerCase() == "countries" &&
              buildCountryData(el?.name, res?.data?.generatedUUID, publicUrl)),
            alternative_country: toAlternativeCountry(el?.alternative_country),
          },
        };
      } catch (error) {
        return { ...el, error: { message: "Upload failed" } };
      }
    } else {
      const uuid = crypto.randomUUID();
      return {
        ...el,
        id: uuid,
        data: {
          ...(el?.data || {}),
          ...(groupPayload?.name?.toLowerCase() === "regions" && {
            guid: uuid,
            icon: null,
            zone_name: encodeURIComponent(el?.name),
            region_code: encodeURIComponent(el?.name)?.split(" ").join("_"),
            region_name: encodeURIComponent(el?.name),
          }),
          ...(groupPayload?.name?.toLowerCase() === "countries" &&
            buildCountryData(el?.name, uuid, null)),
          alternative_country: toAlternativeCountry(el?.alternative_country),
        },
      };
    }
  });

  const tagsWithUploadedIcons = await Promise.all(uploadPromises);

  // Check for upload errors before continuing
  const hasUploadErrors = tagsWithUploadedIcons.some((tag) => tag.error);
  if (hasUploadErrors) {
    await cleanupTagUploadedIcons(tagsWithUploadedIcons);
    return { error: "Icon upload failed for one or more tags." };
  }
  /*NOTES : for testing rollbacks
   const faultyTags = tagsWithUploadedIcons.map(({ name, icon }, index) => ({
     name: index === 0 ? null : name, // Inject a null for the first tag's name
     icon,
   }));
  */

  // Call the RPC function
  const rpcRes = await api(() =>
    supabase.rpc("insert_group_with_tags", {
      _name: groupPayload.name,
      _group_category: groupPayload.group_category,
      _type: groupPayload.type,
      _tags: tagsWithUploadedIcons.map(({ id, name, icon, data }) => ({
        id,
        name,
        icon,
        data,
      })),
    }),
  );

  if (rpcRes?.error) {
    await cleanupTagUploadedIcons(tagsWithUploadedIcons);
  } else {
    // Refresh the app cache key so clients pick up the new group/tags
    const { error: appConfigError } = await supabase
      .from("app_config")
      .select("value")
      .eq("key", "APP_CACHE_KEY")
      .single();

    if (!appConfigError) {
      const newUuid = crypto.randomUUID();
      await supabase
        .from("app_config")
        .update({ value: newUuid })
        .eq("key", "APP_CACHE_KEY");
    }
  }
  return rpcRes;
};

export const deleteGroup = async (groupId) => {
  // Clean up uploaded icons first (just like before)

  const fetchRes = await api(() => {
    let query = supabase
      .from("tag")
      .select("*, tag_group(name)")
      .eq("tag_group_id", groupId);
    return query;
  });

  if (fetchRes?.error) return fetchRes;

  if (fetchRes?.data && fetchRes?.data?.length > 0) {
    cleanupTagUploadedIcons(fetchRes?.data);
  }

  // Call the new RPC function
  const rpcRes = await api(() =>
    supabase.rpc("delete_group_if_no_bundle", {
      _group_id: groupId,
    }),
  );

  if (rpcRes?.error) {
    if (fetchRes?.data?.length > 0) {
      fetchRes?.data.forEach((tag) => {
        uploadImage({
          group_name: tag?.tag_group?.name,
          name: tag?.name,
          icon: tag.icon,
        });
      });
    }
  }
  return rpcRes;
};

export const editGroup = async (payload) => {
  const { group: groupPayload, tag: tagPayload, deletedTags, id } = payload;
  /*EXPLANATION
SCENARIOS TO BE CONSIDERED IN CASE OF ANY CHANGE:
1- Tag with no icon: If a tag does not have an icon, but it already has a linked icon in the database (meaning the user has removed the icon), 
we need to handle this by cleaning up the previous icon.

2- Tag with an existing icon: If the tag has an icon that is a Blob (e.g., a new file being uploaded), 
we need to delete any previously linked icon before uploading the new one.

3-File upload failure: If the icon upload fails (e.g., network issue, server issue), 
the uploaded icon should be cleaned up and an error should be returned.

4--RPC call failure: If the RPC call to edit_tag_group fails after the uploads, 
we need to clean up any uploaded icons for tags that were uploaded successfully.

5Handling deleted tags: If a tag is deleted, we must ensure that its associated icon is cleaned up.
*/
  // 1. Upload icons

  const uploadResults = await Promise.all(
    tagPayload.map(async (tag) => {
      try {
        const selectedTagRes = tag?.id
          ? await api(() => {
              let query = supabase
                .from("tag")
                .select("*")
                .eq("id", tag?.id)
                .single();
              return query;
            })
          : null;

        /* EXPLANATION:
        if no icon and the tag is already linked to an icon that means that the user has removed the icon
        if icon and instance of blob and in case it has already a linked icon, delete previous one to upload new one
        */
        if (!selectedTagRes?.error) {
          if (
            (!tag?.icon && selectedTagRes?.data?.icon) ||
            (tag.icon && tag.icon instanceof Blob && selectedTagRes?.data?.icon)
          ) {
            await cleanupTagUploadedIcons([selectedTagRes?.data]);
          }

          if (tag.icon && tag.icon instanceof Blob) {
            const res = await uploadImage({
              group_name: encodeURIComponent(groupPayload.name),
              name: encodeURIComponent(tag.name),
              icon: tag.icon,
            });

            if (res?.error) return { ...tag, error: res.error };

            const publicUrl = `${
              import.meta.env.VITE_SUPABASE_URL
            }/storage/v1/object/public/media/${res.data.path}`;

            return {
              ...tag,
              tag_id: tag?.id || res?.data?.generatedUUID,
              icon: publicUrl,
              data: {
                ...(tag?.data || {}),
                ...(groupPayload?.name?.toLowerCase() == "regions" && {
                  guid: tag?.id || res?.data?.generatedUUID,
                  icon: publicUrl,
                  zone_name: tag?.name,
                  region_code: tag?.name?.split(" ").join("_"),
                  region_name: tag?.name,
                }),
                // Only for tags created here — an existing country already has
                // its synced data and must not be overwritten with derived codes.
                ...(!tag?.id &&
                  groupPayload?.name?.toLowerCase() == "countries" &&
                  buildCountryData(
                    tag?.name,
                    res?.data?.generatedUUID,
                    publicUrl,
                  )),
                alternative_country: toAlternativeCountry(
                  tag?.alternative_country,
                  tag?.data?.country,
                ),
              },
            };
          }
        } else {
          return {
            ...selectedTagRes,
          };
        }
      } catch (err) {
        return { ...tag, error: { message: "Upload failed" } };
      }
      const uuid = crypto.randomUUID();
      return {
        ...tag,
        tag_id: tag?.id || uuid,
        icon: tag?.icon || null,
        data: {
          ...(tag?.data || {}),
          ...(groupPayload?.name?.toLowerCase() == "regions" && {
            guid: tag?.id || uuid,
            icon: tag?.icon || null,
            zone_name: tag?.name,
            region_code: tag?.name?.split(" ").join("_"),
            region_name: tag?.name,
          }),
          // Only for tags created here — an existing country already has
          // its synced data and must not be overwritten with derived codes.
          ...(!tag?.id &&
            groupPayload?.name?.toLowerCase() == "countries" &&
            buildCountryData(tag?.name, uuid, tag?.icon || null)),
          alternative_country: toAlternativeCountry(tag?.alternative_country),
        },
      };
    }),
  );

  const hasUploadError = uploadResults.some((t) => t.error);
  if (hasUploadError) {
    await cleanupTagUploadedIcons(uploadResults);
    return { error: "One or more icon uploads failed." };
  }

  // 2. Call RPC
  const newTags = uploadResults.filter((t) => !t.id);
  const updatedTags = uploadResults.filter((t) => t.id);
  console.log("checkkk", newTags, "neww tags", updatedTags, "updated tags");
  const rpcRes = await api(() =>
    supabase.rpc("edit_tag_group", {
      p_id: id,
      p_name: groupPayload?.name,
      p_type: groupPayload?.type,
      p_group_category: groupPayload?.group_category,
      p_new_tags: newTags,
      p_updated_tags: updatedTags,
      p_deleted_tag_ids: deletedTags?.map((tag) => tag.id),
    }),
  );

  if (rpcRes?.error) {
    await cleanupTagUploadedIcons(uploadResults);
    return rpcRes;
  }

  // 3. Cleanup deleted tag icons (after successful RPC)
  await cleanupTagUploadedIcons(deletedTags);

  // 4. Refresh the app cache key so clients pick up the edited group/tags
  const { error: appConfigError } = await supabase
    .from("app_config")
    .select("value")
    .eq("key", "APP_CACHE_KEY")
    .single();

  if (!appConfigError) {
    const newUuid = crypto.randomUUID();
    await supabase
      .from("app_config")
      .update({ value: newUuid })
      .eq("key", "APP_CACHE_KEY");
  }

  return rpcRes;
};

export const getTopCountriesCount = async () => {
  try {
    const { data, error } = await supabase
      .from("app_config")
      .select("value")
      .eq("key", "TOP_COUNTRIES_COUNT")
      .single();

    if (error) throw error;

    return data?.value;
  } catch (error) {
    console.error("error in getTopCountriesCount:", error);
    throw error;
  }
};
