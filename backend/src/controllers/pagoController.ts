import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { Producto } from "../models/producto.js";
import { Usuario } from "../models/usuario.js";
import { Cola } from "../models/Cola.js";
import { Venta } from "../models/Venta.js";
import {
  crearOrdenPaypal,
  capturarOrdenPaypal,
  obtenerOrdenPaypal,
} from "../services/paypalService.js";
import {
  crearPreferenciaMercadoPago,
  obtenerPagoMercadoPago,
  pagoAprobado,
} from "../services/mercadopagoService.js";
import { registrarVentaExitosa } from "../services/ventaService.js";
import { RequestConComprador } from "../middleware/comprador.js";
import {
  iniciarTemporizadorPago,
  expirarTurnoSiVencido,
} from "../services/filaService.js";
import clientePrisma from "../configuracion/prisma.js";

async function buscarProducto(productoId: unknown) {
  if (typeof productoId !== "string" || !/^[0-9a-fA-F]{24}$/.test(productoId))
    return null;
  return Producto.findById(productoId);
}

async function buscarVendedorDeProducto(vendedorId: unknown) {
  const idNumerico = Number(vendedorId);
  if (!Number.isInteger(idNumerico)) return null;
  return clientePrisma.usuario.findUnique({ where: { id: idNumerico } });
}

/**
 * Método de pago elegido por el vendedor al registrarse.
 *
 * Vive en MongoDB: en PostgreSQL solo se guarda la cuenta de cobro dentro de
 * `paypalEmail`, así que hay que mirar ahí para decidir con qué pasarela
 * cobrar. Si Mongo no responde se cae a PayPal, que es lo que siempre hizo
 * esta tienda.
 */
async function metodoDePagoDelVendedor(
  correo: string,
): Promise<"paypal" | "mercadopago"> {
  try {
    const espejo = (await Usuario.findOne({ correo })
      .select("metodoPago")
      .lean()) as { metodoPago?: string } | null;

    return espejo?.metodoPago === "mercadopago"
      ? "mercadopago"
      : "paypal";
  } catch (error) {
    console.error(
      "[mongo] No se pudo leer el método de pago del vendedor:",
      (error as { message?: string })?.message ?? error,
    );
    return "paypal";
  }
}

type IdentidadQueCalifica = { tipo: "usuario" | "comprador"; id: string };

function identificarQuienCalifica(req: Request): IdentidadQueCalifica | null {
  const cabeceraAutorizacion = req.headers.authorization;

  if (cabeceraAutorizacion) {
    try {
      const payload = jwt.verify(
        cabeceraAutorizacion.split(" ")[1],
        process.env.JWT_SECRET as string,
      ) as { id: string };
      return { tipo: "usuario", id: String(payload.id) };
    } catch {
      return null;
    }
  }

  const compradorIdCabecera = req.headers["x-comprador-id"];
  if (typeof compradorIdCabecera === "string" && compradorIdCabecera !== "") {
    return { tipo: "comprador", id: compradorIdCabecera };
  }

  return null;
}

