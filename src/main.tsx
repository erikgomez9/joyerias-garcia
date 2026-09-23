import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { PosProvider } from "./context/PosContext";
import "./styles/global.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <PosProvider>
        <App />
      </PosProvider>
    </HashRouter>
  </StrictMode>
);
