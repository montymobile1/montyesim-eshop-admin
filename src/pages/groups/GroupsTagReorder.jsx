import {
  DragIndicator,
  Search as SearchIcon,
  SortByAlpha,
} from "@mui/icons-material";
import NorthIcon from "@mui/icons-material/North";
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
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
import { useEffect, useMemo, useState } from "react";
import { DragDropContext, Draggable, Droppable } from "react-beautiful-dnd";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import NoDataFound from "../../Components/shared/fallbacks/no-data-found/NoDataFound";
import {
  getGroupById,
  getTopCountriesCount,
  updateTagGroupsOrder,
} from "../../core/apis/groupsAPI";

const DraggableTagItem = ({
  tag,
  index,
  placementInData,
  onMoveToTop,
  isSearchActive,
}) => {
  return (
    <Draggable
      draggableId={String(tag.id)}
      index={index}
      isDragDisabled={isSearchActive}
    >
      {(provided, snapshot) => (
        <ListItem
          ref={provided.innerRef}
          {...provided.draggableProps}
          sx={{
            border: "1px solid #e0e0e0",
            borderRadius: "8px",
            mb: 1,
            backgroundColor: snapshot.isDragging ? "#e3f2fd" : "#fff",
            opacity: snapshot.isDragging ? 0.8 : 1,
            "&:hover": {
              backgroundColor: "#f5f5f5",
            },
          }}
        >
          <ListItemAvatar {...provided.dragHandleProps}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                opacity: isSearchActive ? 0.5 : 1,
                padding: "8px",
                cursor: isSearchActive ? "not-allowed" : "grab",
                "&:active": {
                  cursor: isSearchActive ? "not-allowed" : "grabbing",
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
            secondary={`Sort Order: ${tag?.sorting_number || index + 1}`}
          />
          {placementInData?.sorting_number != 1 && (
            <Tooltip title="Move to top">
              <IconButton color="primary" onClick={() => onMoveToTop(tag.id)}>
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
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [data, setData] = useState(null);
  const [tags, setTags] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [topCountriesCount, setTopCountriesCount] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getGroupTagData = () => {
    setLoading(true);
    // Always fetch the full list (no search parameter)
    getGroupById(id)
      .then((res) => {
        if (res?.error) {
          setError(true);
          toast.error(res?.error);
        } else {
          if (res?.data?.name?.toLowerCase() === "countries") {
            getTopCountriesValue();
          }
          setData(res?.data);
          setTags(res?.data?.tag || []);
          setError(false);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const getTopCountriesValue = () => {
    getTopCountriesCount().then((res) => {
      if (!res?.error) {
        setTopCountriesCount(res || null);
      }
    });
  };
  useEffect(() => {
    if (id) {
      getGroupTagData();
    }
  }, [id]);

  // Frontend filtering based on search query
  const displayTags = useMemo(() => {
    if (!searchQuery || searchQuery.trim() === "") {
      return tags;
    }
    return tags.filter((tag) =>
      tag?.name?.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [tags, searchQuery]);

  const isSearchActive = searchQuery && searchQuery.trim() !== "";

  const handleSaveOrder = () => {
    setIsSubmitting(true);
    updateTagGroupsOrder(tags)
      .then((res) => {
        if (res?.error) {
          toast.error(res?.error);
        } else {
          toast.success("Tag Reordered successfully");
          navigate(-1);
        }
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  const handleMoveToTop = (tagId) => {
    const tagIndex = tags.findIndex((t) => t.id === tagId);
    if (tagIndex > 0) {
      const newTags = [...tags];
      const [movedTag] = newTags.splice(tagIndex, 1);
      newTags.unshift(movedTag);
      // Update sorting numbers
      const updatedTags = newTags.map((tag, index) => ({
        ...tag,
        sorting_number: index + 1,
      }));
      setTags(updatedTags);
      toast.success("Tag moved to top");
    }
  };

  const handleSortAlphabetically = () => {
    const sortedTags = [...tags]
      .sort((a, b) => (a?.name || "").localeCompare(b?.name || ""))
      .map((tag, index) => ({
        ...tag,
        sorting_number: index + 1,
      }));
    setTags(sortedTags);
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

    // Update sorting numbers
    const updatedTags = newTags.map((tag, index) => ({
      ...tag,
      sorting_number: index + 1,
    }));

    setTags(updatedTags);
  };

  if (error) {
    return (
      <NoDataFound text={"Unable to fetch group tags. Please try again"} />
    );
  }

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
            <Tooltip title="Sort Alphabetically">
              <IconButton
                color="primary"
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
          <Box display="flex" justifyContent="flex-end" gap={2} mt={2}>
            <Button variant="outlined" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={handleSaveOrder}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
          </Box>
        </div>

        {loading ? (
          new Array(5)
            .fill()
            .map((_, index) => <Skeleton key={index} height={100} />)
        ) : displayTags?.length === 0 ? (
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
                    {displayTags?.map((tag, index) => (
                      <DraggableTagItem
                        key={tag.id}
                        tag={tag}
                        index={index}
                        placementInData={data?.tag?.find(
                          (el) => el?.id == tag?.id,
                        )}
                        onMoveToTop={handleMoveToTop}
                        isSearchActive={isSearchActive}
                      />
                    ))}
                    {provided.placeholder}
                  </List>
                )}
              </Droppable>
            </DragDropContext>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default GroupsTagReorder;
