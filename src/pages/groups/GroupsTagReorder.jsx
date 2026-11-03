import {
  DragIndicator,
  Search as SearchIcon,
  SortByAlpha,
} from "@mui/icons-material";
import NorthIcon from "@mui/icons-material/North";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControl,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Skeleton,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { DragDropContext, Draggable, Droppable } from "react-beautiful-dnd";
import { Link, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import MuiModal from "../../Components/Modals/MuiModal";
import NoDataFound from "../../Components/shared/fallbacks/no-data-found/NoDataFound";
import {
  getApiErrorCode,
  getGroupById,
  updateTagGroupsOrder,
} from "../../core/apis/groupsAPI";
import useLeaveGuard from "../../core/hooks/useLeaveGuard";
import usePermission from "../../core/hooks/usePermission";
import { PERMISSIONS } from "../../core/vairables/Permissions";

/*
  Reorder the tags of a group: PUT /groups/{id}/tags/order { tag_ids } with every
  tag of the group, in order.
  TEOS-202/205: the loaded order is the baseline; Save and Reset are enabled only
  when the order differs from it. TEOS-204: leaving with a different order asks
  first. TEOS-207: after Save the page stays and shows the order the API stored.
  TEOS-203: the search only highlights matching tags, the list stays whole.
  TEOS-206: a tag set changed meanwhile (422 incomplete_order / tag_not_in_group)
  offers a reload. TEOS-208: on the Countries group a divider marks the first
  top_countries_count tags. TEOS-209: an unknown id is "Group not found".
*/

// The tag set of the group changed since the page loaded it.
const STALE_CODES = ["incomplete_order", "tag_not_in_group"];

const staleCode = (error) => {
  const code = getApiErrorCode(error);
  if (code) return STALE_CODES.includes(code) ? code : null;
  // Some answers carry the code as plain text ("tag_not_in_group: <ids>").
  const raw = String(error?.response?.data?.developerMessage || "");
  return STALE_CODES.find((item) => raw.startsWith(item)) || null;
};

const idsOf = (list) => list.map((tag) => tag?.id);

const numbered = (list) =>
  list.map((tag, index) => ({ ...tag, sorting_number: index + 1 }));

const TopCountriesDivider = ({ count }) => (
  <Box
    data-testid="top-countries-divider"
    sx={{ my: 2 }}
    role="note"
    aria-label={`Top countries limit: first ${count}`}
  >
    <Divider
      textAlign="left"
      sx={{
        "&::before, &::after": {
          borderTop: "2px dashed",
          borderColor: "primary.main",
        },
      }}
    >
      <Chip
        color="primary"
        size="small"
        label={`Top countries limit (${count})`}
      />
    </Divider>
    <Typography
      variant="caption"
      component="p"
      sx={{ color: "primary.main", mt: 0.5 }}
    >
      {`The first ${count} countries above this line are shown to users first; the rest appear after “View All”.`}
    </Typography>
  </Box>
);

const DraggableTagItem = ({
  tag,
  index,
  onMoveToTop,
  highlighted,
  registerRow,
}) => {
  return (
    <Draggable draggableId={String(tag.id)} index={index}>
      {(provided, snapshot) => (
        <ListItem
          ref={(element) => {
            provided.innerRef(element);
            registerRow(tag.id, element);
          }}
          {...provided.draggableProps}
          data-tag-id={tag.id}
          data-highlighted={highlighted ? "true" : "false"}
          sx={(theme) => ({
            border: "1px solid",
            borderColor: highlighted ? theme.palette.primary.main : "#e0e0e0",
            borderRadius: "8px",
            mb: 1,
            backgroundColor: snapshot.isDragging
              ? "#e3f2fd"
              : highlighted
                ? alpha(theme.palette.primary.main, 0.12)
                : "#fff",
            opacity: snapshot.isDragging ? 0.8 : 1,
            "&:hover": {
              backgroundColor: highlighted
                ? alpha(theme.palette.primary.main, 0.18)
                : "#f5f5f5",
            },
          })}
        >
          <ListItemAvatar {...provided.dragHandleProps}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                padding: "8px",
                cursor: "grab",
                "&:active": {
                  cursor: "grabbing",
                },
              }}
            >
              <DragIndicator />
            </Box>
          </ListItemAvatar>
          <ListItemAvatar>
            {tag?.icon ? (
              <Avatar src={tag.icon} alt={tag.name} />
            ) : (
              <Avatar>{tag?.name?.charAt(0)?.toUpperCase()}</Avatar>
            )}
          </ListItemAvatar>
          <ListItemText
            primary={tag?.name || "N/A"}
            secondary={`Sort Order: ${index + 1}`}
          />
          {index !== 0 && (
            <Tooltip title="Move to top">
              <IconButton
                color="primary"
                aria-label={`move ${tag?.name} to top`}
                onClick={() => onMoveToTop(tag.id)}
              >
                <NorthIcon />
              </IconButton>
            </Tooltip>
          )}
        </ListItem>
      )}
    </Draggable>
  );
};

