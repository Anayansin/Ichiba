import cron from "node-cron";
import {
  expirarFilasVencidas,
  reactivarFilasEnEsperaDeApertura,
} from "../services/filaService.js";

/**
 * Cada minuto revisa quién siguió en posición 1 sin pagar dentro
 * de su tiempo límite: se libera el turno para la siguiente persona.
 * Además (RQF18) reanuda las filas que esperaban la próxima apertura del
 * vendedor cuando su bloque de atención vuelve a estar activo.
 */
export function iniciarJobRevisionPagos() {
  cron.schedule("* * * * *", async () => {
    try {
      const vencidas = await expirarFilasVencidas();
      if (vencidas > 0) {
        console.log(`Turnos de pago vencidos liberados: ${vencidas}`);
      }

      const reactivadas = await reactivarFilasEnEsperaDeApertura();
      if (reactivadas > 0) {
        console.log(`Filas reanudadas al abrir el bloque de atención: ${reactivadas}`);
      }
    } catch (error) {
      console.error("Error al revisar tiempos de pago:", error);
    }
  });
}
