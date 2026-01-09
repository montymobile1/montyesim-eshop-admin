import { vi } from "vitest";
import React from "react";
import "@testing-library/jest-dom";

// Set up DOM element for React's createRoot
if (typeof document !== "undefined") {
  const root = document.createElement("div");
  root.id = "root";
  document.body.appendChild(root);
}
