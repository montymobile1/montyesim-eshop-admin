import { Button } from "@mui/material";
import { useState } from "react";

export const MESSAGE_PREVIEW_LENGTH = 120;

/*
  A contact-us message as plain text (TEOS-120): React escapes it, so HTML in a
  message is shown literally and never rendered. Line breaks are kept and
  dir="auto" lets Arabic / RTL messages display right to left. Messages longer
  than MESSAGE_PREVIEW_LENGTH are truncated with an Expand control that shows
  the full text in place.
*/
const ContactMessageText = ({ content }) => {
  const [expanded, setExpanded] = useState(false);

  if (!content) return "N/A";

  const isLong = content.length > MESSAGE_PREVIEW_LENGTH;
  const text =
    isLong && !expanded
      ? `${content.slice(0, MESSAGE_PREVIEW_LENGTH).trimEnd()}…`
      : content;

  return (
    <div className="flex flex-col items-start gap-1">
      <span dir="auto" className="whitespace-pre-wrap break-words">
        {text}
      </span>
      {isLong && (
        <Button
          size="small"
          variant="text"
          sx={{ p: 0, minWidth: 0, textTransform: "none" }}
          aria-expanded={expanded}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
        >
          {expanded ? "Collapse" : "Expand"}
        </Button>
      )}
    </div>
  );
};

export default ContactMessageText;