export async function crearOrden(req: RequestConComprador, res: Response) {
  try {
    const { productoId } = req.body;
    const compradorId = req.compradorId as string;

    const miFila = await clientePrisma.cola.findFirst({
      where: {
        productoId,
        compradorId,
        estado: "activa",
      },
    });

    if (!miFila || miFila.posicion !== 1) {
      return res
        .status(403)
        .json({ message: "No es tu turno para pagar todavía" });
    }

    if (!miFila.pagoExpiraEn) {
      await iniciarTemporizadorPago(miFila);
      await clientePrisma.cola.update({
        where: { id: miFila.id },
        data: { pagoExpiraEn: miFila.pagoExpiraEn },
      });
    } else if (await expirarTurnoSiVencido(miFila)) {
      return res.status(403).json({
        message: "Se agotó tu tiempo para pagar y perdiste tu turno en la fila",
      });
    }

    const producto = await buscarProducto(productoId);
    if (!producto)
      return res.status(404).json({ message: "Producto no encontrado" });

    const vendedor = await buscarVendedorDeProducto(producto.vendedorId);
    if (!vendedor)
      return res.status(404).json({ message: "Vendedor no encontrado" });

    const metodo = await metodoDePagoDelVendedor(vendedor.correo);

    if (metodo === "mercadopago") {
      // Checkout Pro: MercadoPago devuelve `init_point`, la página donde el
      // comprador paga. Usamos el mismo campo `linkAprobacion` que PayPal
      // para que el frontend no tenga que distinguir pasarelas.
      const preferencia = await crearPreferenciaMercadoPago({
        productoId,
        compradorId,
        titulo: producto.nombre,
        descripcion: producto.descripcion,
        precio: producto.precio,
        imagen: producto.imagenes?.[0] ?? null,
      });

      const linkAprobacion = preferencia?.init_point as string | undefined;

      if (!preferencia?.id || !linkAprobacion) {
        console.error(
          "[mercadopago] Preferencia creada sin enlace de pago:",
          preferencia,
        );
        return res.status(500).json({
          message:
            "MercadoPago no devolvió el enlace de pago. Intenta de nuevo.",
        });
      }

      return res.json({
        metodo: "mercadopago",
        preferenceId: preferencia.id,
        linkAprobacion,
      });
    }

    const paypalEmail = (vendedor as { paypalEmail?: string | null })
      .paypalEmail;
    if (!paypalEmail) {
      return res.status(400).json({
        message:
          "El vendedor aún no tiene configurado su correo de PayPal. Inténtalo más tarde.",
      });
    }

    const orden = await crearOrdenPaypal(
      producto.precio,
      paypalEmail,
      productoId,
    );

    const linkAprobacion = orden.links?.find(
      (l: any) => l.rel === "approve",
    )?.href;

    if (!orden.id || !linkAprobacion) {
      console.error("[paypal] Orden creada sin enlace de aprobación:", orden);
      return res.status(500).json({
        message: "PayPal no devolvió el enlace de pago. Intenta de nuevo.",
      });
    }

    res.json({ metodo: "paypal", orderId: orden.id, linkAprobacion });
  } catch (error) {
    console.error("[pago] Error al crear la orden:", error);
    const detalle = error instanceof Error ? error.message : "";
    res.status(500).json({
      message: detalle
        ? `No se pudo iniciar el pago: ${detalle}`
        : "Error al crear la orden de pago",
    });
  }
}

export async function capturarOrden(req: RequestConComprador, res: Response) {
  try {
    const orderId = req.params.orderId as string;
    const compradorId = req.compradorId as string;

    let resultado: any;
    try {
      resultado = await capturarOrdenPaypal(orderId);
    } catch (error) {
      // PayPal responde 422 ORDER_ALREADY_CAPTURED cuando la página se
      // recarga o la captura se intenta dos veces: en ese caso consultamos
      // la orden y, si ya está COMPLETED, seguimos como si fuera la primera.
      const respuesta = (error as any)?.respuestaPaypal;
      const nombreError = respuesta?.name;
      const incidencia = respuesta?.details?.[0]?.issue ?? "";

      if (nombreError === "ORDER_ALREADY_CAPTURED") {
        resultado = await obtenerOrdenPaypal(orderId);
      } else if (
        incidencia === "PAYER_NOT_APPROVED" ||
        incidencia === "ORDER_NOT_APPROVED" ||
        incidencia === "INSTRUMENT_DECLINED" ||
        nombreError === "ORDER_NOT_APPROVED"
      ) {
        // El comprador aún no termina el pago en PayPal (o lo canceló):
        // no es un error del servidor, se reintenta desde el frontend.
        return res.status(400).json({
          message:
            incidencia === "INSTRUMENT_DECLINED"
              ? "PayPal rechazó el método de pago elegido, prueba con otro"
              : "El pago aún no se ha aprobado en PayPal, completa el pago antes de confirmar",
        });
      } else {
        throw error;
      }
    }

    if (!resultado || resultado.status !== "COMPLETED") {
      const detalle =
        resultado?.details?.[0]?.description ?? resultado?.name ?? null;
      return res.status(400).json({
        message: detalle
          ? `El pago no se completó correctamente (${detalle})`
          : "El pago no se completó correctamente",
      });
    }

    const unidadDeCompra = resultado.purchase_units?.[0];
    const productoId = unidadDeCompra?.reference_id;
    const monto = Number(
      unidadDeCompra?.payments?.captures?.[0]?.amount?.value ??
        unidadDeCompra?.amount?.value,
    );

    const producto = await buscarProducto(productoId);
    if (!producto || typeof productoId !== "string")
      return res.status(404).json({ message: "Producto no encontrado" });

    const vendedorId = Number(producto.vendedorId);
    if (!Number.isInteger(vendedorId)) {
      return res.status(404).json({ message: "Vendedor no encontrado" });
    }

    // Idempotente: en una recarga no se repiten los efectos del pago, pero
    // se responde 200 igual.
    await registrarVentaExitosa({
      productoId,
      compradorId,
      vendedorId,
      monto,
      referenciaExterna: orderId,
    });

    res.json({
      message: "Pago completado",
      vendedorId,
      productoId,
    });
  } catch (error) {
    console.error("[paypal] Error al capturar el pago:", error);
    const detalle = error instanceof Error ? error.message : "";
    res.status(500).json({
      message: detalle
        ? `No se pudo confirmar el pago con PayPal: ${detalle}`
        : "Error al capturar el pago",
    });
  }
}

