import { setTheme } from "../../Redux/reducers/ThemeReducer";
import { store } from "../../Redux/store";
import { toast } from "react-toastify";

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

/**
 * Handles API response for table data pages
 * @param {Object} res - API response object
 * @param {Function} setData - State setter for data array
 * @param {Function} setTotalRows - State setter for total rows count
 * @param {Function} setLoading - Optional state setter for loading state
 * @param {Function} dataTransform - Optional function to transform data items (e.g., (el) => ({ ...el, ...el?.metadata }))
 */
export const handleTableResponse = (
  res,
  setData,
  setTotalRows,
  setLoading = null,
  dataTransform = null
) => {
  if (res?.error) {
    toast.error(res?.error);
    setData([]);
    setTotalRows(0);
    if (setLoading) {
      setLoading(false);
    }
  } else {
    setTotalRows(res?.count || 0);
    const transformedData = res?.data?.map((el) => {
      if (dataTransform) {
        return dataTransform(el);
      }
      return { ...el };
    }) || [];
    setData(transformedData);
  }
};
