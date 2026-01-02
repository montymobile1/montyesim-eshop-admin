import { setTheme } from "../../Redux/reducers/ThemeReducer";
import { store } from "../../Redux/store";

export const toggleTheme = () => {
  const mode = store.getState().theme.mode;
  const newMode = mode == "light" ? "dark" : "light";
  if (mode == "light") {
    document.documentElement.classList.add('"dark');
  } else {
    document.documentElement.classList.remove("light");
  }
  store.dispatch(setTheme(newMode));
};

export const truncateText = (text, maxLength = 25) =>
  text?.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
