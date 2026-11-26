import {
  generarInformesMensuales,
  periodoAnterior,
  periodoDeFecha,
  purgarReportesEInformesAntiguos,
} from "../services/informesService.js";
import { purgarFaltasExpiradas } from "../services/sancionService.js";

export async function ejecutarRevisionMensual(
  ahora = new Date(),
): Promise<string[]> {
  const acciones: string[] = [];
  const periodo = periodoAnterior(periodoDeFecha(ahora));

  const resultado = await generarInformesMensuales(periodo);
  acciones.push(
    `Informes de ${periodo} generados (${resultado.vendedores} vendedor(es), categoría más vendida: ${
      resultado.global.categoriaMasVendida ?? "sin resultado (empate o sin ventas)"
    })`,
  );

  const purga = await purgarReportesEInformesAntiguos(ahora);
  acciones.push(
    `Purga RQNF14.1 de ${purga.periodo}: ${purga.reportes} reporte(s), ${purga.informesVendedor} informe(s) de vendedor y ${purga.informesGlobales} informe(s) global(es) eliminados`,
  );

  const faltas = await purgarFaltasExpiradas(ahora);
  if (faltas.faltas > 0) {
    acciones.push(
      `Purga: ${faltas.faltas} falta(s) de más de 13 meses eliminadas (${faltas.sanciones} sanción(es) recalculadas)`,
    );
  }

  return acciones;
}
