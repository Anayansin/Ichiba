import { Producto } from "../models/producto.js";
import { Venta } from "../models/Venta.js";
import clientePrisma from "../configuracion/prisma.js";
import {
  generarCodigoEntregaUnico,
  generarCodigoPagoUnico,
} from "./escrowService.js";
import { publicarResumenAdmin } from "../graphql/suscripciones.js";

export type DatosVentaConfirmada = {
  productoId: string;
  compradorId: string;
  vendedorId: number;
  monto: number;
  referenciaExterna: string;
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
    await Producto.updateOne({ _id: productoId }, { activo: false });

    const producto = await Producto.findById(productoId).select(
      "nombre categoria",
    );

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

    const codigoPago = await generarCodigoPagoUnico();
    const codigoEntrega = await generarCodigoEntregaUnico();

    await clientePrisma.venta.create({
      data: {
        productoId,
        vendedorId,
        compradorId,
        monto,
        paypalOrderId: referenciaExterna,
        estado: "pendiente_comprobante",
        codigoPago,
        codigoEntrega,
        autorizacionPaypalId,
        productoCategoria: producto?.categoria ?? null,
        productoNombre: producto?.nombre ?? null,
      },
    });
  }

  const ventaPg =
    ventaYaRegistrada ??
    (await clientePrisma.venta.findFirst({
      where: { paypalOrderId: referenciaExterna },
    }));

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

  publicarResumenAdmin();

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
