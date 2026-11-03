import { yupResolver } from "@hookform/resolvers/yup";
import { Add, Info, Remove } from "@mui/icons-material";
import {
  Button,
  Card,
  CardContent,
  FormHelperText,
  IconButton,
  LinearProgress,
  Tooltip,
} from "@mui/material";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useDebouncedCallback } from "use-debounce";
import * as yup from "yup";
import {
  FormAvatarEditor,
  FormChipsInput,
  FormDropdownList,
  FormInput,
} from "../../Components/form-component/FormComponent";
import MuiModal from "../../Components/Modals/MuiModal";
import NoDataFound from "../../Components/shared/fallbacks/no-data-found/NoDataFound";
import GroupsHandleSkeletons from "../../Components/shared/skeletons/GroupsHandleSkeletons";
import {
  addGroup,
  editGroup,
  getApiErrorCode,
  getApiErrorDetails,
  getGroupById,
} from "../../core/apis/groupsAPI";
import useLeaveGuard from "../../core/hooks/useLeaveGuard";
import usePermission from "../../core/hooks/usePermission";
import { displayTypes, groupTypes } from "../../core/vairables/EnumData";
import { PERMISSIONS } from "../../core/vairables/Permissions";
import {
  GROUP_FORM_MARGIN_BYTES,
  MAX_GROUP_FORM_BYTES,
  MAX_GROUP_FORM_LABEL,
  MAX_GROUP_ICON_FILES,
  MAX_GROUP_TAGS,
} from "../../core/vairables/Uploads";

// TEOS-185: tag names are 1 to 60 characters, as the API checks.
const TAG_NAME_MAX = 60;

// TEOS-191/192: the schema holds every limit of the API, so a normal save never
// gets a 413 / 422 back.
const searchKeywordSchema = yup
  .array()
  .of(
    yup
      .string()
      .test(
        "not-blank",
        "Search keywords cannot be blank",
        (value) => value == null || value.trim().length > 0,
      ),
  )
  .label("Search keyword")
  .nullable()
  .max(10, "You can add up to 10 search keywords only");

// TEOS-195: a new tag needs an icon; an existing tag may lose its icon, which
// the save sends as remove_icon: true.
const iconSchema = yup
  .mixed()
  .label("Icon")
  .nullable()
  .when("tag_id", {
    is: (tagId) => !tagId,
    then: (schema) => schema.required(),
  });

// Bytes of the multipart body: the new icon files, the JSON of the tags and a
// margin for the payload fields and the headers of each file.
const formBytes = (tags) =>
  (tags || []).reduce(
    (total, tag) => total + (tag?.icon instanceof Blob ? tag.icon.size : 0),
    0,
  ) +
  JSON.stringify(
    (tags || []).map((tag) => ({ ...tag, icon: null })),
  ).length +
  GROUP_FORM_MARGIN_BYTES;

