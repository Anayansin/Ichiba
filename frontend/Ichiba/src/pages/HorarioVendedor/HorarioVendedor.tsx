import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { Navigate } from "react-router-dom";
import SelectorHorario, {
  type BloqueHorario,
} from "../../components/SelectorHorario/SelectorHorario";
import { fetchPerfil } from "../../services/usuarioServices";
import api from "../../services/api";
import { mensajeDeError } from "../../utils/errores";

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

    try {
      await api.put("/usuarios/confirmar-horario", { horarios });
      alert("Horario guardado correctamente");
    } catch (error) {
      setMensajeError(
        mensajeDeError(error) || "Error al guardar el horario",
      );
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) return <p>Cargando tu horario...</p>;

  return (
    <div>
      <h1>Tu horario de atención</h1>
      <p>Selecciona los días y horas en que estarás disponible.</p>

      <SelectorHorario horarios={horarios} onChange={setHorarios} />

      {mensajeError && <p style={{ color: "red" }}>{mensajeError}</p>}

      <button onClick={guardarHorario} disabled={guardando}>
        {guardando ? "Guardando..." : "Guardar y confirmar horario"}
      </button>
    </div>
  );
}

export default HorarioVendedor;
