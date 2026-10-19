import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { activarMensajesDeValidacionEnEspanol } from "./utils/validacionEspanol.ts";

// Todos los formularios del proyecto muestran sus avisos de validación en
// español (el navegador los muestra en inglés por defecto).
activarMensajesDeValidacionEnEspanol();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
