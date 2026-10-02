import cron from "node-cron";
import { Producto } from "../models/producto.js";
import { SuscripcionCategoria } from "../models/SuscripcionCategoria.js";
import { CATEGORIAS_NOTIFICACION } from "../models/Suscripcion.js";
import { enviarCorreoNovedadesCategoria } from "../services/emailService.js";

const HORAS_CORRIDA = [10, 17];

export function fechaUltimaCorrida(ahora: Date): Date {
  const fecha = new Date(ahora);
  const horaActual = ahora.getHours();
  const esCorridaDeLaTarde =
    horaActual >= HORAS_CORRIDA[HORAS_CORRIDA.length - 1];

  if (esCorridaDeLaTarde) {
    fecha.setHours(HORAS_CORRIDA[0], 0, 0, 0);
    return fecha;
  }

  fecha.setDate(fecha.getDate() - 1);
  fecha.setHours(HORAS_CORRIDA[HORAS_CORRIDA.length - 1], 0, 0, 0);
  return fecha;
}

export function iniciarJobNotificacionesCategoria() {
  cron.schedule("0 10,17 * * *", async () => {
    try {
      const fechaCorridaAnterior = fechaUltimaCorrida(new Date());

      for (const categoria of CATEGORIAS_NOTIFICACION) {
        const productosNuevos = await Producto.find({
          categoria,
          activo: true,
          createdAt: { $gte: fechaCorridaAnterior },
        }).sort({ createdAt: 1 });

        if (productosNuevos.length === 0) continue;

        const suscriptores = await SuscripcionCategoria.find({ categoria });
        if (suscriptores.length === 0) continue;

        for (const suscriptor of suscriptores) {
          try {
            await enviarCorreoNovedadesCategoria(
              suscriptor.correo,
              categoria,
              productosNuevos,
            );
          } catch (error) {
            console.error("Error real:", error);
          }
        }
      }
    } catch (error) {
      console.error("Error real:", error);
    }
  });
}
