import fs from "fs";
import path from "path";
import { Producto } from "../models/producto.js";
import { Promocional } from "../models/Promocional.js";
import { Comentario } from "../models/Comentario.js";
import { Venta } from "../models/Venta.js";
import { Mensaje } from "../models/Mensaje.js";
import { Reporte } from "../models/Reporte.js";
import { Sancion } from "../models/Sancion.js";
import { Suscripcion } from "../models/Suscripcion.js";
import { SuscripcionCategoria } from "../models/SuscripcionCategoria.js";
import { Usuario } from "../models/usuario.js";
import {
  EstadoVinculacionPayPal,
  VinculoPayPal,
} from "../models/VinculoPayPal.js";
import clientePrisma from "../configuracion/prisma.js";
import { relojZonaCentro } from "../utils/validarHorario.js";
import { enviarCorreoAdvertencia } from "../services/emailService.js";

function diasDesde(fecha: Date): number {
  return Math.floor((Date.now() - fecha.getTime()) / (1000 * 60 * 60 * 24));
}

function diasParaProximoPrimerDia(hoy: Date): number {
  const hoyMedianoche = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const proximoPrimerDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1);
  return Math.round(
    (proximoPrimerDia.getTime() - hoyMedianoche.getTime()) / (1000 * 60 * 60 * 24),
  );
}

function borrarArchivoDeSubidas(ruta?: string | null) {
  if (!ruta || ruta.includes("..")) return;
  const relativa = ruta.replace(/^\/+/, "");
  if (!relativa.startsWith("uploads/")) return;
  fs.unlink(path.join(process.cwd(), relativa), () => {});
}

type CuentaPostgres = {
  id: number;
  correo: string;
  nombreCompleto?: string;
  ineFrente?: string | null;
  ineReverso?: string | null;
  horarios?: unknown;
  horarioConfirmadoEn?: Date | null;
  diasSinConfirmarHorario?: number;
  createdAt?: Date;
};

async function eliminarCuentaDeVendedor(
  usuario: CuentaPostgres,
  idVendedor: string,
  idNumerico: number,
) {
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

  if (idPostgres !== null) {
    await clientePrisma.venta.deleteMany({ where: { vendedorId: idPostgres } });
    await clientePrisma.reporte.deleteMany({
      where: { vendedorId: idPostgres },
    });
    await clientePrisma.reporte.deleteMany({
      where: { reportadoPorId: String(idPostgres) },
    });
    await clientePrisma.usuario.deleteMany({ where: { id: idPostgres } });
    await VinculoPayPal.deleteMany({ usuarioId: idPostgres });
    await EstadoVinculacionPayPal.deleteMany({ usuarioId: idPostgres });
  }

  await clientePrisma.cola.deleteMany({
    where: { productoId: { in: idsProductos.map(String) } },
  });

  await Comentario.deleteMany({ promocionalId: { $in: idsPromocionales } });
  await Promocional.deleteMany({ vendedorId: idVendedor });
  await Mensaje.deleteMany({ ventaId: { $in: idsVentas } });
  await Venta.deleteMany({ vendedorId: idVendedor });
  await Producto.deleteMany({ vendedorId: idVendedor });
  await Sancion.deleteMany({ sujetoTipo: "usuario", sujetoId: idVendedor });
  await Suscripcion.deleteMany({ correo: usuario.correo });
  await SuscripcionCategoria.deleteMany({ correo: usuario.correo });

  await Reporte.deleteMany({
    $or: [
      { sujetoTipo: "usuario", sujetoId: idVendedor },
      { reportadoPorTipo: "usuario", reportadoPorId: idVendedor },
    ],
  });

  await Usuario.deleteMany({
    $or: [{ usuarioId: idNumerico }, { correo: usuario.correo }],
  });

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
}

export async function revisarHorariosDeVendedores(fechaBase?: Date) {
  const hoy = relojZonaCentro(fechaBase ?? new Date());
  const esPrimerDiaDelMes = hoy.getDate() === 1;
  const proximoPrimerDiaEn15 = diasParaProximoPrimerDia(hoy) === 15;

  const usuarios = await clientePrisma.usuario.findMany({
    where: { tipo: "vendedor" },
  });

  for (const usuario of usuarios) {
    const fechaConfirmacion = usuario.horarioConfirmadoEn ?? usuario.createdAt;
    const diasDesdeConfirmacion = diasDesde(fechaConfirmacion);

    const idVendedor = String(usuario.id);
    const idNumerico = Number(usuario.id);

    if (esPrimerDiaDelMes && diasDesdeConfirmacion >= 28) {
      usuario.diasSinConfirmarHorario += 1;

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

      await clientePrisma.usuario
        .updateMany({
          where: { id: idNumerico },
          data: { diasSinConfirmarHorario: usuario.diasSinConfirmarHorario },
        })
        .catch((error) =>
          console.error(
            "[job] No se pudo registrar la falta en PostgreSQL:",
            error?.message ?? error,
          ),
        );
    }

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

    if (diasDesdeConfirmacion === 2) {
      await enviarCorreoAdvertencia(
        usuario.correo,
        "Llevas 2 días sin confirmar tu horario de atención en Ichiba. Si no lo confirmas antes del próximo 1ro de mes se contará una falta; con 2 faltas seguidas tu cuenta será eliminada de forma permanente.",
      ).catch(() => undefined);
    }
  }
}
