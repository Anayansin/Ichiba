import cron from "node-cron";
import fs from "fs";
import path from "path";
import { Usuario } from "../models/usuario.js";
import { Producto } from "../models/producto.js";
import { Cola } from "../models/Cola.js";
import { Venta } from "../models/Venta.js";
import { Mensaje } from "../models/Mensaje.js";
import { Reporte } from "../models/Reporte.js";
import { enviarCorreoAdvertencia } from "../services/emailService.js";

export function iniciarJobRevisionHorarios() {
  cron.schedule("0 8 * * *", async () => {
    try {
      await revisarHorariosDeVendedores();
    } catch (error) {
      console.error("[job] Falló la revisión de horarios:", error);
    }
  });
}

async function revisarHorariosDeVendedores() {
  const hoy = new Date();
  const esPrimerDiaDelMes = hoy.getDate() === 1;

  const usuarios = await Usuario.find({ tipo: "vendedor" });

  for (const usuario of usuarios) {
    const fechaConfirmacion = usuario.horarioConfirmadoEn ?? usuario.createdAt;
    const diasDesdeConfirmacion = Math.floor(
      (hoy.getTime() - fechaConfirmacion.getTime()) / (1000 * 60 * 60 * 24),
    );

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
