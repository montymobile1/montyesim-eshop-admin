// Where the header back arrow goes: the last other page visited (with its filters), unless that
// page is below the current one; otherwise the section's list (/settings/logs -> /settings).
// navigate(-1) is not used: list pages write their filters into the history, so -1 would only
// step back through the current page's own filter changes.
export const backTarget = (pathname, previous) => {
  const previousPath = previous?.split("?")[0];
  if (previousPath && previousPath !== pathname && !previousPath.startsWith(`${pathname}/`)) {
    return previous;
  }
  return `/${pathname.split("/")[1] || ""}`;
};
