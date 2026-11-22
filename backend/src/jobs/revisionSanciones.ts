import { desbloquearSancionesExpiradas } from "../services/sancionService.js";

export async function revisarSanciones(): Promise<string[]> {
  const avisadas = await desbloquearSancionesExpiradas();
  return avisadas > 0
    ? [`${avisadas} bloqueo(s) temporal(es) concluido(s) y avisado(s)`]
    : [];
}
