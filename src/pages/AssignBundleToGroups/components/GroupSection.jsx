import { useEffect, useState } from "react";

// MUI imports
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import { Box } from "@mui/material";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Typography from "@mui/material/Typography";
import { toast } from "react-toastify";
import NoDataFound from "../../../Components/shared/fallbacks/no-data-found/NoDataFound";
import { getTagsByTagGroup } from "../../../core/apis/tagsAPI";
import { useAssignBundleContext } from "../hooks/AssignBundleContext";
import GroupSectionSkeleton from "../loaders/GroupSectionSkeleton";
import GroupTagSkeleton from "../loaders/GroupTagSkeleton";
import GroupTag from "./GroupTag";

export default function GroupSection({ group }) {
  const { id, name } = group;
  const { addToGroupTagMapping, isTagSelected } = useAssignBundleContext();

  const [tags, setTags] = useState([]);
  const [expanded, setExpanded] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleChange = () => {
    setExpanded(!expanded);
  };

  const getTags = async () => {
    setLoading(true);

    try {
      const { data, error } = await getTagsByTagGroup(id);

      if (error) {
        throw error;
      }
      let tags = data ?? [];
      setTags(tags);
      addToGroupTagMapping(id, tags);
    } catch (e) {
      toast.error(e?.message || "Fail to display data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getTags();
  }, []);

  const selectedCount = tags.filter((tag) => isTagSelected(tag?.id)).length;

  if (loading) {
    return <GroupSectionSkeleton />;
  }

  const content = () => {
    if (loading) {
      return <GroupTagSkeleton />;
    } else if (tags.length == 0) {
      return <NoDataFound text={"No tags available in this group"} />;
    } else {
      return (
        <Box className="flex gap-2 flex-wrap">
          {tags?.map((tag) => (
            <GroupTag selected={false} tag={tag || null} key={tag?.id} />
          ))}
        </Box>
      );
    }
  };
  
  return (
    <Accordion expanded={expanded} onChange={handleChange}>
      <AccordionSummary
        expandIcon={
          <ArrowDropDownIcon fontSize="large" sx={{ color: "white" }} />
        }
        sx={{
          minHeight: "48px",

          paddingY: "0px",

          "&.MuiAccordionSummary-root": {
            paddingY: "0px !imporatnt",
          },

          "& .MuiAccordionSummary-content": {
            paddingY: "0px",
          },

          "&.Mui-expanded": {
            minHeight: "48px",
          },
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            paddingRight: "8px",
          }}
        >
          <Typography
            sx={{
              fontWeight: 500,
              color: "#ffffff",
              letterSpacing: "0.01em",
            }}
          >
            {name}
          </Typography>
          {tags.length > 0 && (
            <Box
              component="span"
              sx={{
                fontSize: "0.75rem",
                fontWeight: 600,
                lineHeight: 1,
                padding: "5px 10px",
                borderRadius: "999px",
                whiteSpace: "nowrap",
                color: "#ffffff",
                backgroundColor:
                  selectedCount > 0
                    ? "var(--color-secondary)"
                    : "rgba(255, 255, 255, 0.15)",
              }}
            >
              {selectedCount} / {tags.length} selected
            </Box>
          )}
        </div>
      </AccordionSummary>

      <AccordionDetails
        sx={{
          padding: "20px",
          borderTop: "1px solid #e2e8f0",
        }}
      >
        <Typography sx={{ color: "#334155", lineHeight: 1.6 }}>
          <>{content()}</>
        </Typography>
      </AccordionDetails>
    </Accordion>
  );
}
