import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { initAppearance } from "./theme";
import "./styles.css";

initAppearance();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
