import cron from "node-cron";
import {
  generarInformesMensuales,
  periodoAnterior,
  periodoDeFecha,
  purgarReportesEInformesAntiguos,
} from "../services/informesService.js";
import { purgarFaltasExpiradas } from "../services/sancionService.js";
import { InformeGlobal } from "../models/InformeGlobal.js";

/**
 * RQNF13.2 / RQNF14: los informes mensuales (por vendedor y globales) se
 * generan cada día 1° de mes con lo sucedido en el mes recién concluido.
 * RQNF14.1: ese mismo día se eliminan los reportes e informes que cumplen
 * 13 meses de antigüedad, junto con las faltas que los originaron (las
 * sanciones solo cuentan durante 13 meses).
 */
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
      `Purga RQNF14.1: ${faltas.faltas} falta(s) de más de 13 meses eliminadas (${faltas.sanciones} sanción(es) recalculadas)`,
    );
  }

  return acciones;
}

/**
 * Si el servidor estuvo apagado el día 1°, se recupera al arrancar: genera el
 * informe del mes pasado si falta y aplica la purga (ambas operaciones son
 * idempotentes).
 */
async function recuperarInformePendiente(): Promise<void> {
  try {
    const periodo = periodoAnterior(periodoDeFecha(new Date()));
    const existente = await InformeGlobal.findOne({ periodo }).lean();
    if (!existente) {
      const acciones = await ejecutarRevisionMensual();
      for (const accion of acciones) {
        console.log(`[informes] ${accion}`);
      }
    } else {
      const purga = await purgarReportesEInformesAntiguos();
      if (
        purga.reportes > 0 ||
        purga.informesVendedor > 0 ||
        purga.informesGlobales > 0
      ) {
        console.log(
          `[informes] Purga RQNF14.1 de ${purga.periodo}: ${purga.reportes} reporte(s), ${
            purga.informesVendedor + purga.informesGlobales
          } informe(s) eliminados`,
        );
      }

      // RQNF14.1: las faltas también prescriben a los 13 meses.
      const faltas = await purgarFaltasExpiradas();
      if (faltas.faltas > 0) {
        console.log(
          `[informes] Purga RQNF14.1: ${faltas.faltas} falta(s) de más de 13 meses eliminadas`,
        );
      }
    }
  } catch (error) {
    console.error(
      "[informes] No se pudo recuperar el informe mensual:",
      error instanceof Error ? error.message : error,
    );
  }
}

export function iniciarJobInformesMensuales() {
  // Día 1° de cada mes a las 00:05 (hora del servidor).
  cron.schedule("5 0 1 * *", async () => {
    try {
      const acciones = await ejecutarRevisionMensual();
      for (const accion of acciones) {
        console.log(`[informes] ${accion}`);
      }
    } catch (error) {
      console.error("Error al generar los informes mensuales:", error);
    }
  });

  void recuperarInformePendiente();
}
