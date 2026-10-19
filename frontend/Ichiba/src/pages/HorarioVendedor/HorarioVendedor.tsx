import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { Link, Navigate } from "react-router-dom";
import SelectorHorario, {
  type BloqueHorario,
} from "../../components/SelectorHorario/SelectorHorario";
import { fetchPerfil } from "../../services/usuarioServices";
import api from "../../services/api";
import { mensajeDeError } from "../../utils/errores";
import "./HorarioVendedor.css";

const HORARIO_VACIO: BloqueHorario[] = [
  { dia: "lunes", activo: false, horaInicio: "09:00", horaFin: "18:00" },
  { dia: "martes", activo: false, horaInicio: "09:00", horaFin: "18:00" },
  { dia: "miercoles", activo: false, horaInicio: "09:00", horaFin: "18:00" },
  { dia: "jueves", activo: false, horaInicio: "09:00", horaFin: "18:00" },
  { dia: "viernes", activo: false, horaInicio: "09:00", horaFin: "18:00" },
  { dia: "sabado", activo: false, horaInicio: "09:00", horaFin: "18:00" },
  { dia: "domingo", activo: false, horaInicio: "09:00", horaFin: "18:00" },
];

function HorarioVendedor() {
  const { usuario } = useAuth();
  const [horarios, setHorarios] = useState<BloqueHorario[]>(HORARIO_VACIO);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensajeError, setMensajeError] = useState("");
  const [mensajeExito, setMensajeExito] = useState("");

  useEffect(() => {
    if (!usuario) return;

    fetchPerfil()
      .then((perfil) => {
        if (perfil.horarios && perfil.horarios.length > 0) {
          setHorarios(perfil.horarios);
        }
      })
      .catch((error) => {
        console.error("Error al cargar el horario:", error);
      })
      .finally(() => setCargando(false));
  }, [usuario]);

  if (!usuario) return <Navigate to="/" replace />;

  async function guardarHorario() {
    setGuardando(true);
    setMensajeError("");
    setMensajeExito("");

    try {
      await api.put("/usuarios/confirmar-horario", { horarios });
      setMensajeExito("¡Listo! Tu horario de atención quedó guardado.");
    } catch (error) {
      setMensajeError(
        mensajeDeError(error) || "Error al guardar el horario",
      );
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) {
    return (
      <p className="horario-vendedor__cargando">Cargando tu horario...</p>
    );
  }

  return (
    <div className="horario-vendedor">
      <Link to="/panel-vendedor" className="horario-vendedor__volver">
        ← Volver a mi panel
      </Link>

      <h1>Tu horario de atención</h1>
      <p className="horario-vendedor__intro">
        Activa los días y las horas en que estarás disponible para atender a
        los compradores. Fuera de este horario tus publicaciones siguen
        visibles, pero la fila virtual no abre y las tarjetas del catálogo se
        muestran con aviso rojo hasta que vuelvas a estar disponible.
      </p>

      <div className="horario-vendedor__tarjeta">
        <SelectorHorario horarios={horarios} onChange={setHorarios} />
        <p className="horario-vendedor__nota">
          El horario debe estar entre las 05:00 y las 23:59, hora del centro
          de México (GMT-6). Necesitas al menos una hora de disponibilidad a
          la semana.
        </p>
      </div>

      {mensajeError && (
        <p className="horario-vendedor__error">{mensajeError}</p>
      )}
      {mensajeExito && (
        <p className="horario-vendedor__exito">{mensajeExito}</p>
      )}

      <button
        type="button"
        className="horario-vendedor__guardar"
        onClick={guardarHorario}
        disabled={guardando}
      >
        {guardando ? "Guardando..." : "Guardar y confirmar horario"}
      </button>
    </div>
  );
}

export default HorarioVendedor;
