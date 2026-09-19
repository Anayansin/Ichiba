import { useState } from "react";
import PreguntasFrecuentes from "../PreguntasFrecuentes/PreguntasFrecuentes";
import ComoFunciona from "../ComoFunciona/ComoFunciona";
import PoliticasDePrivacidad from "../PoliticasDePrivacidad/PoliticasDePrivacidad";
import MisPedidos from "../MisPedidos/MisPedidos";
import ReportarVendedor from "../ReportarVendedor/ReportarVendedor";
import "./Ayuda.css";

const SECCIONES = [
  { id: "faq", label: "Preguntas frecuentes" },
  { id: "como-funciona", label: "Cómo funciona" },
  { id: "mis-pedidos", label: "Mis pedidos" },
  { id: "reportar", label: "Reportar un vendedor" },
  { id: "privacidad", label: "Políticas de privacidad" },
];

function Ayuda() {
  const [seccionActiva, setSeccionActiva] = useState("faq");

  return (
    <div className="ayuda">
      <aside className="ayuda__menu">
        {SECCIONES.map((seccion) => (
          <button
            key={seccion.id}
            className={`ayuda__menu-item ${seccionActiva === seccion.id ? "ayuda__menu-item--activo" : ""}`}
            onClick={() => setSeccionActiva(seccion.id)}
          >
            {seccion.label}
          </button>
        ))}
      </aside>

      <div className="ayuda__contenido">
        {seccionActiva === "faq" && <PreguntasFrecuentes />}
        {seccionActiva === "como-funciona" && <ComoFunciona />}
        {seccionActiva === "mis-pedidos" && <MisPedidos />}
        {seccionActiva === "reportar" && <ReportarVendedor />}
        {seccionActiva === "privacidad" && <PoliticasDePrivacidad />}
      </div>
    </div>
  );
}

export default Ayuda;
