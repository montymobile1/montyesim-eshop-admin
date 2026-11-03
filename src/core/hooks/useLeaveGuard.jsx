import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/*
  Unsaved-changes guard (TEOS-170). While `dirty`:
  - a reload or tab close triggers the browser's "Leave site?" prompt;
  - a click on an in-app link (sidebar, menus) or on an element with
    data-leave-target (the header back arrow) is held until the admin confirms.
  The app uses BrowserRouter (no data router), so useBlocker is not available;
  the click is caught on the document, in the capture phase, before React sees it.

  Returns { leaveOpen, requestLeave(target), confirmLeave(), cancelLeave() }:
  the page renders its own "Unsaved changes" dialog from leaveOpen and calls
  requestLeave(target) from its own Back/Cancel buttons.
*/
const useLeaveGuard = (dirty) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [pendingTarget, setPendingTarget] = useState(null);

  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (!dirty) return undefined;
    const onClick = (event) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const element = event.target?.closest?.("[data-leave-target], a[href]");
      if (!element) return;

      let target = element.getAttribute("data-leave-target");
      if (!target) {
        if (element.target && element.target !== "_self") return;
        const url = new URL(element.href, window.location.href);
        if (url.origin !== window.location.origin) return;
        target = `${url.pathname}${url.search}`;
      }
      if (target.split("?")[0] === pathname) return;

      event.preventDefault();
      event.stopPropagation();
      setPendingTarget(target);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [dirty, pathname]);

  const requestLeave = (target) => {
    if (dirty) {
      setPendingTarget(target);
    } else {
      navigate(target);
    }
  };

  const confirmLeave = () => {
    const target = pendingTarget;
    setPendingTarget(null);
    navigate(target);
  };

  return {
    leaveOpen: pendingTarget != null,
    requestLeave,
    confirmLeave,
    cancelLeave: () => setPendingTarget(null),
  };
};

export default useLeaveGuard;
