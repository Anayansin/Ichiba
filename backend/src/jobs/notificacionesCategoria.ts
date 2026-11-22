import { Producto } from "../models/producto.js";
import { SuscripcionCategoria } from "../models/SuscripcionCategoria.js";
import { CATEGORIAS_NOTIFICACION } from "../models/Suscripcion.js";
import { enviarCorreoNovedadesCategoria } from "../services/emailService.js";

export async function enviarNovedadesDeCategorias(desde: Date): Promise<void> {
  for (const categoria of CATEGORIAS_NOTIFICACION) {
    const productosNuevos = await Producto.find({
      categoria: new RegExp(`^${categoria}$`, "i"),
      activo: true,
      createdAt: { $gte: desde },
    }).sort({ createdAt: 1 });

    if (productosNuevos.length === 0) continue;

    const suscriptores = await SuscripcionCategoria.find({ categoria });
    for (const suscriptor of suscriptores) {
      try {
        await enviarCorreoNovedadesCategoria(
          suscriptor.correo,
          categoria,
          productosNuevos,
        );
      } catch (error) {
        console.error("[notificaciones] No se pudo enviar el correo:", error);
      }
    }
  }
}
