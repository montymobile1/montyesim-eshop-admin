export const truncateText = (text, maxLength = 25) =>
  text?.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
