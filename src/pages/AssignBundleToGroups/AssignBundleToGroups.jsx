import SaveIcon from "@mui/icons-material/Save";
import {
  Button,
  Card,
  CardContent,
  FormControl,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "react-toastify";
import MuiModal from "../../Components/Modals/MuiModal";
import NoDataFound from "../../Components/shared/fallbacks/no-data-found/NoDataFound";
import LookupSelect from "../../Components/shared/lookup-select/LookupSelect";
import {
  assignTagsToBundle,
  getApiErrorCode,
  getApiErrorDetails,
  getBundleById,
  getGroupTags,
} from "../../core/apis/bundlesAPI";
import { getGroupsLookup } from "../../core/apis/lookupsAPI";
import useLeaveGuard from "../../core/hooks/useLeaveGuard";
import usePermission from "../../core/hooks/usePermission";
import { PERMISSIONS } from "../../core/vairables/Permissions";
import GroupSection from "./components/GroupSection";
import { AssignBundleContext } from "./hooks/AssignBundleContext";
import AssignBundleToGroupsSkeleton from "./loaders/AssignBundleToGroupsSkeleton";

const sameSet = (a, b) =>
  a.length === b.length && a.every((id) => b.includes(id));

// GET /groups/{id}/tags answers either a plain array or a list envelope.
const tagsOf = (res) => {
  const data = res?.data?.data;
  return Array.isArray(data) ? data : data?.data || [];
};

/*
  TEOS-168: a bundle cannot be saved with any tag of an inactive group, the tags
  it already has included. The page blocks the save itself and names the tags;
  the API's 422 inactive_group_tag (tag ids) is the fallback and uses the same
  message, with the tag names the page knows.
*/
export const inactiveGroupTagMessage = (tagIds, tagNames = {}) => {
  const names = (Array.isArray(tagIds) ? tagIds : [])
    .map((tagId) => tagNames[tagId])
    .filter(Boolean)
    .map((name) => `“${name}”`);
  if (!names.length) {
    return "A selected tag belongs to an inactive group. Remove it before saving.";
  }
  return names.length === 1
    ? `${names[0]} belongs to an inactive group. Remove it before saving.`
    : `${names.join(", ")} belong to an inactive group. Remove them before saving.`;
};

// TEOS-168: is_active comes with the groups lookup and the bundle's groups; a
// missing value (older API) counts as active.
const isInactiveGroup =(group) => group?.is_active === false;

// Inactive groups are listed but can't be picked.
const groupOptionLabel = (option) =>
  isInactiveGroup(option) ? `${option?.label} (inactive)` : option?.label;

const toGroupOption = (group) => ({
  ...group,
  value: group?.id,
  label: group?.label ?? group?.name ?? "",
});

/*
  Assign bundle to groups (MS-5084): GET /bundles/{id} gives the bundle and its
  tags with their groups, GET /groups/{id}/tags the tags of each selected group,
  PUT /bundles/{id}/tags saves the whole set in one transaction. An empty set is
  allowed, so every tag can be removed (MS-5065).
  TEOS-169/170/171: the loaded set is the baseline; Save is enabled only when the
  selection differs from it, leaving with a difference asks first, and after
  Save the page stays and shows the set the API returned.
*/
export default function AssignBundleToGroups() {
  const queryClient = useQueryClient();
  const canWrite = usePermission(PERMISSIONS.BUNDLES_WRITE);

  const { bundleId } = useParams();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [savedTags, setSavedTags] = useState([]);
  const [firstPassDone, setFirstPassDone] = useState(false);
  const initialised = useRef(false);

  const bundleQuery = useQuery({
    queryKey: ["bundles", bundleId],
    queryFn: () => getBundleById(bundleId).then((res) => res?.data?.data),
    enabled: !!bundleId,
  });

  // The bundle's current tags and the groups they belong to, once per load.
  useEffect(() => {
    if (!bundleQuery.data || initialised.current) return;
    initialised.current = true;
    const tags = bundleQuery.data?.tags || [];
    const tagIds = tags.map((item) => item?.tag?.id).filter(Boolean);
    setSelectedTags(tagIds);
    setSavedTags(tagIds);
    const groups = new Map();
    tags.forEach((item) => {
      const group = item?.tag?.group;
      if (group?.id != null && !groups.has(group.id)) {
        groups.set(group.id, toGroupOption({ ...group, label: group?.name }));
      }
    });
    setSelectedGroups(Array.from(groups.values()));
  }, [bundleQuery.data]);

  const groupQueries = useQueries({
    queries: selectedGroups.map((group) => ({
      queryKey: ["groups", group?.id, "tags"],
      queryFn: () => getGroupTags(group?.id).then(tagsOf),
    })),
  });

  const tagsByGroup = useMemo(() => {
    const map = {};
    selectedGroups.forEach((group, index) => {
      map[group?.id] = {
        tags: groupQueries[index]?.data || [],
        loading: groupQueries[index]?.isPending,
        error: groupQueries[index]?.error,
      };
    });
    return map;
  }, [selectedGroups, groupQueries]);

  // Every tag the page knows (the bundle's and those of the selected groups):
  // its name, and whether its group is inactive (TEOS-168).
  const { tagNames, inactiveTagIds } = useMemo(() => {
    const names = {};
    const inactive = new Set();
    (bundleQuery.data?.tags || []).forEach((item) => {
      const tag = item?.tag;
      if (!tag?.id) return;
      names[tag.id] = tag?.name;
      if (isInactiveGroup(tag?.group)) inactive.add(tag.id);
    });
    selectedGroups.forEach((group) => {
      (tagsByGroup[group?.id]?.tags || []).forEach((tag) => {
        if (!tag?.id) return;
        names[tag.id] = tag?.name;
        if (isInactiveGroup(group)) inactive.add(tag.id);
      });
    });
    return { tagNames: names, inactiveTagIds: inactive };
  }, [bundleQuery.data, selectedGroups, tagsByGroup]);

  useEffect(() => {
    const failed = groupQueries.find((query) => query.isError);
    if (failed) toast.error(failed.error?.message || "Fail to display data");
  }, [groupQueries.map((query) => query.isError).join(",")]);

  const removeGroupTags = (groupId) => {
    const groupTags = (
      queryClient.getQueryData(["groups", groupId, "tags"]) || []
    ).map((tag) => tag?.id);
    setSelectedTags((previous) =>
      previous.filter((tagId) => !groupTags.includes(tagId))
    );
  };

  const onChangeGroups = (value) => {
    const next = (value || []).map(toGroupOption);
    const nextIds = next.map((group) => group?.id);
    selectedGroups
      .filter((group) => !nextIds.includes(group?.id))
      .forEach((group) => removeGroupTags(group?.id));
    setSelectedGroups(next);
  };

  const selectTag = (id) => {
    setSelectedTags((previous) =>
      previous.includes(id) ? previous : [...previous, id]
    );
  };

  const isTagSelected = (id) => selectedTags.includes(id);

  const removeTag = (id) => {
    setSelectedTags((previous) => previous.filter((tagId) => tagId !== id));
  };

  const dirty = !sameSet(selectedTags, savedTags);
  const { leaveOpen, requestLeave, confirmLeave, cancelLeave } =
    useLeaveGuard(dirty);

  const assignTags = () => {
    if (isSubmitting || !dirty) return;
    // TEOS-168: no save while a tag of an inactive group is still selected.
    const blocked = selectedTags.filter((tagId) => inactiveTagIds.has(tagId));
    if (blocked.length) {
      toast.error(inactiveGroupTagMessage(blocked, tagNames));
      return;
    }
    setIsSubmitting(true);

    assignTagsToBundle(bundleId, selectedTags)
      .then((res) => {
        toast.success("Tags assigned successfully");
        // TEOS-171: stay and show what the server stored (last writer wins).
        const stored = res?.data?.data?.tag_ids ?? selectedTags;
        setSelectedTags(stored);
        setSavedTags(stored);
        queryClient.invalidateQueries({ queryKey: ["bundles"] });
      })
      .catch((error) => {
        if (error?.response?.status === 404) {
          toast.error("This bundle no longer exists.");
        } else if (getApiErrorCode(error) === "inactive_group_tag") {
          // fallback: a group was switched off after the page loaded
          toast.error(
            inactiveGroupTagMessage(getApiErrorDetails(error)?.tag_ids, tagNames)
          );
        } else {
          // TEOS-172: the readable message (set by the axios interceptor),
          // never the machine code in developerMessage.
          toast.error(error?.message || "Failed to assign tags");
        }
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  const assignBundleContextValue = useMemo(
    () => ({
      selectedTags,
      removeTag,
      isTagSelected,
      selectTag,
    }),
    [selectedTags]
  );

  // One skeleton pass: the bundle, then the tags of its groups. Groups added
  // later only show their own section skeleton.
  const anyGroupPending = groupQueries.some((query) => query.isPending);
  useEffect(() => {
    if (!firstPassDone && initialised.current && !anyGroupPending) {
      setFirstPassDone(true);
    }
  }, [firstPassDone, anyGroupPending, bundleQuery.data]);

  if (!bundleId || bundleQuery.isError) {
    return (
      <Card>
        <CardContent>
          <NoDataFound
            text={"Invalid ID or bundle data not loaded. Please try again"}
          />
        </CardContent>
      </Card>
    );
  }

  if (!firstPassDone) {
    return <AssignBundleToGroupsSkeleton />;
  }

  const bundleName = bundleQuery.data?.bundle_name;

  return (
    <AssignBundleContext.Provider value={assignBundleContextValue}>
      <Card className="page-card">
        <Grid container spacing={2}>
          <Grid size={{ xs: 12 }}>
            <Typography variant="h6" display="flex" alignItems="center" gap={1}>
              {`Bundle : ${bundleName || "N/A"}`}
            </Typography>
          </Grid>
          <div className="w-full flex flex-col-reverse sm:flex-row justify-between gap-[1rem] sm:items-center">
            <div>
              <FormControl fullWidth>
                <label className="mb-2" htmlFor="group-select">
                  Groups
                </label>
                <LookupSelect
                  inputId="group-select"
                  isMulti
                  fetcher={getGroupsLookup}
                  permission={PERMISSIONS.GROUPS_READ}
                  value={selectedGroups}
                  placeholder="Select Groups"
                  isOptionDisabled={isInactiveGroup}
                  formatOptionLabel={groupOptionLabel}
                  onChange={onChangeGroups}
                />
              </FormControl>
            </div>

            <div className={"flex justify-end items-center gap-[0.5rem]"}>
              {canWrite && !dirty && !isSubmitting && (
                <Typography variant="caption" color="text.secondary">
                  Nothing to save
                </Typography>
              )}
              <Button
                variant="contained"
                color="secondary"
                onClick={() => requestLeave("/bundles")}
              >
                Cancel
              </Button>
              <Button
                startIcon={<SaveIcon />}
                variant="contained"
                color="primary"
                onClick={assignTags}
                disabled={!canWrite || isSubmitting || !dirty}
              >
                {isSubmitting ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
          <Grid size={{ xs: 12 }}>
            {selectedGroups.length === 0 ? (
              <NoDataFound text={"No Groups Selected"} />
            ) : (
              <div className={"flex flex-col gap-[1rem]"}>
                {selectedGroups.map((group) => (
                  <GroupSection
                    key={group?.id}
                    group={group}
                    tags={tagsByGroup[group?.id]?.tags || []}
                    loading={!!tagsByGroup[group?.id]?.loading}
                  />
                ))}
              </div>
            )}
          </Grid>
        </Grid>
      </Card>
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
    </AssignBundleContext.Provider>
  );
}
