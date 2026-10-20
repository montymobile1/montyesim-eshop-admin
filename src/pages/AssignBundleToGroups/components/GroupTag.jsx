import CheckIcon from "@mui/icons-material/Check";
import { Avatar, Chip } from "@mui/material";
import { useAssignBundleContext } from "../hooks/AssignBundleContext";

export default function GroupTag({ tag }) {
  const { removeTag, isTagSelected, selectTag } = useAssignBundleContext();
  const selected = isTagSelected(tag?.id);

  const handleClick = () => {
    if (selected) {
      removeTag(tag?.id);
    } else {
      selectTag(tag?.id);
    }
  };

  return (
    <Chip
      // Check, flag and name all live in the label: the chip's avatar slot
      // only takes one element.
      label={
        <span className="flex items-center gap-1.5">
          {selected && <CheckIcon sx={{ fontSize: 18, color: "inherit" }} />}
          {tag?.icon && (
            <Avatar
              src={tag?.icon}
              alt={tag?.name}
              sx={{ width: 24, height: 24 }}
            />
          )}
          {tag?.name}
        </span>
      }
      variant="outlined"
      onClick={handleClick}
      sx={{
        borderColor: selected ? "success.light" : "var(--color-shade-700)",
        color: selected ? "#ffffff" : "inherit",
        backgroundColor: selected ? "success.light" : "transparent",
        fontWeight: selected ? 600 : 400,
        borderWidth: "2px",
        fontSize: "0.875rem",
        // Keep the success color on hover instead of the chip's default grey.
        ...(selected && {
          "&.MuiChip-clickable:hover": {
            backgroundColor: "success.main",
            borderColor: "success.main",
          },
        }),
      }}
    />
  );
}
