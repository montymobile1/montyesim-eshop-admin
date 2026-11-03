import { toast } from "react-toastify";

// Copies text to the clipboard with a toast (voucher codes, TEOS-136).
export const copyToClipboard = async (text, successMessage = "Copied") => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(successMessage);
    return true;
  } catch {
    toast.error("Could not copy to the clipboard");
    return false;
  }
};
