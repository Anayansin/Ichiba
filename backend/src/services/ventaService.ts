import { Producto } from "../models/producto.js";
import { Venta } from "../models/Venta.js";
import clientePrisma from "../configuracion/prisma.js";

/**
 * Efectos de una venta confirmada, compartidos por todas las pasarelas.
 *
 * Está pensado para ser idempotente: si el comprador recarga la página de
 * vuelta o el webhook llega dos veces, no se descuenta dos veces el producto
 * ni se incrementan dos veces las ventas del vendedor.
 *
 * `referenciaExterna` es el identificador del pago en la pasarela y actúa
 * como clave de idempotencia. Por convención:
 *   - PayPal  -> id de la orden, p. ej. `8XJ12345AB678901C`
 *   - MercadoPago -> `mp:<payment_id>`, p. ej. `mp:1234567890`
 * El prefijo `mp:` evita que los numéricos de MercadoPago puedan chocar con
 * las órdenes de PayPal en la misma columna.
 */
export type DatosVentaConfirmada = {
  productoId: string;
  compradorId: string;
  vendedorId: number;
  monto: number;
  referenciaExterna: string;
};

export async function registrarVentaExitosa(
  datos: DatosVentaConfirmada,
): Promise<{ nueva: boolean }> {
  const { productoId, compradorId, vendedorId, monto, referenciaExterna } =
    datos;

  const ventaYaRegistrada = await clientePrisma.venta.findFirst({
    where: { paypalOrderId: referenciaExterna },
  });

  if (!ventaYaRegistrada) {
    // El producto deja de estar a la venta en el mismo momento en que se
    // confirma el pago.
    await Producto.updateOne({ _id: productoId }, { activo: false });

    // La fila del comprador pasa a "pagada" y el resto de la fila queda
    // "esperando_confirmacion" (coincide con el reparto de turnos).
    await clientePrisma.cola.updateMany({
      where: { productoId, compradorId, estado: "activa" },
      data: { estado: "pagada" },
    });

    await clientePrisma.cola.updateMany({
      where: { productoId, estado: "activa" },
      data: { estado: "esperando_confirmacion" },
    });

    await clientePrisma.usuario.update({
      where: { id: vendedorId },
      data: { ventasExitosas: { increment: 1 } },
    });

    await clientePrisma.venta.create({
      data: {
        productoId,
        vendedorId,
        compradorId,
        monto,
        paypalOrderId: referenciaExterna,
      },
    });
  }

  // Espejo en MongoDB: el chat del vendedor, la calificación, los reportes y
  // el historial de administración leen la colección `Venta`.
  await Venta.updateOne(
    { paypalOrderId: referenciaExterna },
    {
      productoId,
      vendedorId: String(vendedorId),
      compradorId,
      monto,
      estado: "completada",
    },
    { upsert: true },
  );

  return { nueva: !ventaYaRegistrada };
}
