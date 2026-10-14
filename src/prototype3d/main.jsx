import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Prototype3D } from "./Prototype3D";
import "../index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Prototype3D />
  </StrictMode>
);
