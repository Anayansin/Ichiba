import cron from "node-cron";
import { desbloquearSancionesExpiradas } from "../services/sancionService.js";

/**
 * RQNF33: los bloqueos temporales por faltas (7 o 30 días) se levantan de
 * forma automática al concluir su periodo. El estado ya se calcula por fecha,
 * así que este trabajo solo envía el aviso (una sola vez) al sancionado y al
 * BackOffice, que lo recibe por la suscripción `usuariosAdmin`.
 */
export async function revisarSanciones(): Promise<string[]> {
  const avisadas = await desbloquearSancionesExpiradas();
  return avisadas > 0
    ? [`${avisadas} bloqueo(s) temporal(es) concluido(s) y avisado(s)`]
    : [];
}

export function iniciarJobRevisionSanciones() {
  // Cada 5 minutos: el desbloqueo es puntual sin cargar la base de datos.
  cron.schedule("*/5 * * * *", async () => {
    try {
      const acciones = await revisarSanciones();
      for (const accion of acciones) {
        console.log(`[sanciones] ${accion}`);
      }
    } catch (error) {
      console.error("Error al revisar las sanciones:", error);
    }
  });
}