/**
 * Confirma un pago de MercadoPago una vez que el comprador vuelve del
 * checkout con `?fuente=mercadopago&payment_id=...`.
 *
 * No hay paso de captura: se consulta el pago a MercadoPago (fuente única de
 * verdad, lo que hace la operación idempotente) y, si está aprobado, se
 * registran los mismos efectos que con PayPal.
 */
export async function confirmarMercadoPago(
  req: RequestConComprador,
  res: Response,
) {
  try {
    const paymentId = String(
      req.body?.paymentId ?? req.body?.payment_id ?? "",
    ).trim();

    if (!paymentId) {
      return res.status(400).json({
        message: "No llegó el identificador del pago de MercadoPago",
      });
    }

    const pago = await obtenerPagoMercadoPago(paymentId);

    // La referencia que guardamos al crear la preferencia es `mp:<productoId>`.
    const referenciaExterna = String(pago?.external_reference ?? "");
    const productoId = referenciaExterna.startsWith("mp:")
      ? referenciaExterna.slice(3)
      : "";

    if (!/^[0-9a-fA-F]{24}$/.test(productoId)) {
      return res.status(400).json({
        message: "El pago de MercadoPago no trae un producto reconocible",
      });
    }

    if (!pagoAprobado(pago)) {
      const estado = String(pago?.status ?? "");
      const detalle = String(pago?.status_detail ?? "");
      return res.status(400).json({
        message:
          estado === "pending"
            ? "El pago está pendiente de acreditación, te avisaremos cuando se confirme"
            : estado === "rejected"
              ? `MercadoPago rechazó el pago${detalle ? ` (${detalle})` : ""}`
              : "El pago aún no se ha aprobado, completa el pago antes de confirmar",
      });
    }

    const producto = await buscarProducto(productoId);
    if (!producto)
      return res.status(404).json({ message: "Producto no encontrado" });

    const vendedorId = Number(producto.vendedorId);
    if (!Number.isInteger(vendedorId)) {
      return res.status(404).json({ message: "Vendedor no encontrado" });
    }

    // El importe lo fija MercadoPago según la preferencia que creamos en el
    // servidor; si no coincide con el precio actual es porque el vendedor lo
    // editó mientras el comprador pagaba. Se registra lo realmente cobrado
    // (el dinero ya se movió) y se deja constancia.
    const monto = Number(pago.transaction_amount);
    if (Math.abs(monto - producto.precio) > 0.01) {
      console.warn(
        `[mercadopago] Cobro ${monto} distinto al precio actual ${producto.precio} del producto ${productoId}`,
      );
    }

    await registrarVentaExitosa({
      productoId,
      compradorId: req.compradorId as string,
      vendedorId,
      monto,
      referenciaExterna: `mp:${paymentId}`,
    });

    res.json({
      message: "Pago completado",
      vendedorId,
      productoId,
    });
  } catch (error) {
    console.error("[mercadopago] Error al confirmar el pago:", error);
    const detalle = error instanceof Error ? error.message : "";
    res.status(500).json({
      message: detalle
        ? `No se pudo confirmar el pago con MercadoPago: ${detalle}`
        : "Error al confirmar el pago",
    });
  }
}

