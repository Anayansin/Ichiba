import cron from "node-cron";
import fs from "fs";
import path from "path";
import { Usuario } from "../models/usuario.js";
import { Producto } from "../models/producto.js";
import { Promocional } from "../models/Promocional.js";
import { Comentario } from "../models/Comentario.js";
import { Cola } from "../models/Cola.js";
import { Venta } from "../models/Venta.js";
import { Mensaje } from "../models/Mensaje.js";
import { Reporte } from "../models/Reporte.js";
import { Sancion } from "../models/Sancion.js";
import { Suscripcion } from "../models/Suscripcion.js";
import { SuscripcionCategoria } from "../models/SuscripcionCategoria.js";
import {
  EstadoVinculacionPayPal,
  VinculoPayPal,
} from "../models/VinculoPayPal.js";
import clientePrisma from "../configuracion/prisma.js";
import { relojZonaCentro } from "../utils/validarHorario.js";
import { enviarCorreoAdvertencia } from "../services/emailService.js";

export function iniciarJobRevisionHorarios() {
  // 14:00 UTC = 08:00 en la zona centro (GMT-6), la hora de referencia del
  // sistema. El servidor del hosting vive en UTC, por eso se programa así.
  cron.schedule("0 14 * * *", async () => {
    try {
      await revisarHorariosDeVendedores();
    } catch (error) {
      console.error("[job] Falló la revisión de horarios:", error);
    }
  });
}