const GroupsTagReorder = () => {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const canWrite = usePermission(PERMISSIONS.GROUPS_WRITE);
  const [tags, setTags] = useState([]);
  // The order as loaded (or as last saved): what Save and Reset compare with.
  const [savedTags, setSavedTags] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [staleSet, setStaleSet] = useState(false);
  const [reloading, setReloading] = useState(false);
  const rowRefs = useRef({});

  // Always the full list: the order sent back must hold every tag of the group
  const {
    data,
    isLoading: loading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["group", id],
    queryFn: () => getGroupById(id).then((res) => res?.data?.data),
    enabled: !!id,
    retry: false,
  });

  const dirty = idsOf(tags).join(",") !== idsOf(savedTags).join(",");
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  const applyLoaded = (list) => {
    const ordered = numbered(list || []);
    setTags(ordered);
    setSavedTags(ordered);
  };

  // A new copy of the group replaces the list only while nothing was moved,
  // so a background refetch never throws away the admin's order.
  useEffect(() => {
    if (data && !dirtyRef.current) applyLoaded(data?.tags);
  }, [data]);

  // TEOS-209: an unknown (404) or malformed (422) id is "Group not found".
  const notFound = [404, 422].includes(error?.response?.status);

  useEffect(() => {
    if (isError && !notFound && !error?.isForbidden) {
      toast.error("Unable to fetch group tags");
    }
  }, [isError, notFound]);

  const { leaveOpen, requestLeave, confirmLeave, cancelLeave } =
    useLeaveGuard(dirty);

  // top_countries_count comes with the group (set for the Countries group only)
  const topCountriesCount = data?.top_countries_count || null;

  // TEOS-203: the search marks the matching tags, it never hides any.
  const trimmedQuery = searchQuery.trim().toLowerCase();
  const matchingIds = useMemo(() => {
    if (!trimmedQuery) return new Set();
    return new Set(
      tags
        .filter((tag) => tag?.name?.toLowerCase().includes(trimmedQuery))
        .map((tag) => tag.id),
    );
  }, [tags, trimmedQuery]);
  const noMatch = !!trimmedQuery && matchingIds.size === 0;

  useEffect(() => {
    if (!trimmedQuery) return;
    const first = tags.find((tag) => matchingIds.has(tag.id));
    rowRefs.current[first?.id]?.scrollIntoView?.({
      behavior: "smooth",
      block: "center",
    });
  }, [trimmedQuery]);

  const registerRow = (tagId, element) => {
    if (element) rowRefs.current[tagId] = element;
    else delete rowRefs.current[tagId];
  };

  const reloadTags = () => {
    setReloading(true);
    refetch()
      .then((result) => {
        // a failed reload is reported by the query error toast
        if (result?.data && !result?.isError) {
          applyLoaded(result.data?.tags);
          setStaleSet(false);
        }
      })
      .finally(() => setReloading(false));
  };

  const handleSaveOrder = () => {
    // TEOS-198: an empty list is never sent (only a group without tags may send [])
    if (isSubmitting || !dirty || !tags.length) return;
    setIsSubmitting(true);
    const sent = tags;
    // Only the ordered ids travel; the API sets sorting_number = position
    updateTagGroupsOrder({ id, tag_ids: idsOf(sent) })
      .then((res) => {
        toast.success("Tag Reordered successfully");
        setStaleSet(false);
        // TEOS-207: stay and show the order the API stored.
        const storedIds = res?.data?.data?.tag_ids;
        const byId = new Map(sent.map((tag) => [tag.id, tag]));
        const stored = Array.isArray(storedIds)
          ? storedIds.map((tagId) => byId.get(tagId))
          : sent;
        if (stored.some((tag) => !tag)) {
          // the API knows tags this page does not: show the group as it is now
          dirtyRef.current = false;
          setSavedTags(sent);
          reloadTags();
        } else {
          dirtyRef.current = false;
          applyLoaded(stored);
          queryClient.setQueryData(["group", id], (previous) =>
            previous ? { ...previous, tags: numbered(stored) } : previous,
          );
        }
        queryClient.invalidateQueries({ queryKey: ["groups"] });
      })
      .catch((err) => {
        if (staleCode(err)) {
          setStaleSet(true);
        } else {
          // the readable message (set by the axios interceptor), never developerMessage
          toast.error(err?.message || "Failed to reorder tags");
        }
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  const handleReset = () => {
    setTags(savedTags);
  };

  const handleMoveToTop = (tagId) => {
    const tagIndex = tags.findIndex((t) => t.id === tagId);
    if (tagIndex > 0) {
      const newTags = [...tags];
      const [movedTag] = newTags.splice(tagIndex, 1);
      newTags.unshift(movedTag);
      setTags(numbered(newTags));
      toast.success("Tag moved to top");
    }
  };

  const handleSortAlphabetically = () => {
    const sortedTags = [...tags].sort((a, b) =>
      (a?.name || "").localeCompare(b?.name || ""),
    );
    setTags(numbered(sortedTags));
    toast.success(
      "Tags sorted alphabetically. Don't forget to save your changes!",
    );
  };

  const handleDragEnd = (result) => {
    // Dropped outside the list
    if (!result.destination) {
      return;
    }

    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;

    // No movement
    if (sourceIndex === destinationIndex) {
      return;
    }

    // Reorder the tags
    const newTags = Array.from(tags);
    const [movedTag] = newTags.splice(sourceIndex, 1);
    newTags.splice(destinationIndex, 0, movedTag);

    setTags(numbered(newTags));
  };

  if (notFound) {
    return (
      <Card>
        <CardContent>
          <NoDataFound
            text="Group not found"
            action={
              <Button component={Link} to="/groups" variant="contained">
                Back to Groups
              </Button>
            }
          />
        </CardContent>
      </Card>
    );
  }

  // A failed background refetch keeps the list that is already shown.
  if (isError && !data) {
    return (
      <NoDataFound text={"Unable to fetch group tags. Please try again"} />
    );
  }

  // TEOS-208: the divider sits after the first N tags, whatever was moved.
  const showDivider =
    !!topCountriesCount && topCountriesCount < tags.length;

  return (
    <Card>
      <CardContent className={"flex flex-col gap-2"}>
        <div className={"flex flex-col"}>
          <Typography variant="h5">
            <span className={"font-bold"}>{data?.name}</span> Tags
          </Typography>
          {topCountriesCount && (
            <p
              className={"text-secondary"}
            >{`Users will initially see only the first ${topCountriesCount} countries. The rest will appear after clicking “View All”. To change this number, please contact your administrator.`}</p>
          )}
        </div>

        <div
          className={
            "flex flex-col-reverse gap-4 sm:flex-row sm:justify-between sm:gap-2 "
          }
        >
          <div className={"flex items-center gap-2"}>
            <FormControl>
              <TextField
                size="small"
                placeholder="Search tags by name"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                }}
                slotProps={{
                  input: {
                    startAdornment: <SearchIcon sx={{ mr: 1 }} />,
                  },
                }}
              />
            </FormControl>
            {noMatch && (
              <Typography variant="caption" color="text.secondary">
                No match
              </Typography>
            )}
            <Tooltip title="Sort Alphabetically">
              <IconButton
                color="primary"
                aria-label="sort alphabetically"
                onClick={handleSortAlphabetically}
                sx={{
                  border: "1px solid",
                  borderColor: "primary.main",
                  borderRadius: "15px",
                }}
              >
                <SortByAlpha />
              </IconButton>
            </Tooltip>
          </div>
          <Box
            display="flex"
            justifyContent="flex-end"
            alignItems="center"
            gap={2}
            mt={2}
          >
            {canWrite && !loading && !dirty && !isSubmitting && (
              <Typography variant="caption" color="text.secondary">
                Nothing to save
              </Typography>
            )}
            <Button variant="outlined" onClick={() => requestLeave("/groups")}>
              Cancel
            </Button>
            <Button
              variant="outlined"
              color="primary"
              onClick={handleReset}
              disabled={isSubmitting || !dirty}
            >
              Reset
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={handleSaveOrder}
              disabled={
                isSubmitting || loading || !canWrite || !tags.length || !dirty
              }
            >
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
          </Box>
        </div>

        {staleSet && (
          <Alert
            severity="warning"
            action={
              <Button
                color="inherit"
                size="small"
                onClick={reloadTags}
                disabled={reloading}
              >
                {reloading ? "Reloading..." : "Reload"}
              </Button>
            }
          >
            Tags changed since you opened this page
          </Alert>
        )}

        {loading ? (
          new Array(5)
            .fill()
            .map((_, index) => <Skeleton key={index} height={100} />)
        ) : tags?.length === 0 ? (
          <NoDataFound text="No Tags Found" />
        ) : (
          <>
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="tags-list">
                {(provided, snapshot) => (
                  <List
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    sx={{
                      backgroundColor: snapshot.isDraggingOver
                        ? "#f5f5f5"
                        : "transparent",
                      minHeight: "100px",
                    }}
                  >
                    {tags?.map((tag, index) => (
                      <Fragment key={tag.id}>
                        {showDivider && index === topCountriesCount && (
                          <TopCountriesDivider count={topCountriesCount} />
                        )}
                        <DraggableTagItem
                          tag={tag}
                          index={index}
                          onMoveToTop={handleMoveToTop}
                          highlighted={matchingIds.has(tag.id)}
                          registerRow={registerRow}
                        />
                      </Fragment>
                    ))}
                    {provided.placeholder}
                  </List>
                )}
              </Droppable>
            </DragDropContext>
          </>
        )}
      </CardContent>
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

export default GroupsTagReorder;