const schema = yup.object().shape({
  name: yup
    .string()
    .label("Group name")
    .max(29)
    .required()
    .nullable()
    .test(
      "not-only-spaces",
      "Name cannot be only spaces",
      (value) => value == null || value.trim().length > 0,
    ),
  type: yup.object().label("Type").required().nullable(),
  group_category: yup.object().label("Group type").required().nullable(),

  tags: yup.array().when("type", {
    is: (value) => value?.enum == "flat",
    then: (schema) =>
      schema.of(
        yup.object().shape({
          tag_id: yup.string().nullable(),
          name: yup
            .string()
            .label("Name")
            .max(TAG_NAME_MAX)
            .nullable()
            .test(
              "not-only-spaces",
              "Name cannot be only spaces",
              (value) => value == null || value.trim().length > 0,
            )
            .test(
              "conditional-required",
              "Fill group name field",
              function (value) {
                const { path, createError } = this;
                const formValues = this.options.context || {};

                if (!formValues.name || formValues.name.trim() === "") {
                  if (!value || value.trim() === "") {
                    return createError({
                      path,
                      message: "Fill group name field",
                    });
                  }
                }

                return true;
              },
            ),
          icon: iconSchema,
          search_keyword: searchKeywordSchema,
        }),
      ),
    otherwise: (schema) =>
      schema.of(
        yup.object().shape({
          tag_id: yup.string().nullable(),
          name: yup
            .string()
            .label("Name")
            .max(TAG_NAME_MAX)
            .nullable()
            .required()
            // TEOS-192: the API refuses a blank tag name, as in the flat branch above
            .test(
              "not-only-spaces",
              "Name cannot be only spaces",
              (value) => value == null || value.trim().length > 0,
            ),
          icon: iconSchema,
          search_keyword: searchKeywordSchema,
        }),
      ),
  })
    // TEOS-191: the API takes at most 500 tags in a group
    .max(MAX_GROUP_TAGS, `A group can have at most ${MAX_GROUP_TAGS} tags`)
    // TEOS-186: tag names are unique ignoring case and spaces, as the API checks
    .test("unique-tag-names", "Tag name is not unique", function (tags) {
      const indexes = duplicateTagIndexes(tags || []);
      if (!indexes.length) return true;
      return new yup.ValidationError(
        indexes.map((index) =>
          this.createError({
            path: `${this.path}[${index}].name`,
            message: "Tag name is not unique",
          }),
        ),
      );
    })
    // TEOS-187: the API takes at most 200 icon files in one save
    .test(
      "max-icon-files",
      `At most ${MAX_GROUP_ICON_FILES} new icons can be uploaded in one save`,
      (tags) =>
        (tags || []).filter((tag) => tag?.icon instanceof Blob).length <=
        MAX_GROUP_ICON_FILES,
    )
    // TEOS-192: the whole save must stay under the API form limit (413 above)
    .test(
      "max-form-size",
      `The new icons are too large together (at most ${MAX_GROUP_FORM_LABEL} in one save); save the group with fewer new icons, then add the rest`,
      (tags) => formBytes(tags) <= MAX_GROUP_FORM_BYTES,
    ),
});

// Exported for the tests of the limits that are slow to reach through the form.
export { schema as groupSchema };

const EMPTY_TAG = { name: "", icon: null, tag_id: null, search_keyword: [] };

// alternative_country is stored as a comma-separated string; the chips input wants an array
const toKeywords = (value) =>
  typeof value === "string"
    ? value
        .split(",")
        .map((keyword) => keyword.trim())
        .filter(Boolean)
    : Array.isArray(value)
      ? value
      : [];

// A loaded tag as the form holds it.
const toFormTag = (tag) => ({
  name: tag?.name || "",
  // a URL string: kept unless a new file is chosen or it is removed
  icon: tag?.icon || null,
  tag_id: tag?.id,
  search_keyword: toKeywords(tag?.data?.alternative_country),
});

// TEOS-196: 409 linked_bundles on save names the tags still used by bundles,
// e.g. "“a3” is used by 2 bundles and can't be removed." Older APIs send no
// tags, so the generic message stays.
export const linkedBundlesMessage = (details) => {
  const count = details?.bundle_count ?? 0;
  const names = Array.isArray(details?.tags)
    ? details.tags.map((tag) => tag?.name).filter(Boolean)
    : [];
  if (!names.length) {
    return `A removed tag is linked to ${count} bundle(s). Unlink them before removing it.`;
  }
  const quoted = names.map((name) => `“${name}”`).join(", ");
  // one tag: its own count when the API sends it
  const total =
    names.length === 1 ? (details.tags[0]?.bundle_count ?? count) : count;
  const bundles = `${total} ${total === 1 ? "bundle" : "bundles"}`;
  return names.length === 1
    ? `${quoted} is used by ${bundles} and can't be removed.`
    : `${quoted} are used by ${bundles} and can't be removed.`;
};

// Indexes of the tags whose (trimmed, case-insensitive) name appears more than once
const duplicateTagIndexes = (tags) => {
  const seen = {};
  tags.forEach((tag, index) => {
    const key = (tag?.name || "").trim().toLowerCase();
    seen[key] = [...(seen[key] || []), index];
  });
  return Object.values(seen)
    .filter((indexes) => indexes.length > 1)
    .flat();
};

