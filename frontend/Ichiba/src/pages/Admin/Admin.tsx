import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import GestionUsuarios from "./GestionUsuarios";
import ListaNegra from "./ListaNegra";
import RevisionReportes from "./RevisionReportes";
import Trazabilidad from "./Trazabilidad";
import Dashboard from "./Dashboard";
import "./Admin.css";

const SECCIONES = [
  { id: "inicio", etiqueta: "Inicio" },
  { id: "usuarios", etiqueta: "Gestión de usuarios" },
  { id: "reportes", etiqueta: "Reportes pendientes" },
  { id: "lista-negra", etiqueta: "Lista negra" },
  { id: "trazabilidad", etiqueta: "Trazabilidad" },
];

function Admin() {
  const { usuario } = useAuth();
  const [seccionActiva, setSeccionActiva] = useState("inicio");

  if (!usuario || usuario.tipo !== "admin") {
    return <Navigate to="/inicio" replace />;
  }

  return (
    <div className="admin">
      <h1>Panel de administrador</h1>
      <p className="admin__bienvenida">
        Bienvenido, {usuario.nombreCompleto}. Aquí podrás revisar los reportes
        de la plataforma y administrar Ichiba.
      </p>

      <nav className="admin__menu">
        {SECCIONES.map((seccion) => (
          <button
            key={seccion.id}
            type="button"
            className={`admin__menu-item ${
              seccionActiva === seccion.id ? "admin__menu-item--activo" : ""
            }`}
            onClick={() => setSeccionActiva(seccion.id)}
          >
            {seccion.etiqueta}
          </button>
        ))}
      </nav>

      <div className="admin__contenido">
        {seccionActiva === "usuarios" && <GestionUsuarios />}
        {seccionActiva === "reportes" && <RevisionReportes />}
        {seccionActiva === "lista-negra" && <ListaNegra />}
        {seccionActiva === "trazabilidad" && <Trazabilidad />}
        {seccionActiva === "inicio" && <Dashboard />}
      </div>
    </div>
  );
}

export default Admin;
