export const buildMenuHierarchy = (menuItems) => {
  const menuMap = new Map();
  const rootMenus = [];

  // Step 1: Populate menuMap and initialize children array
  menuItems.forEach((item) => {
    menuMap.set(item.key, { ...item, children: [] });
  });

  // Step 2: Identify missing parents
  const validPages = menuItems.filter(
    (item) => !item.parentGuid || menuMap.has(item.parentGuid)
  );

  // Step 3: Attach children to their respective parents
  validPages.forEach((item) => {
    if (item.parentGuid && menuMap.has(item.parentGuid)) {
      menuMap.get(item.parentGuid).children.push(menuMap.get(item.key));
    } else {
      rootMenus.push(menuMap.get(item.key));
    }
  });

  return rootMenus;
};

export const openedMixin = (theme) => ({
  width: 250,
  transition: theme.transitions.create("width", {
    easing: "ease-in-out",
    duration: theme.transitions.duration.enteringScreen * 2,
  }),
  overflowX: "hidden",
  scrollbarWidth: "thin",
  "&::-webkit-scrollbar": {
    width: "6px",
  },
  "&::-webkit-scrollbar-thumb": {
    backgroundColor: "#7551FF",
    borderRadius: "4px",
  },
});

export const closedMixin = (theme) => ({
  transition: theme.transitions.create("width", {
    easing: "ease-in-out",
    duration: theme.transitions.duration.leavingScreen * 2,
  }),
  overflowX: "hidden",
  width: (theme) => `calc(${theme.spacing(7)} + 1px)`,
  [theme.breakpoints.up("sm")]: {
    width: (theme) => `calc(${theme.spacing(11)} + 1px)`,
  },
});
