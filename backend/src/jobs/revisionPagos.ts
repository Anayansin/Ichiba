import cron from "node-cron";
import { expirarFilasVencidas } from "../services/filaService.js";

/**
 * Cada minuto revisa quién siguió en posición 1 sin pagar dentro
 * de su tiempo límite: se libera el turno para la siguiente persona.
 */
export function iniciarJobRevisionPagos() {
  cron.schedule("* * * * *", async () => {
    try {
      const vencidas = await expirarFilasVencidas();
      if (vencidas > 0) {
        console.log(`Turnos de pago vencidos liberados: ${vencidas}`);
      }
    } catch (error) {
      console.error("Error al revisar tiempos de pago:", error);
    }
  });
}
