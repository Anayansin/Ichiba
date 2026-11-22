import {
  expirarFilasVencidas,
  reactivarFilasEnEsperaDeApertura,
} from "../services/filaService.js";

export async function revisarTurnosDePago(): Promise<void> {
  const vencidas = await expirarFilasVencidas();
  if (vencidas > 0) {
    console.log(`Turnos de pago vencidos liberados: ${vencidas}`);
  }

  const reactivadas = await reactivarFilasEnEsperaDeApertura();
  if (reactivadas > 0) {
    console.log(`Filas reanudadas al abrir el bloque de atención: ${reactivadas}`);
  }
}
