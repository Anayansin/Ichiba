import { useState, useEffect } from "react";
import SelectorHorario, {
  type BloqueHorario,
} from "../SelectorHorario/SelectorHorario";
import { fetchPerfil } from "../../services/usuarioServices";
import api from "../../services/api";
import { mensajeDeError } from "../../utils/errores";
import "./ModalConfirmacionHorario.css";

const HORARIO_VACIO: BloqueHorario[] = [
  { dia: "lunes", activo: false, horaInicio: "09:00", horaFin: "18:00" },
  { dia: "martes", activo: false, horaInicio: "09:00", horaFin: "18:00" },
  { dia: "miercoles", activo: false, horaInicio: "09:00", horaFin: "18:00" },
  { dia: "jueves", activo: false, horaInicio: "09:00", horaFin: "18:00" },
  { dia: "viernes", activo: false, horaInicio: "09:00", horaFin: "18:00" },
  { dia: "sabado", activo: false, horaInicio: "09:00", horaFin: "18:00" },
  { dia: "domingo", activo: false, horaInicio: "09:00", horaFin: "18:00" },
];

function mesEnZonaCentro(fecha: Date): string {
  const enZonaCentro = new Date(fecha.getTime() - 6 * 60 * 60 * 1000);
  return `${enZonaCentro.getUTCFullYear()}-${enZonaCentro.getUTCMonth()}`;
}

function confirmadoEsteMes(fecha: string | null | undefined): boolean {
  if (!fecha) return false;
  return mesEnZonaCentro(new Date(fecha)) === mesEnZonaCentro(new Date());
}

function ModalConfirmacionHorario() {
  const [cargando, setCargando] = useState(true);
  const [pendiente, setPendiente] = useState(false);
  const [horarios, setHorarios] = useState<BloqueHorario[]>(HORARIO_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [mensajeError, setMensajeError] = useState("");

  useEffect(() => {
    fetchPerfil()
      .then((perfil) => {
        if (perfil.horarios && perfil.horarios.length > 0) {
          setHorarios(perfil.horarios);
        }
        setPendiente(!confirmadoEsteMes(perfil.horarioConfirmadoEn));
      })
      .catch(() => {
      })
      .finally(() => setCargando(false));
  }, []);

  async function confirmarHorario() {
    setGuardando(true);
    setMensajeError("");
    try {
      await api.put("/usuarios/confirmar-horario", { horarios });
      setPendiente(false);
    } catch (error) {
      setMensajeError(
        mensajeDeError(error) || "No se pudo confirmar el horario",
      );
    } finally {
      setGuardando(false);
    }
  }

  if (cargando || !pendiente) return null;

  return (
    <div className="modal-horario-overlay" role="dialog" aria-modal="true">
      <div className="modal-horario">
        <h2 className="modal-horario__titulo">
          Confirma tu horario de este mes
        </h2>
        <p className="modal-horario__texto">
          Antes de usar tu panel debes confirmar tu disponibilidad de atención
          del mes. Puedes mantener tu horario actual o modificarlo; cuando lo
          tengas, presiona <strong>Guardar y confirmar</strong>.
        </p>

        <div className="modal-horario__selector">
          <SelectorHorario horarios={horarios} onChange={setHorarios} />
        </div>

        {mensajeError && (
          <p className="modal-horario__error">{mensajeError}</p>
        )}

        <button
          type="button"
          className="modal-horario__boton"
          onClick={confirmarHorario}
          disabled={guardando}
        >
          {guardando ? "Guardando..." : "Guardar y confirmar"}
        </button>
      </div>
    </div>
  );
}

export default ModalConfirmacionHorario;
