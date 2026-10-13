import cron from "node-cron";
import fs from "fs";
import path from "path";
import { Usuario } from "../models/usuario.js";
import { Producto } from "../models/producto.js";
import { Cola } from "../models/Cola.js";
import { Venta } from "../models/Venta.js";
import { Mensaje } from "../models/Mensaje.js";
import { Reporte } from "../models/Reporte.js";
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

async function revisarHorariosDeVendedores() {
  // RQNF5.3/RQNF5.4: todo el calendario del mes se cuenta en GMT-6.
  const hoy = relojZonaCentro(new Date());
  const esPrimerDiaDelMes = hoy.getDate() === 1;

  const usuarios = await Usuario.find({ tipo: "vendedor" });

  for (const usuario of usuarios) {
    const fechaConfirmacion = usuario.horarioConfirmadoEn ?? usuario.createdAt;
    // Los días se cuentan con el instante real (no con el reloj desplazado).
    const diasDesdeConfirmacion = Math.floor(
      (Date.now() - fechaConfirmacion.getTime()) / (1000 * 60 * 60 * 24),
    );

    // RQNF5.3: el primer día de cada mes se cuentan las no confirmaciones
    // (la solicitud al vendedor es el modal bloqueante del panel, no un correo).

    // El id del vendedor en el catálogo de productos es el id numérico de
    // PostgreSQL; se guarda como `usuarioId` en la copia de MongoDB.
    const idVendedor = String(usuario.usuarioId ?? usuario._id);

    if (esPrimerDiaDelMes && diasDesdeConfirmacion >= 28) {
      usuario.diasSinConfirmarHorario += 1;

      if (usuario.diasSinConfirmarHorario >= 2) {
        const productosDelVendedor = await Producto.find({
          vendedorId: idVendedor,
        });
        const idsProductos = productosDelVendedor.map((p) => p._id);

        await Cola.deleteMany({ productoId: { $in: idsProductos } });

        const ventasDelVendedor = await Venta.find({
          vendedorId: idVendedor,
        });
        const idsVentas = ventasDelVendedor.map((v) => v._id);

        await Mensaje.deleteMany({ ventaId: { $in: idsVentas } });
        await Venta.deleteMany({ vendedorId: idVendedor });
        await Reporte.deleteMany({ vendedorId: usuario.usuarioId ?? usuario._id });
        await Producto.deleteMany({ vendedorId: idVendedor });

        for (const producto of productosDelVendedor) {
          for (const imagen of producto.imagenes) {
            const rutaImagen = path.join(
              process.cwd(),
              "uploads",
              imagen.replace("/uploads/", ""),
            );
            fs.unlink(rutaImagen, () => {});
          }
        }

        await Usuario.findByIdAndDelete(usuario._id);
        continue;
      }

      await usuario.save();
    }

    if (diasDesdeConfirmacion === 2) {
      await enviarCorreoAdvertencia(
        usuario.correo,
        "Tu cuenta será eliminada si no confirmas tu horario el próximo mes. Llevas 2 días sin confirmar.",
      );
    }

    if (diasDesdeConfirmacion === 17) {
      await enviarCorreoAdvertencia(
        usuario.correo,
        "Tu cuenta será eliminada mañana si no confirmas tu horario. Esta es tu segunda falta consecutiva.",
      );
    }
  }
}
