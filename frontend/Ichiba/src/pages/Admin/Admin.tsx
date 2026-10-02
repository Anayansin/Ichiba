import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import GestionUsuarios from "./GestionUsuarios";
import RevisionReportes from "./RevisionReportes";
import Trazabilidad from "./Trazabilidad";
import "./Admin.css";

const SECCIONES = [
  { id: "inicio", etiqueta: "Inicio" },
  { id: "usuarios", etiqueta: "Gestión de usuarios" },
  { id: "reportes", etiqueta: "Reportes pendientes" },
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
        {seccionActiva === "trazabilidad" && <Trazabilidad />}
        {seccionActiva === "inicio" && (
          <p className="admin__seccion">
            Usa el menú de arriba para gestionar los usuarios de la plataforma,
            revisar los reportes pendientes o ver el historial combinado de
            transacciones. También puedes abrir el{" "}
            <Link to="/admin/reportes">historial de reportes</Link> para ver su
            estado.
          </p>
        )}
      </div>
    </div>
  );
}

export default Admin;
