import { useState } from "react";

// MUI imports
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { Box } from "@mui/material";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Typography from "@mui/material/Typography";
import NoDataFound from "../../../Components/shared/fallbacks/no-data-found/NoDataFound";
import { useAssignBundleContext } from "../hooks/AssignBundleContext";
import GroupSectionSkeleton from "../loaders/GroupSectionSkeleton";
import GroupTag from "./GroupTag";

/*
  One group of the assign page. The tags come from the page (one query per
  selected group, GET /groups/{id}/tags); this component only renders them.
  TEOS-168: an inactive group is flagged next to its name; its tags can't be
  newly selected, the ones the bundle still has stay selected (and removable)
  with a warning, since the page won't save them.
*/
export default function GroupSection({ group, tags = [], loading = false }) {
  const { id, label, name } = group;
  const inactive = group?.is_active === false;
  const { isTagSelected } = useAssignBundleContext();

  const [expanded, setExpanded] = useState(true);

  const handleChange = () => {
    setExpanded(!expanded);
  };

  const selectedCount = tags.filter((tag) => isTagSelected(tag?.id)).length;

  if (loading) {
    return <GroupSectionSkeleton />;
  }

  const content = () => {
    if (tags.length === 0) {
      return <NoDataFound text={"No tags available in this group"} />;
    }
    return (
      <Box className="flex gap-2 flex-wrap">
        {tags.map((tag) => (
          <GroupTag
            tag={tag || null}
            key={tag?.id}
            disabled={inactive && !isTagSelected(tag?.id)}
          />
        ))}
      </Box>
    );
  };

  return (
    <Accordion
      expanded={expanded}
      onChange={handleChange}
      data-testid={`group-section-${id}`}
    >
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
          <Box
            component="span"
            sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}
          >
            <Typography
              sx={{
                fontWeight: 500,
                color: "#ffffff",
                letterSpacing: "0.01em",
              }}
            >
              {label ?? name}
            </Typography>
            {inactive && selectedCount > 0 && (
              <Typography
                component="span"
                data-testid={`group-inactive-warning-${id}`}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                  fontSize: "0.8rem",
                  fontWeight: 500,
                  color: "warning.light",
                }}
              >
                <WarningAmberIcon sx={{ fontSize: 16 }} />
                {"(inactive group – this may affect the bundle's visibility)"}
              </Typography>
            )}
            {inactive && selectedCount === 0 && (
              <Typography
                component="span"
                sx={{ fontSize: "0.8rem", color: "rgba(255, 255, 255, 0.7)" }}
              >
                (inactive)
              </Typography>
            )}
          </Box>
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
        <Typography component="div" sx={{ color: "#334155", lineHeight: 1.6 }}>
          {content()}
        </Typography>
      </AccordionDetails>
    </Accordion>
  );
}
