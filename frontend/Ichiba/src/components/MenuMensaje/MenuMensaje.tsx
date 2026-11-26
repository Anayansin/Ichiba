import { useEffect, useRef, useState } from "react";
import BotonReportar from "../BotonReportar/BotonReportar";
import type { OrigenMensaje } from "../../services/reporteService";
import "./MenuMensaje.css";

type Props = {
  mensajeId: string;
  origen: OrigenMensaje;
  ventaId?: string;
  className?: string;
};

// Botón de tres puntos junto a un mensaje con la opción de reportarlo.
function MenuMensaje({ mensajeId, origen, ventaId, className }: Props) {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [reportando, setReportando] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuAbierto) return;
    function cerrarAlSalir(evento: MouseEvent) {
      if (!contenedor.current?.contains(evento.target as Node)) {
        setMenuAbierto(false);
      }
    }
    document.addEventListener("mousedown", cerrarAlSalir);
    return () => document.removeEventListener("mousedown", cerrarAlSalir);
  }, [menuAbierto]);

  return (
    <div
      ref={contenedor}
      className={`menu-mensaje ${menuAbierto ? "menu-mensaje--abierto" : ""} ${className ?? ""}`}
    >
      <button
        type="button"
        className="menu-mensaje__puntos"
        onClick={() => setMenuAbierto((abierto) => !abierto)}
        aria-label="Opciones del mensaje"
        aria-haspopup="menu"
        aria-expanded={menuAbierto}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </button>

      {menuAbierto && (
        <div className="menu-mensaje__lista" role="menu">
          <button
            type="button"
            role="menuitem"
            className="menu-mensaje__opcion"
            onClick={() => {
              setMenuAbierto(false);
              setReportando(true);
            }}
          >
            Reportar
          </button>
        </div>
      )}

      <BotonReportar
        elemento="mensaje"
        mensajeId={mensajeId}
        origenMensaje={origen === "venta" ? undefined : origen}
        ventaId={origen === "venta" ? ventaId : undefined}
        texto="Reportar mensaje"
        abiertoExterno={reportando}
        onCerrar={() => setReportando(false)}
        sinBoton
      />
    </div>
  );
}

export default MenuMensaje;