/** Días completos transcurridos desde una fecha (instante real). */
function diasDesde(fecha: Date): number {
  return Math.floor((Date.now() - fecha.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Días naturales que faltan para el próximo 1ro de mes, según el reloj en
 * GMT-6 que se le indique (RQNF6.3: el aviso sale 15 días antes).
 */
function diasParaProximoPrimerDia(hoy: Date): number {
  const hoyMedianoche = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const proximoPrimerDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1);
  return Math.round(
    (proximoPrimerDia.getTime() - hoyMedianoche.getTime()) / (1000 * 60 * 60 * 24),
  );
}

/** Borra un archivo de `uploads/` sin fallar si ya no existe. */
function borrarArchivoDeSubidas(ruta?: string | null) {
  if (!ruta || ruta.includes("..")) return;
  const relativa = ruta.replace(/^\/+/, "");
  if (!relativa.startsWith("uploads/")) return;
  fs.unlink(path.join(process.cwd(), relativa), () => {});
}

type CuentaMongo = {
  _id: unknown;
  correo: string;
  ineFrente?: string | null;
  ineReverso?: string | null;
};

/**
 * RQNF6.6 — Elimina TODOS los registros relacionados con el vendedor, en
 * PostgreSQL y MongoDB, incluidos los archivos en disco: no hay posibilidad
 * de recuperación.
 *
 * Orden pensado para que un fallo parcial sea reintentable: en PostgreSQL
 * primero las filas con llave foránea (ventas y reportes) y la cuenta al
 * final; en MongoDB el documento de la cuenta es lo último en borrarse (si
 * algo falla, la revisión del próximo mes vuelve a intentarlo).
 */
async function eliminarCuentaDeVendedor(
  usuario: CuentaMongo,
  idVendedor: string,
  idNumerico: number,
) {
  // Todo lo que identifica al vendedor se recoge ANTES de borrar nada.
  const productosDelVendedor = await Producto.find({ vendedorId: idVendedor });
  const idsProductos = productosDelVendedor.map((producto) => producto._id);
  const promocionalesDelVendedor = await Promocional.find({
    vendedorId: idVendedor,
  });
  const idsPromocionales = promocionalesDelVendedor.map(
    (promocional) => String(promocional._id),
  );
  const ventasDelVendedor = await Venta.find({ vendedorId: idVendedor });
  const idsVentas = ventasDelVendedor.map((venta) => venta._id);

  const idPostgres =
    Number.isInteger(idNumerico) && idNumerico > 0 ? idNumerico : null;

  // PostgreSQL: primero las filas que referencian a la cuenta y, al final,
  // la cuenta misma (ventas y reportes tienen llave foránea hacia `usuario`).
  if (idPostgres !== null) {
    await clientePrisma.venta.deleteMany({ where: { vendedorId: idPostgres } });
    await clientePrisma.reporte.deleteMany({ where: { vendedorId: idPostgres } });
    await clientePrisma.usuario.deleteMany({ where: { id: idPostgres } });
    // Vinculación con PayPal: el vínculo guarda el Merchant ID y el Token
    // de Acceso cifrado; no puede sobrevivir a la cuenta (RQNF4).
    await VinculoPayPal.deleteMany({ usuarioId: idPostgres });
    await EstadoVinculacionPayPal.deleteMany({ usuarioId: idPostgres });
  }

  // Filas de PostgreSQL asociadas a sus publicaciones.
  await clientePrisma.cola.deleteMany({
    where: { productoId: { in: idsProductos.map(String) } },
  });

  // MongoDB: publicaciones y todo lo que cuelga de ellas.
  await Comentario.deleteMany({ promocionalId: { $in: idsPromocionales } });
  await Promocional.deleteMany({ vendedorId: idVendedor });
  // Espejo histórico de las filas (la cola actual vive en PostgreSQL).
  await Cola.deleteMany({ productoId: { $in: idsProductos } });
  await Mensaje.deleteMany({ ventaId: { $in: idsVentas } });
  await Venta.deleteMany({ vendedorId: idVendedor });
  await Reporte.deleteMany({
    $or: [
      // Reportes recibidos y enviados por el vendedor, y los que apuntan a
      // sus ventas o publicaciones.
      { sujetoTipo: "usuario", sujetoId: idVendedor },
      { reportadoPorTipo: "usuario", reportadoPorId: idVendedor },
      { ventaId: { $in: idsVentas } },
      { productoId: { $in: idsProductos } },
    ],
  });
  await Producto.deleteMany({ vendedorId: idVendedor });
  await Sancion.deleteMany({ sujetoTipo: "usuario", sujetoId: idVendedor });
  await Suscripcion.deleteMany({ correo: usuario.correo });
  await SuscripcionCategoria.deleteMany({ correo: usuario.correo });

  // Archivos en disco: productos, promocionales y las dos caras de la INE.
  for (const producto of productosDelVendedor) {
    for (const imagen of producto.imagenes ?? []) {
      borrarArchivoDeSubidas(imagen);
    }
  }
  for (const promocional of promocionalesDelVendedor) {
    for (const imagen of promocional.imagenes ?? []) {
      borrarArchivoDeSubidas(imagen);
    }
  }
  borrarArchivoDeSubidas(usuario.ineFrente);
  borrarArchivoDeSubidas(usuario.ineReverso);

  // Por último, la copia de la cuenta en MongoDB.
  await Usuario.findByIdAndDelete(usuario._id);
}

/**
 * Revisión diaria de horarios de los vendedores.
 *
 * `fechaBase` solo existe para pruebas: permite simular el 1ro de mes sin
 * esperar a la fecha real.
 */
export async function revisarHorariosDeVendedores(fechaBase?: Date) {
  // RQNF5.3/RQNF5.4: todo el calendario del mes se cuenta en GMT-6.
  const hoy = relojZonaCentro(fechaBase ?? new Date());
  const esPrimerDiaDelMes = hoy.getDate() === 1;
  const proximoPrimerDiaEn15 = diasParaProximoPrimerDia(hoy) === 15;

  const usuarios = await Usuario.find({ tipo: "vendedor" });

  for (const usuario of usuarios) {
    const fechaConfirmacion = usuario.horarioConfirmadoEn ?? usuario.createdAt;
    // Los días se cuentan con el instante real (no con el reloj desplazado).
    const diasDesdeConfirmacion = diasDesde(fechaConfirmacion);

    // El id del vendedor en el catálogo de productos es el id numérico de
    // PostgreSQL; se guarda como cadena en MongoDB.
    const idVendedor = String(usuario.usuarioId ?? usuario._id);
    const idNumerico = Number(usuario.usuarioId);

    if (esPrimerDiaDelMes && diasDesdeConfirmacion >= 28) {
      usuario.diasSinConfirmarHorario += 1;

      // RQNF6.4: la segunda falta consecutiva dispara el aviso de
      // eliminación, y RQNF6.5 manda eliminar la cuenta ese mismo 1ro de mes.
      if (usuario.diasSinConfirmarHorario >= 2) {
        await enviarCorreoAdvertencia(
          usuario.correo,
          "Has acumulado 2 faltas seguidas sin confirmar tu horario de atención, por lo que tu cuenta de Ichiba será eliminada hoy de forma permanente.",
          {
            asunto: "Aviso de eliminación de cuenta en Ichiba",
            pie: "Tu cuenta y todos sus registros serán eliminados sin posibilidad de recuperación.",
          },
        ).catch((errorCorreo) =>
          console.error(
            "[job] No se pudo enviar el aviso de eliminación:",
            errorCorreo?.message ?? errorCorreo,
          ),
        );

        try {
          await eliminarCuentaDeVendedor(usuario, idVendedor, idNumerico);
        } catch (error) {
          console.error(
            `[job] No se pudo eliminar la cuenta de ${usuario.correo}:`,
            error,
          );
        }
        continue;
      }

      // Primera falta: queda registrada en ambas bases (RQNF5.4).
      await usuario.save();
      if (Number.isInteger(idNumerico) && idNumerico > 0) {
        await clientePrisma.usuario
          .updateMany({
            where: { id: idNumerico },
            data: { diasSinConfirmarHorario: usuario.diasSinConfirmarHorario },
          })
          .catch((error) =>
            console.error(
              "[job] No se pudo reflejar la falta en PostgreSQL:",
              error?.message ?? error,
            ),
          );
      }
    }

    // RQNF6.3: 15 días antes de la eliminación pronosticada (el próximo 1ro
    // de mes, cuando ya hay una falta sin confirmar) se envía el aviso.
    if (usuario.diasSinConfirmarHorario >= 1 && proximoPrimerDiaEn15) {
      await enviarCorreoAdvertencia(
        usuario.correo,
        "Si no confirmas tu horario de atención antes del próximo 1ro de mes, tu cuenta de Ichiba será eliminada de forma permanente. Tienes 15 días para confirmarlo desde tu panel de vendedor.",
        { asunto: "Aviso: tu cuenta se eliminará el próximo 1ro de mes" },
      ).catch((errorCorreo) =>
        console.error(
          "[job] No se pudo enviar el aviso de 15 días:",
          errorCorreo?.message ?? errorCorreo,
        ),
      );
    }

    // Recordatorio temprano: a los 2 días sin confirmar se avisa que, si no
    // confirma antes del 1ro de mes, se contará una falta.
    if (diasDesdeConfirmacion === 2) {
      await enviarCorreoAdvertencia(
        usuario.correo,
        "Llevas 2 días sin confirmar tu horario de atención en Ichiba. Si no lo confirmas antes del próximo 1ro de mes se contará una falta; con 2 faltas seguidas tu cuenta será eliminada de forma permanente.",
      ).catch(() => undefined);
    }
  }
}
