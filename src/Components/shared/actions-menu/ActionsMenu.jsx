import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import VisibilityIcon from "@mui/icons-material/Visibility";
import {
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
} from "@mui/material";
import { Children, createContext, useContext, useState } from "react";

const ActionsMenuContext = createContext({ close: () => {} });

/*
  One entry of a ⋯ menu: an icon, a label and a description line.
  Custom actions (Reorder, Assign, Activate all, ...) are passed to ActionsMenu
  as ActionItem children; the menu closes before onClick runs.
*/
export const ActionItem = ({
  icon,
  label,
  description,
  onClick,
  color,
  disabled = false,
}) => {
  const { close } = useContext(ActionsMenuContext);
  return (
    <MenuItem
      disabled={disabled}
      onClick={() => {
        close();
        onClick?.();
      }}
      sx={{ alignItems: "flex-start", whiteSpace: "normal", maxWidth: 360 }}
    >
      {icon && (
        <ListItemIcon sx={{ mt: "2px", color: color ? `${color}.main` : undefined }}>
          {icon}
        </ListItemIcon>
      )}
      <ListItemText
        primary={label}
        secondary={description}
        primaryTypographyProps={{
          color: color ? `${color}.main` : undefined,
        }}
      />
    </MenuItem>
  );
};

/*
  Reusable ⋯ menu (TEOS-177), for a table row or a page's bulk actions.
  The common actions are switched on with flags, each with its own icon:
    view / onView, edit / onEdit, delete / onDelete
  (+ viewLabel/viewDescription, editLabel/editDescription, deleteLabel/deleteDescription,
  deleteDisabled to show Delete greyed out, with the reason in deleteDescription).
  Custom actions go in as ActionItem children, between Edit and Delete.
  Nothing is rendered when no action is visible (e.g. no write permission).
*/
const ActionsMenu = ({
  label = "Actions",
  view = false,
  onView,
  viewLabel = "View",
  viewDescription,
  edit = false,
  onEdit,
  editLabel = "Edit",
  editDescription,
  delete: showDelete = false,
  onDelete,
  deleteLabel = "Delete",
  deleteDescription,
  deleteDisabled = false,
  children,
}) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const customItems = Children.toArray(children).filter(Boolean);

  if (!view && !edit && !showDelete && customItems.length === 0) return null;

  const close = () => setAnchorEl(null);

  return (
    <ActionsMenuContext.Provider value={{ close }}>
      <IconButton
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={anchorEl ? "true" : undefined}
        onClick={(event) => setAnchorEl(event.currentTarget)}
      >
        <MoreHorizIcon fontSize="small" />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={!!anchorEl}
        onClose={close}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        {view && (
          <ActionItem
            icon={<VisibilityIcon fontSize="small" />}
            label={viewLabel}
            description={viewDescription}
            onClick={onView}
            color="primary"
          />
        )}
        {edit && (
          <ActionItem
            icon={<EditIcon fontSize="small" />}
            label={editLabel}
            description={editDescription}
            onClick={onEdit}
            color="primary"
          />
        )}
        {customItems}
        {showDelete && (
          <ActionItem
            icon={<DeleteIcon fontSize="small" />}
            label={deleteLabel}
            description={deleteDescription}
            onClick={onDelete}
            color="error"
            disabled={deleteDisabled}
          />
        )}
      </Menu>
    </ActionsMenuContext.Provider>
  );
};

export default ActionsMenu;
