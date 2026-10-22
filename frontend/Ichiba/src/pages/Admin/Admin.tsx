import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import GestionUsuarios from "./GestionUsuarios";
import InformesGlobales from "./InformesGlobales";
import ListaNegra from "./ListaNegra";
import RevisionReportes from "./RevisionReportes";
import Trazabilidad from "./Trazabilidad";
import Dashboard from "./Dashboard";
import Disputas from "./Disputas";
import Adeudos from "./Adeudos";
import "./Admin.css";

type SeccionAdmin = {
  id: string;
  etiqueta: string;
  descripcion: string;
};

/**
 * Todas las secciones del BackOffice viven en esta lista. El menú las pinta
 * completas (sin scroll horizontal ni elementos ocultos) y la sección activa
 * se guarda en la URL para que se pueda compartir o recargar sin perderla.
 */
const SECCIONES: SeccionAdmin[] = [
  {
    id: "inicio",
    etiqueta: "Inicio",
    descripcion: "Cifras en vivo y resumen general",
  },
  {
    id: "usuarios",
    etiqueta: "Gestión de usuarios",
    descripcion: "Cuentas, sanciones y reputación",
  },
  {
    id: "reportes",
    etiqueta: "Reportes pendientes",
    descripcion: "Revisa y resuelve reportes",
  },
  {
    id: "disputas",
    etiqueta: "Disputas y retenciones",
    descripcion: "Reembolsos y ventas retenidas",
  },
  {
    id: "adeudos",
    etiqueta: "Adeudos de vendedores",
    descripcion: "Saldos pendientes por liquidar",
  },
  {
    id: "informes",
    etiqueta: "Informes globales",
    descripcion: "Indicadores mensuales y PDF",
  },
  {
    id: "lista-negra",
    etiqueta: "Lista negra",
    descripcion: "Datos y cuentas bloqueadas",
  },
  {
    id: "trazabilidad",
    etiqueta: "Trazabilidad",
    descripcion: "Historial de operaciones",
  },
];

function Admin() {
  const { usuario } = useAuth();
  const [parametros, setParametros] = useSearchParams();
  const solicitada = parametros.get("seccion");
  const seccionActiva =
    SECCIONES.find((seccion) => seccion.id === solicitada)?.id ?? "inicio";

  if (!usuario || usuario.tipo !== "admin") {
    return <Navigate to="/inicio" replace />;
  }

  function abrirSeccion(id: string) {
    setParametros(id === "inicio" ? {} : { seccion: id }, { replace: true });
  }

  return (
    <div className="admin">
      <h1>Panel de administrador</h1>
      <p className="admin__bienvenida">
        Bienvenido, {usuario.nombreCompleto}. Aquí puedes revisar reportes,
        usuarios, disputas, adeudos e informes de toda la plataforma.
      </p>

      <nav className="admin__menu" aria-label="Secciones del panel">
        {SECCIONES.map((seccion) => {
          const activa = seccionActiva === seccion.id;
          return (
            <button
              key={seccion.id}
              type="button"
              className={`admin__menu-item ${
                activa ? "admin__menu-item--activo" : ""
              }`}
              onClick={() => abrirSeccion(seccion.id)}
              aria-current={activa ? "page" : undefined}
            >
              <span className="admin__menu-etiqueta">{seccion.etiqueta}</span>
              <span className="admin__menu-descripcion">
                {seccion.descripcion}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="admin__contenido">
        {seccionActiva === "inicio" && <Dashboard />}
        {seccionActiva === "usuarios" && <GestionUsuarios />}
        {seccionActiva === "reportes" && <RevisionReportes />}
        {seccionActiva === "disputas" && <Disputas />}
        {seccionActiva === "adeudos" && <Adeudos />}
        {seccionActiva === "informes" && <InformesGlobales />}
        {seccionActiva === "lista-negra" && <ListaNegra />}
        {seccionActiva === "trazabilidad" && <Trazabilidad />}
      </div>
    </div>
  );
}

export default Admin;
