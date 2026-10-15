import { Sancion } from "../models/Sancion.js";
import { Usuario } from "../models/usuario.js";
import clientePrisma from "../configuracion/prisma.js";
import { categoriaRequiereRevisionInmediata } from "../configuracion/categoriasReporte.js";
import {
  enviarCorreoSancionAplicada,
  enviarCorreoSancionLevantada,
} from "./emailService.js";
import {
  publicarEventoUsuario,
  publicarResumenAdmin,
} from "../graphql/suscripciones.js";
import { resumirUsuario } from "./resumenAdminService.js";

/**
 * RQNF33 / RQNF34 / RQNF35: sanciones automáticas por faltas.
 *
 * Reglas (interpretación aprobada por el cliente):
 *   - 3 faltas leves   -> bloqueo temporal de 7 días (y cada leve adicional
 *     mientras el conteo siga en 3 o más extiende el bloqueo otros 7 días
 *     desde esa falta: la duración crece con la reincidencia, RQNF34).
 *   - 1 falta grave    -> bloqueo temporal de 30 días.
 *   - 2 faltas graves  -> suspensión indefinida (RQNF34).
 *   - falta grave de revisión inmediata (estafa o fraude comprobado,
 *     suplantación de identidad, amenazas y comprobantes falsos) ->
 *     suspensión indefinida + envío a revisión administrativa (RQNF35).
 *
 * El estado completo se recalcula desde el historial de faltas, de modo que:
 *   - un reporte RECHAZADO por el administrador revierte la falta y el
 *     bloqueo que había generado (`quitarFalta`);
 *   - las faltas solo cuentan 13 meses: al cumplirlos se purgan junto con
 *     los reportes que las originaron (`purgarFaltasExpiradas`, RQNF14.1).
 *
 * RQNF33: el trabajo `revisionSanciones` levanta (avisa) los bloqueos
 * temporales en cuanto concluye su periodo, de forma automática.
 */

export type EstadoBloqueo = {
  bloqueada: boolean;
  permanente: boolean;
  hasta: Date | null;
  faltasLeves: number;
  faltasGraves: number;
  bloqueosAplicados: number;
  revisionAdministrativa: boolean;
  motivoRevision: string | null;
};

const MILIS_DIA = 24 * 60 * 60 * 1000;
export const DIAS_BLOQUEO_LEVES = 7;
export const DIAS_BLOQUEO_GRAVE = 30;
export const MESES_VIGENCIA_FALTAS = 13;

type EntradaHistorial = {
  reporteId?: unknown;
  categoria: string;
  tipoFalta: "leve" | "grave";
  elemento?: string | null;
  reportadoPor?: string | null;
  fecha?: Date | null;
};

function fechaDeEntrada(entrada: EntradaHistorial): Date {
  return entrada.fecha ? new Date(entrada.fecha) : new Date();
}

function laMasTardia(actual: Date | null, candidata: Date): Date {
  if (!actual || candidata.getTime() > actual.getTime()) return candidata;
  return actual;
}

/**
 * Recalcula contadores, bloqueos y revisión administrativa a partir del
 * historial de faltas (fuente de verdad de la sanción). Es idempotente y lo
 * usan tanto el registro de una falta nueva como la reversión por rechazo o
 * la purga de faltas de más de 13 meses.
 */
function recalcularDesdeHistorial(sancion: any): void {
  const entradas: EntradaHistorial[] = [...(sancion.historial ?? [])].sort(
    (a, b) => fechaDeEntrada(a).getTime() - fechaDeEntrada(b).getTime(),
  );

  let faltasLeves = 0;
  let faltasGraves = 0;
  let bloqueosAplicados = 0;
  let bloqueadoHasta: Date | null = null;
  let bloqueoPermanente = false;
  let revisionAdministrativa = false;
  let revisionMotivo: string | null = null;
  let revisionIniciadaEn: Date | null = null;

  for (const entrada of entradas) {
    const fecha = fechaDeEntrada(entrada);

    if (entrada.tipoFalta === "grave") {
      faltasGraves += 1;

      if (categoriaRequiereRevisionInmediata(entrada.categoria)) {
        // RQNF35: suspensión indefinida + revisión administrativa.
        bloqueoPermanente = true;
        bloqueosAplicados += 1;
        revisionAdministrativa = true;
        revisionMotivo = `Falta grave de revisión inmediata (${entrada.categoria})`;
        revisionIniciadaEn = revisionIniciadaEn ?? fecha;
      } else if (faltasGraves >= 2) {
        // RQNF34: la segunda falta grave suspende de forma indefinida.
        bloqueoPermanente = true;
        bloqueosAplicados += 1;
      } else {
        bloqueosAplicados += 1;
        bloqueadoHasta = laMasTardia(
          bloqueadoHasta,
          new Date(fecha.getTime() + DIAS_BLOQUEO_GRAVE * MILIS_DIA),
        );
      }
      continue;
    }

    faltasLeves += 1;
    // RQNF33 / RQNF34: desde la tercera falta leve cada una suma un bloqueo
    // de 7 días contado desde esa falta (el bloqueo vigente nunca se acorta).
    if (faltasLeves >= 3) {
      bloqueosAplicados += 1;
      bloqueadoHasta = laMasTardia(
        bloqueadoHasta,
        new Date(fecha.getTime() + DIAS_BLOQUEO_LEVES * MILIS_DIA),
      );
    }
  }

  sancion.faltasLeves = faltasLeves;
  sancion.faltasGraves = faltasGraves;
  sancion.bloqueosAplicados = bloqueosAplicados;
  sancion.bloqueoPermanente = bloqueoPermanente;
  sancion.bloqueadoHasta = bloqueoPermanente ? null : bloqueadoHasta;
  sancion.revisionAdministrativa = revisionAdministrativa;
  sancion.revisionMotivo = revisionMotivo ?? undefined;
  sancion.revisionIniciadaEn = revisionIniciadaEn ?? undefined;
}