const GroupsHandle = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams();
  const canWrite = usePermission(PERMISSIONS.GROUPS_WRITE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletedTags, setDeletedTags] = useState([]);
  // Set once the save succeeded, so the leave guard lets the redirect through.
  const [saved, setSaved] = useState(false);
  // Upload progress of the multipart save, 0-100 (MS-5086 case 16).
  const [uploadProgress, setUploadProgress] = useState(0);
  // The group copy the form was last reset with (loading display only).
  const [formData, setFormData] = useState(null);
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    setError,
    watch,
    getValues,
    formState: { errors, isDirty },
  } = useForm({
    defaultValues: {
      name: "",
      group_category: null,
      type: null,
      tags: [{ ...EMPTY_TAG }],
    },
    resolver: yupResolver(schema),
    mode: "all",
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "tags",
  });

  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      toast.error("Please check fields validation");
    }
  }, [errors]);

  const {
    data,
    isLoading: loading,
    isError,
  } = useQuery({
    queryKey: ["group", id],
    queryFn: () => getGroupById(id).then((res) => res?.data?.data),
    enabled: !!id,
    retry: false,
  });

  // TEOS-193: Cancel, the header Back arrow, in-app links and a reload all ask
  // first while the form has unsaved changes.
  const dirty = !saved && (isDirty || deletedTags.length > 0);
  const { leaveOpen, requestLeave, confirmLeave, cancelLeave } =
    useLeaveGuard(dirty);

  useEffect(() => {
    if (data) {
      reset({
        name: data?.name || "",
        type: displayTypes?.find((el) => el?.id === data?.type) || null,
        group_category:
          groupTypes?.find((el) => el?.id === data?.group_category) || null,
        tags:
          !data?.tags?.length
            ? [{ ...EMPTY_TAG }]
            : data.tags.map(toFormTag),
      });
      setDeletedTags([]);
      setFormData(data);
    }
  }, [data]);

  const handleSubmitForm = (payload) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setUploadProgress(0);
    const handleAPI = id ? editGroup : addGroup;
    const onUploadProgress = (event) => {
      if (event?.total) {
        setUploadProgress(Math.round((event.loaded * 100) / event.total));
      }
    };

    // One multipart request: the API uploads the icons, builds the region /
    // country data, checks the names and removes replaced icons itself.
    handleAPI({
      group: {
        name: payload?.name.trimEnd(),
        type: payload?.type?.id,
        group_category: payload?.group_category?.id,
      },
      tags: payload?.tags?.map(({ tag_id, search_keyword, name, icon }) => ({
        id: tag_id || null,
        name: name?.trimEnd(),
        icon,
        alternative_country: search_keyword || [],
      })),
      deletedTags: deletedTags
        .filter((tag) => tag?.tag_id)
        .map((tag) => ({ id: tag.tag_id })),
      ...(id && { id: id }),
    }, onUploadProgress)
      .then(() => {
        toast.success(`Group ${id ? "edited" : "added"} successfully`);
        queryClient.invalidateQueries({ queryKey: ["groups"] });
        queryClient.removeQueries({ queryKey: ["group", id] });
        setSaved(true);
        // TEOS-189: always back to the list, whatever page (or no page) the form was opened from
        navigate("/groups");
      })
      .catch((error) => {
        const code = getApiErrorCode(error);
        if (code === "duplicate_group_name") {
          setError("name", { type: "server", message: "Name is not unique" });
        } else if (code === "duplicate_tag_name") {
          const indexes = duplicateTagIndexes(payload?.tags || []);
          (indexes.length ? indexes : [0]).forEach((index) =>
            setError(`tags.${index}.name`, {
              type: "server",
              message: "Tag name is not unique",
            }),
          );
        } else if (code === "linked_bundles") {
          // TEOS-196: the removed tags still used by bundles come back into the form
          const details = getApiErrorDetails(error);
          restoreLinkedTags(details?.tag_ids);
          toast.error(linkedBundlesMessage(details));
        } else {
          toast.error(error?.message || "An error occured");
        }
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  // TEOS-196: put the removed tags the API refused to delete back into the form,
  // with the data they were loaded with, and keep them out of deletedTags.
  const restoreLinkedTags = (tagIds) => {
    if (!Array.isArray(tagIds) || !tagIds.length) return;
    const ids = tagIds.map(String);
    const current = getValues("tags") || [];
    const inForm = new Set(current.map((tag) => tag?.tag_id).filter(Boolean));
    const toRestore = (data?.tags || [])
      .filter((tag) => ids.includes(String(tag?.id)) && !inForm.has(tag?.id))
      .map(toFormTag);
    setDeletedTags((prev) =>
      prev.filter((tag) => !ids.includes(String(tag?.tag_id))),
    );
    if (!toRestore.length) return;
    // a lone blank new tag (left after removing every tag) gives way to them
    const onlyBlank =
      current.length === 1 && !current[0]?.tag_id && !current[0]?.name?.trim();
    if (onlyBlank) remove(0);
    append(toRestore, { shouldFocus: false });
  };

  // MS-5086 case 8: leaving with unsaved changes asks for confirmation.
  const onCancel = () => requestLeave("/groups");

  // Errors of the tag list as a whole (count, total size, icon files).
  const tagsListError = errors?.tags?.root?.message || errors?.tags?.message;

  const handleUpdateTag = (value) => {
    // EXPLANATION : Taking into consideration the switch between group and tags
    if (value?.enum == "flat") {
      const nameValue = getValues("name");

      const existing = fields?.find((el) => el?.name === nameValue);

      if (existing) {
        const toDelete = fields?.filter((el) => el?.name !== nameValue);

        setDeletedTags((prev) => [...prev, ...toDelete]);

        remove();
        append(existing);
      } else {
        setDeletedTags((prev) => [...prev, ...fields]);

        remove();
        append({ name: nameValue, icon: null, tag_id: null, search_keyword: [] });
      }
    }
  };

  const debouncedName = useDebouncedCallback(
    (value) => {
      if (watch("type")?.enum == "flat")
        setValue("tags.0.name", value, { shouldValidate: true });
    },

    200,
  );

  const debouncedTagName = useDebouncedCallback(
    (value, index) => {
      setValue(`tags.${index}.name`, value, { shouldValidate: true });
    },

    200,
  );

  // The skeleton stays until the loaded group is in the form: on the render
  // where the data arrives (or comes from the cache) the inputs still hold the
  // empty defaults, since reset() runs in the effect above.
  if (id && (loading || (data && formData !== data))) {
    return <GroupsHandleSkeletons />;
  }
  if (id && (isError || !data)) {
    return (
      <Card>
        <CardContent>
          {" "}
          <NoDataFound
            text={"Invalid ID or group data not loaded. Please try again"}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <form
        className={"flex flex-col p-6 gap-[1rem]"}
        onSubmit={handleSubmit(handleSubmitForm)}
      >
        <div className={"flex flex-row gap-[0.5rem] justify-end items-center"}>
          <Button
            variant={"contained"}
            color="secondary"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant={"contained"}
            color="primary"
            disabled={isSubmitting || !canWrite}
          >
            {isSubmitting ? "Submitting..." : "Submit"}
          </Button>
        </div>
        {isSubmitting && (
          <div className={"flex flex-row gap-[0.5rem] justify-end items-center"}>
            <LinearProgress
              variant="determinate"
              value={uploadProgress}
              aria-label="save progress"
              className={"w-[200px]"}
            />
            <span className={"text-sm"}>{uploadProgress}%</span>
          </div>
        )}
        <div className="flex items-center">
          <div className="w-[20px] h-px bg-gray-300" />
          <h6 className="px-2">Main Info</h6>
          <div className="w-[20px] h-px bg-gray-300" />
        </div>

        <div className={"flex flex-wrap gap-[1rem]"}>
          <div className={"flex-1 min-w-[200px]"}>
            <label htmlFor="name">Name* </label>
            <Controller
              id={"name"}
              render={({
                field: { onChange, value },
                fieldState: { error },
              }) => (
                <FormInput
                  placeholder={"Enter Name"}
                  value={value}
                  onChange={(value) => {
                    onChange(value);
                    debouncedName(value);
                  }}
                  helperText={error?.message}
                />
              )}
              name="name"
              control={control}
            />
          </div>
          <div className={"flex-1 min-w-[200px]"}>
            <label htmlFor="type-input">Type*</label>

            <Controller
              render={({
                field: { onChange, value },
                fieldState: { error },
              }) => (
                <FormDropdownList
                  id="type-input"
                  accessName={"title"}
                  data={displayTypes}
                  value={value}
                  onChange={(value) => {
                    onChange(value);
                    handleUpdateTag(value);
                  }}
                  helperText={error?.message}
                  placeholder={"Select Display Type"}
                />
              )}
              name="type"
              control={control}
            />
          </div>
          <div className={"flex-1 min-w-[200px]"}>
            <label htmlFor="group-input">Group Type*</label>
            <Controller
              id="group-input"
              render={({
                field: { onChange, value },
                fieldState: { error },
              }) => (
                <FormDropdownList
                  accessName={"title"}
                  data={groupTypes}
                  value={value}
                  onChange={onChange}
                  placeholder={"Select Type"}
                  helperText={error?.message}
                />
              )}
              name="group_category"
              control={control}
            />
          </div>
        </div>

        <div className="flex items-center">
          <div className="w-[20px] h-px bg-gray-300" />
          <h6 className="px-2">Tags</h6>
          <div className="w-[20px] h-px bg-gray-300" />
        </div>
        {tagsListError && (
          <FormHelperText error>{tagsListError}</FormHelperText>
        )}
        <div className="flex flex-col gap-3 w-full sm:w-[90%]">
          {fields?.map(
            (
              el,
              index, // NOSONAR
            ) => {
              const isFlat = watch("type")?.enum == "flat";
              return (
                <div
                  key={`tags-${el?.id}-${el?.index}`}
                  className="relative flex flex-col gap-3 rounded-2xl border border-gray-200 p-4"
                >
                  {!isFlat && fields?.length !== 1 && (
                    <IconButton
                      color="primary"
                      size="small"
                      className="!absolute !top-2 !right-2"
                      aria-label="remove tag"
                      onClick={() => {
                        if (el?.tag_id) {
                          setDeletedTags((prev) => [...prev, el]);
                        }
                        remove(index);
                      }}
                    >
                      <Remove fontSize="small" />
                    </IconButton>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1 min-w-0">
                      <label className={"flex flex-row items-center"}>
                        Name*{" "}
                        {isFlat && (
                          <Tooltip
                            title={`When the group type is 'flat', a tag is automatically created with the same name as the group.`}
                          >
                            <span className={"cursor-pointer"}>
                              <Info fontSize="small" />
                            </span>
                          </Tooltip>
                        )}
                      </label>
                      <Controller
                        render={({
                          field: { onChange, value },
                          fieldState: { error },
                        }) => (
                          <FormInput
                            placeholder="Enter Name"
                            value={value}
                            disabled={isFlat}
                            onChange={(value) => {
                              onChange(value);
                              debouncedTagName(value, index);
                            }}
                            helperText={error?.message}
                          />
                        )}
                        name={`tags.${[index]}.name`}
                        control={control}
                      />
                    </div>
                    <div className="w-full sm:w-[240px] shrink-0">
                      <label htmlFor="icon-input">Icon</label>
                      <Controller
                        id="icon-input"
                        render={({
                          field: { onChange, value },
                          fieldState: { error },
                        }) => (
                          <FormAvatarEditor
                            value={value}
                            name={getValues(`tags.${[index]}.name`)}
                            onChange={(value) => onChange(value)}
                            helperText={error?.message}
                          />
                        )}
                        name={`tags.${[index]}.icon`}
                        control={control}
                      />
                    </div>
                  </div>

                  <div className="w-full">
                    <label className={"flex flex-row items-center"}>
                      Search Keyword{" "}
                      <Tooltip
                        title={
                          "Alternative search keywords. Type a keyword and press Enter to add it (up to 10)."
                        }
                      >
                        <span className={"cursor-pointer"}>
                          <Info fontSize="small" />
                        </span>
                      </Tooltip>
                    </label>
                    <Controller
                      render={({
                        field: { onChange, value },
                        fieldState: { error },
                      }) => (
                        <FormChipsInput
                          placeholder="Type a keyword and press Enter"
                          value={value}
                          onChange={(value) => onChange(value)}
                          helperText={
                            error?.message ||
                            (Array.isArray(error)
                              ? error.find(Boolean)?.message
                              : undefined)
                          }
                        />
                      )}
                      name={`tags.${[index]}.search_keyword`}
                      control={control}
                    />
                  </div>
                </div>
              );
            },
          )}

          {watch("type")?.enum !== "flat" && (
            <Button
              variant="outlined"
              color="primary"
              startIcon={<Add />}
              className="self-start"
              onClick={() => append({ ...EMPTY_TAG })}
            >
              Add tag
            </Button>
          )}
        </div>
      </form>
      {leaveOpen && (
        <MuiModal
          open={true}
          onClose={cancelLeave}
          title={"Unsaved changes"}
          confirmButtonName={"Leave"}
          onConfirm={confirmLeave}
        >
          <p className={"text-center"}>
            You have unsaved changes. Leave without saving?
          </p>
        </MuiModal>
      )}
    </Card>
  );
};

export default GroupsHandle;