/**
 * Webhook (IPN) de MercadoPago: avisa de cambios de estado aunque el
 * comprador cierre el navegador antes de volver del checkout.
 *
 * Es público a propósito y responde 200 de inmediato (MercadoPago reintenta
 * si no recibe 200). La única fuente de verdad sigue siendo la consulta a la
 * API: aquí nunca se confía en lo que llega por el cuerpo del aviso, solo se
 * usa para saber qué pago reconsultar, así que un aviso falsificado no puede
 * registrar ventas.
 */
export async function webhookMercadoPago(req: Request, res: Response) {
  res.sendStatus(200);

  try {
    const cuerpo = (req.body ?? {}) as {
      type?: string;
      data?: { id?: string | number };
    };

    if (cuerpo.type !== "payment" || !cuerpo.data?.id) return;

    const paymentId = String(cuerpo.data.id);
    const pago = await obtenerPagoMercadoPago(paymentId);

    if (!pagoAprobado(pago)) return;

    const referenciaExterna = String(pago?.external_reference ?? "");
    const productoId = referenciaExterna.startsWith("mp:")
      ? referenciaExterna.slice(3)
      : "";
    if (!/^[0-9a-fA-F]{24}$/.test(productoId)) return;

    const metadata = (pago?.metadata ?? {}) as Record<string, unknown>;
    const compradorId = String(metadata.compradorId ?? "");
    if (!compradorId) {
      console.warn(
        `[mercadopago] Webhook sin compradorId para el pago ${paymentId}`,
      );
      return;
    }

    const producto = await buscarProducto(productoId);
    if (!producto) return;

    const vendedorId = Number(producto.vendedorId);
    if (!Number.isInteger(vendedorId)) return;

    const { nueva } = await registrarVentaExitosa({
      productoId,
      compradorId,
      vendedorId,
      monto: Number(pago.transaction_amount),
      referenciaExterna: `mp:${paymentId}`,
    });

    if (nueva) {
      console.log(
        `[mercadopago] Venta registrada por webhook: producto ${productoId}`,
      );
    }
  } catch (error) {
    console.error("[mercadopago] Error en el webhook:", error);
  }
}

export async function calificar(req: Request, res: Response) {
  try {
    const ventaId = req.params.ventaId as string;
    const cuerpo = req.body ?? {};
    const quienCalifica = cuerpo.quienCalifica;
    const puntuacion = cuerpo.puntuacion ?? cuerpo.calificacion;

    if (quienCalifica !== "comprador" && quienCalifica !== "vendedor") {
      return res
        .status(400)
        .json({ message: "Indica quién califica: comprador o vendedor" });
    }

    if (!Number.isInteger(puntuacion) || puntuacion < 1 || puntuacion > 5) {
      return res
        .status(400)
        .json({ message: "La calificación debe ser un número de 1 a 5" });
    }

    if (!/^[0-9a-fA-F]{24}$/.test(ventaId)) {
      return res.status(404).json({ message: "Compra no encontrada" });
    }

    const venta = await Venta.findById(ventaId);
    if (!venta) {
      return res.status(404).json({ message: "Compra no encontrada" });
    }

    const personaQueCalifica = identificarQuienCalifica(req);
    if (!personaQueCalifica) {
      return res
        .status(401)
        .json({ message: "Identifícate para calificar esta compra" });
    }

    const esElCompradorDeLaVenta =
      quienCalifica === "comprador" &&
      personaQueCalifica.tipo === "comprador" &&
      personaQueCalifica.id === venta.compradorId;

    const esElVendedorDeLaVenta =
      quienCalifica === "vendedor" &&
      personaQueCalifica.tipo === "usuario" &&
      personaQueCalifica.id === String(venta.vendedorId);

    if (!esElCompradorDeLaVenta && !esElVendedorDeLaVenta) {
      return res
        .status(403)
        .json({ message: "No puedes calificar esta compra" });
    }

    const calificacionActual =
      quienCalifica === "comprador"
        ? venta.calificacionComprador
        : venta.calificacionVendedor;

    if (typeof calificacionActual === "number") {
      return res.status(400).json({ message: "Ya calificaste esta compra" });
    }

    if (quienCalifica === "comprador") {
      venta.calificacionComprador = puntuacion;
    } else {
      venta.calificacionVendedor = puntuacion;
    }

    await venta.save();

    res.json({
      message: "Calificación registrada",
      calificacionComprador: venta.calificacionComprador ?? null,
      calificacionVendedor: venta.calificacionVendedor ?? null,
    });
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al calificar la compra" });
  }
}