/** Estado de bloqueo de una sanción (nula = sin sanciones). */
export function estadoBloqueo(sancion: any): EstadoBloqueo {
  const faltasLeves: number = sancion?.faltasLeves ?? 0;
  const faltasGraves: number = sancion?.faltasGraves ?? 0;
  // El levantamiento manual del administrador desactiva la sanción vigente
  // (RQNF33: la administración puede revertirla antes de los 13 meses).
  const levantada = Boolean(sancion?.levantadaPorAdminEn);
  const base = {
    faltasLeves,
    faltasGraves,
    bloqueosAplicados: Number(sancion?.bloqueosAplicados ?? 0),
    revisionAdministrativa: !levantada && sancion?.revisionAdministrativa === true,
    motivoRevision:
      !levantada && sancion?.revisionMotivo
        ? String(sancion.revisionMotivo)
        : null,
  };

  if (!sancion || levantada) {
    return { bloqueada: false, permanente: false, hasta: null, ...base };
  }

  if (sancion.bloqueoPermanente) {
    return { bloqueada: true, permanente: true, hasta: null, ...base };
  }

  const hasta: Date | null = sancion.bloqueadoHasta
    ? new Date(sancion.bloqueadoHasta)
    : null;
  const activa = !!hasta && hasta.getTime() > Date.now();

  return {
    bloqueada: activa,
    permanente: false,
    hasta: activa ? hasta : null,
    ...base,
  };
}

export async function sancionDe(
  sujetoTipo: "usuario" | "comprador",
  sujetoId: string | undefined,
) {
  if (!sujetoId) return null;
  return Sancion.findOne({ sujetoTipo, sujetoId });
}

type FaltaARegistrar = {
  sujetoTipo: "usuario" | "comprador";
  sujetoId: string;
  reporteId: string;
  categoria: string;
  tipoFalta: "leve" | "grave";
  elemento: string;
  reportadoPor: string;
};

/** Correo del usuario sancionado (solo los usuarios registrados lo tienen). */
async function correoDelSujeto(sancion: {
  sujetoTipo: string;
  sujetoId: string;
}): Promise<{ correo: string; nombre: string } | null> {
  if (sancion.sujetoTipo !== "usuario") return null;
  const id = Number(sancion.sujetoId);
  if (!Number.isInteger(id)) return null;

  const usuario = await Usuario.findOne({ usuarioId: id }).lean();
  if (usuario?.correo) {
    return {
      correo: String(usuario.correo),
      nombre: String(usuario.nombreCompleto ?? ""),
    };
  }

  // Respaldo: el correo también vive en PostgreSQL.
  const enPg = await clientePrisma.usuario.findUnique({
    where: { id },
    select: { correo: true, nombreCompleto: true },
  });
  if (!enPg?.correo) return null;
  return { correo: String(enPg.correo), nombre: String(enPg.nombreCompleto ?? "") };
}

/** Refleja el estado de la sanción en el espejo de MongoDB del BackOffice. */
async function sincronizarEspejo(
  sancion: {
    sujetoTipo: string;
    sujetoId: string;
  },
  tipoEvento: "sancion" | "desbloqueado" | "reactivado",
  mensaje: string,
): Promise<void> {
  if (sancion.sujetoTipo !== "usuario") return;
  const id = Number(sancion.sujetoId);
  if (!Number.isInteger(id)) return;

  try {
    const estado = estadoBloqueo(sancion);
    await Usuario.updateOne(
      { usuarioId: id },
      {
        $set: {
          sancionHasta: estado.hasta,
          sancionPermanente: estado.permanente,
          revisionAdministrativa: estado.revisionAdministrativa,
          motivoRevision: estado.motivoRevision,
          bloqueosAplicados: estado.bloqueosAplicados,
        },
      },
    );

    const espejo = await Usuario.findOne({ usuarioId: id }).lean();
    if (espejo) {
      await publicarEventoUsuario(tipoEvento, mensaje, resumirUsuario(espejo));
    }
  } catch (error) {
    console.error(
      "[sanciones] No se pudo actualizar el espejo del BackOffice:",
      error instanceof Error ? error.message : error,
    );
  }
  publicarResumenAdmin();
}

