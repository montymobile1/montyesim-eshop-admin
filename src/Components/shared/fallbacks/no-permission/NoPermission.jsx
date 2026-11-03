import React from "react";
import { INDEX_ROUTE } from "../../../../core/routes/Pages";
import { Button } from "@mui/material";
import { useNavigate } from "react-router-dom";

// TEOS-222: shown on a route the admin has no permission for, so it is not
// confused with a URL that does not exist (PageNotFound).
const NoPermission = () => {
  const navigate = useNavigate();
  return (
    <div
      className={
        "flex flex-col gap-4 w-full max-w-xxl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 items-center justify-center text-center"
      }
    >
      <h1>Access Denied</h1>
      <p>{`You don't have permission to view this page.`}</p>
      <Button
        variant="contained"
        color="primary"
        onClick={() => navigate(INDEX_ROUTE)}
        className="mt-20 px-6 py-10 rounded-lg shadow-lg"
      >
        Back to Users
      </Button>
    </div>
  );
};

export default NoPermission;
