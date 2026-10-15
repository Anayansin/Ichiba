import { Producto } from "../models/producto.js";
import { Venta } from "../models/Venta.js";
import clientePrisma from "../configuracion/prisma.js";
import { generarCodigoPagoUnico } from "./escrowService.js";

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
 *
 * RQNF4: la venta nace en el ciclo del escrow como `pendiente_comprobante`
 * con su palabra clave de 4 dígitos (RQNF20). El dinero queda retenido en la
 * pasarela hasta que se registre el código de entrega (RQNF27) y se devuelve
 * si la venta se cancela (RQNF23/24/28/31).
 */
export type DatosVentaConfirmada = {
  productoId: string;
  compradorId: string;
  vendedorId: number;
  monto: number;
  referenciaExterna: string;
  /** RQNF4: id de la autorización de PayPal (captura diferida). */
  autorizacionPaypalId?: string | null;
};

export type ResultadoVentaConfirmada = {
  nueva: boolean;
  venta: {
    id: number;
    codigoPago: string | null;
    estado: string;
    productoId: string;
    vendedorId: number;
    monto: number;
  } | null;
};

export async function registrarVentaExitosa(
  datos: DatosVentaConfirmada,
): Promise<ResultadoVentaConfirmada> {
  const {
    productoId,
    compradorId,
    vendedorId,
    monto,
    referenciaExterna,
    autorizacionPaypalId = null,
  } = datos;

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

    // RQNF20: clave de 4 dígitos única para esta sesión de pago del producto.
    const codigoPago = await generarCodigoPagoUnico(productoId);

    await clientePrisma.venta.create({
      data: {
        productoId,
        vendedorId,
        compradorId,
        monto,
        paypalOrderId: referenciaExterna,
        estado: "pendiente_comprobante",
        codigoPago,
        autorizacionPaypalId,
      },
    });
  }

  const ventaPg =
    ventaYaRegistrada ??
    (await clientePrisma.venta.findFirst({
      where: { paypalOrderId: referenciaExterna },
    }));

  // Espejo en MongoDB: el chat del vendedor, la calificación, los reportes y
  // el historial de administración leen la colección `Venta`.
  await Venta.updateOne(
    { paypalOrderId: referenciaExterna },
    {
      $set: {
        productoId,
        vendedorId: String(vendedorId),
        compradorId,
        monto,
        estado: String(ventaPg?.estado ?? "pendiente_comprobante"),
        ...(ventaPg ? { ventaIdPg: Number(ventaPg.id) } : {}),
        ...(ventaPg?.codigoPago ? { codigoPago: ventaPg.codigoPago } : {}),
      },
    },
    { upsert: true },
  );

  return {
    nueva: !ventaYaRegistrada,
    venta: ventaPg
      ? {
          id: Number(ventaPg.id),
          codigoPago: (ventaPg.codigoPago as string | null) ?? null,
          estado: String(ventaPg.estado),
          productoId: String(ventaPg.productoId),
          vendedorId: Number(ventaPg.vendedorId),
          monto: Number(ventaPg.monto),
        }
      : null,
  };
}