/** Texto legible del estado de bloqueo para correos y mensajes. */
export function describirEstadoBloqueo(estado: EstadoBloqueo): string {
  if (estado.permanente && estado.revisionAdministrativa) {
    return "Tu cuenta quedó suspendida de forma indefinida y fue enviada a revisión administrativa.";
  }
  if (estado.permanente) {
    return "Tu cuenta quedó suspendida de forma indefinida por la reincidencia de faltas graves.";
  }
  if (estado.hasta) {
    const fecha = new Date(estado.hasta).toLocaleString("es-MX", {
      dateStyle: "long",
      timeStyle: "short",
    });
    return `Tu cuenta quedó bloqueada de forma temporal hasta el ${fecha}.`;
  }
  return "Tu cuenta tiene una sanción activa.";
}

/**
 * Registra una falta por un reporte recién creado y aplica las reglas de
 * reincidencia. Devuelve el estado de bloqueo resultante del sujeto.
 */
export async function registrarFalta(
  falta: FaltaARegistrar,
): Promise<EstadoBloqueo> {
  const previa = await sancionDe(falta.sujetoTipo, falta.sujetoId);
  const bloqueosAntes = Number(previa?.bloqueosAplicados ?? 0);
  const revisionAntes = previa?.revisionAdministrativa === true;

  const sancion = await Sancion.findOneAndUpdate(
    { sujetoTipo: falta.sujetoTipo, sujetoId: falta.sujetoId },
    {
      $push: {
        historial: {
          reporteId: falta.reporteId,
          categoria: falta.categoria,
          tipoFalta: falta.tipoFalta,
          elemento: falta.elemento,
          reportadoPor: falta.reportadoPor,
          fecha: new Date(),
        },
      },
      // Una falta nueva descarta el levantamiento manual anterior: las reglas
      // de reincidencia vuelven a aplicar (RQNF34).
      $unset: { levantadaPorAdminEn: 1, levantadaPorAdminMotivo: 1 },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  recalcularDesdeHistorial(sancion);
  await sancion.save();

  const estado = estadoBloqueo(sancion);

  // RQNF33 / RQNF35: se avisa al sancionado cuando la falta le aplica un
  // bloqueo nuevo o lo manda a revisión administrativa.
  if (estado.bloqueosAplicados > bloqueosAntes || (!revisionAntes && estado.revisionAdministrativa)) {
    const contacto = await correoDelSujeto(falta);
    if (contacto) {
      try {
        await enviarCorreoSancionAplicada(contacto.correo, contacto.nombre, {
          descripcion: describirEstadoBloqueo(estado),
          motivo: falta.categoria,
          revision: estado.revisionAdministrativa,
          hasta: estado.hasta,
        });
      } catch (error) {
        console.error(
          "[sanciones] No se pudo enviar el correo de sanción:",
          error instanceof Error ? error.message : error,
        );
      }
    }
  }

  await sincronizarEspejo(
    sancion,
    "sancion",
    estado.permanente
      ? `Sanción indefinida para el usuario #${falta.sujetoId}${estado.revisionAdministrativa ? " (en revisión administrativa)" : ""}`
      : `Usuario #${falta.sujetoId} bloqueado temporalmente por faltas`,
  );

  return estado;
}

/**
 * Revierte la falta que había generado un reporte (RQNF33): la usa el
 * administrador cuando RECHAZA un reporte. Recalcula el estado completo
 * desde el historial restante y avisa si el bloqueo se levantó.
 */
export async function quitarFalta(
  reporteId: string,
): Promise<EstadoBloqueo | null> {
  const sancion = await Sancion.findOne({ "historial.reporteId": reporteId });
  if (!sancion) return null;

  const antes = estadoBloqueo(sancion);

  const restantes = [...(sancion.historial ?? [])].filter(
    (entrada: any) => String(entrada.reporteId) !== String(reporteId),
  );
  sancion.set("historial", restantes);
  recalcularDesdeHistorial(sancion);
  await sancion.save();

  const despues = estadoBloqueo(sancion);

  if (antes.bloqueada && !despues.bloqueada) {
    const contacto = await correoDelSujeto({
      sujetoTipo: sancion.sujetoTipo,
      sujetoId: sancion.sujetoId,
    });
    if (contacto) {
      try {
        await enviarCorreoSancionLevantada(
          contacto.correo,
          contacto.nombre,
          "El reporte que originó el bloqueo fue rechazado por la administración.",
        );
      } catch (error) {
        console.error(
          "[sanciones] No se pudo enviar el correo de desbloqueo:",
          error instanceof Error ? error.message : error,
        );
      }
    }
  }

  await sincronizarEspejo(
    sancion,
    "desbloqueado",
    despues.bloqueada
      ? `Se revirtió una falta del usuario #${sancion.sujetoId}; mantiene sanción vigente`
      : `Se levantó el bloqueo del usuario #${sancion.sujetoId} al rechazarse el reporte`,
  );

  return despues;
}

/**
 * RQNF33 / RQNF34 / RQNF35: levantamiento manual de la sanción por parte del
 * administrador (p. ej. al concluir una revisión administrativa o al aprobar
 * una apelación). La sanción deja de bloquear; si el sujeto recibe una falta
 * nueva, el levantamiento se descarta y las reglas vuelven a aplicarse.
 */
export async function levantarSancionPorAdmin(
  sujetoTipo: "usuario" | "comprador",
  sujetoId: string,
  motivo: string,
): Promise<EstadoBloqueo | null> {
  const sancion = await sancionDe(sujetoTipo, sujetoId);
  if (!sancion) return null;

  sancion.levantadaPorAdminEn = new Date();
  sancion.levantadaPorAdminMotivo = motivo;
  await sancion.save();

  await sincronizarEspejo(
    sancion,
    "reactivado",
    `La administración levantó la sanción del sujeto ${sujetoTipo} #${sujetoId}`,
  );

  return estadoBloqueo(sancion);
}

/**
 * RQNF33: levanta automáticamente los bloqueos temporales concluidos. El
 * estado ya se calcula por fecha, así que aquí solo se avisa (una sola vez)
 * al sancionado y al BackOffice. Devuelve cuántos avisos se enviaron.
 */
export async function desbloquearSancionesExpiradas(
  ahora = new Date(),
): Promise<number> {
  const sanciones = await Sancion.find({
    bloqueoPermanente: false,
    bloqueadoHasta: { $ne: null },
    avisoDesbloqueoEn: null,
  });

  let avisadas = 0;
  for (const sancion of sanciones) {
    const hasta = sancion.bloqueadoHasta
      ? new Date(sancion.bloqueadoHasta)
      : null;
    if (!hasta || hasta.getTime() > ahora.getTime()) continue;

    sancion.avisoDesbloqueoEn = ahora;
    await sancion.save();
    avisadas += 1;

    const contacto = await correoDelSujeto({
      sujetoTipo: sancion.sujetoTipo,
      sujetoId: sancion.sujetoId,
    });
    if (contacto) {
      try {
        await enviarCorreoSancionLevantada(
          contacto.correo,
          contacto.nombre,
          "El periodo de tu bloqueo temporal concluyó y tu cuenta quedó desbloqueada de forma automática.",
        );
      } catch (error) {
        console.error(
          "[sanciones] No se pudo avisar del desbloqueo:",
          error instanceof Error ? error.message : error,
        );
      }
    }

    await sincronizarEspejo(
      sancion,
      "desbloqueado",
      `El bloqueo temporal del usuario #${sancion.sujetoId} concluyó automáticamente`,
    );
  }

  return avisadas;
}

/**
 * RQNF14.1: purga las faltas de más de 13 meses y recalcula el estado de las
 * sanciones afectadas. Las faltas solo cuentan durante ese periodo.
 */
export async function purgarFaltasExpiradas(
  ahora = new Date(),
): Promise<{ sanciones: number; faltas: number }> {
  const limite = new Date(ahora);
  limite.setMonth(limite.getMonth() - MESES_VIGENCIA_FALTAS);

  const sanciones = await Sancion.find({});
  let sancionesAfectadas = 0;
  let faltasBorradas = 0;

  for (const sancion of sanciones) {
    const historial: EntradaHistorial[] = [...(sancion.historial ?? [])];
    const vigentes = historial.filter(
      (entrada) => fechaDeEntrada(entrada).getTime() >= limite.getTime(),
    );
    const borradas = historial.length - vigentes.length;
    if (borradas === 0) continue;

    sancion.set("historial", vigentes);
    recalcularDesdeHistorial(sancion);
    await sancion.save();

    sancionesAfectadas += 1;
    faltasBorradas += borradas;

    await sincronizarEspejo(
      sancion,
      "reactivado",
      `Prescribieron ${borradas} falta(s) del usuario #${sancion.sujetoId} (13 meses)`,
    );
  }

  return { sanciones: sancionesAfectadas, faltas: faltasBorradas };
}
