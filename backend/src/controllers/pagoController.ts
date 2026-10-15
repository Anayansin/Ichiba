import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Producto } from "../models/producto.js";
import { Usuario } from "../models/usuario.js";
import { Venta } from "../models/Venta.js";
import { VinculoPayPal } from "../models/VinculoPayPal.js";
import {
  crearOrdenPaypal,
  autorizarOrdenPaypal,
  obtenerOrdenPaypal,
} from "../services/paypalService.js";
import {
  crearPreferenciaMercadoPago,
  obtenerPagoMercadoPago,
  pagoAprobado,
} from "../services/mercadopagoService.js";
import { registrarVentaExitosa } from "../services/ventaService.js";
import { enviarCorreoPalabraClaveCompra } from "../services/emailService.js";
import { moderarComprobante } from "../services/visionService.js";
import {
  avisoDeAtencion,
  cargarVenta,
  confirmarComprobanteDeVenta,
  correoDelComprador,
  rechazarComprobanteDeVenta,
  registrarComprobanteDeVenta,
  registrarEntregaDeVenta,
  type UsuarioEscrow,
  type VentaEscrow,
} from "../services/escrowService.js";
import { RequestConComprador } from "../middleware/comprador.js";
import { RequestConUsuario } from "../middleware/auth.js";
import {
  iniciarTemporizadorPago,
  expirarTurnoSiVencido,
} from "../services/filaService.js";
import clientePrisma from "../configuracion/prisma.js";
import {
  campoConPalabrasProhibidas,
  mensajePalabrasProhibidas,
} from "../utils/filtroPalabras.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const carpetaComprobantes = path.join(__dirname, "../../uploads/comprobantes");

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

/** ¿Quién está consultando esta venta: el comprador o el vendedor? */
function identificarRolEnVenta(
  req: Request,
  venta: { compradorId: string; vendedorId: number },
): "comprador" | "vendedor" | null {
  const compradorId = req.headers["x-comprador-id"];
  if (
    typeof compradorId === "string" &&
    compradorId !== "" &&
    compradorId === venta.compradorId
  ) {
    return "comprador";
  }

  const cabeceraAutorizacion = req.headers.authorization;
  if (cabeceraAutorizacion?.startsWith("Bearer ")) {
    try {
      const payload = jwt.verify(
        cabeceraAutorizacion.split(" ")[1],
        process.env.JWT_SECRET as string,
      ) as { id?: number | string; tipo?: string };

      if (
        payload.tipo !== "admin" &&
        Number(payload.id) === Number(venta.vendedorId)
      ) {
        return "vendedor";
      }
    } catch {
      // Token inválido: se responde como acceso denegado.
    }
  }

  return null;
}

/**
 * RQNF20 / RQNF24.1: avisa al comprador su palabra clave de pago y el bloque
 * de atención del vendedor, si dejó correo al entrar a la fila.
 */
async function avisarPalabraClave(
  productoId: string,
  compradorId: string,
  nombreProducto: string,
  codigoPago: string | null,
  vendedor: UsuarioEscrow | null,
): Promise<void> {
  if (!codigoPago) return;
  const correo = await correoDelComprador(productoId, compradorId);
  if (!correo) return;

  try {
    await enviarCorreoPalabraClaveCompra(
      correo,
      nombreProducto,
      codigoPago,
      avisoDeAtencion(vendedor),
    );
  } catch (error) {
    console.error(
      "[pago] No se pudo enviar la palabra clave por correo:",
      error instanceof Error ? error.message : error,
    );
  }
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

    // RQNF24.1: antes de pagar se advierte que la atención será únicamente
    // dentro del bloque de horario de atención vigente del vendedor.
    const avisoAtencion = avisoDeAtencion(vendedor as UsuarioEscrow);

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
        avisoAtencion,
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

    // RQNF4: si el vendedor vinculó su cuenta por OAuth 2.0, el pago se
    // dirige a su Merchant ID (token guardado cifrado); si no, al correo.
    const vinculo = await VinculoPayPal.findOne({ usuarioId: vendedor.id })
      .select("merchantId")
      .lean();

    const orden = await crearOrdenPaypal(
      producto.precio,
      paypalEmail,
      productoId,
      vinculo?.merchantId,
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

    res.json({
      metodo: "paypal",
      orderId: orden.id,
      linkAprobacion,
      avisoAtencion,
    });
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

/**
 * RQNF4 (escrow) / RQF21: el comprador vuelve de PayPal y se AUTORIZA el
 * pago: el dinero queda retenido en escrow (no se cobra al vendedor todavía).
 * La venta nace en `pendiente_comprobante` con su palabra clave de 4 dígitos
 * (RQNF20) que se muestra aquí y se envía por correo.
 */
export async function capturarOrden(req: RequestConComprador, res: Response) {
  try {
    const orderId = req.params.orderId as string;
    const compradorId = req.compradorId as string;

    // Idempotencia: si la venta ya se registró (recarga de la página de
    // vuelta), se responde con los mismos datos sin volver a llamar a PayPal.
    const ventaExistente = await clientePrisma.venta.findFirst({
      where: { paypalOrderId: orderId },
    });
    if (ventaExistente) {
      return res.json({
        message: "Pago autorizado",
        ventaId: Number(ventaExistente.id),
        vendedorId: Number(ventaExistente.vendedorId),
        productoId: String(ventaExistente.productoId),
        codigoPago: ventaExistente.codigoPago ?? null,
        estado: ventaExistente.estado,
      });
    }

    let resultado: any;
    try {
      resultado = await autorizarOrdenPaypal(orderId);
    } catch (error) {
      const respuesta = (error as any)?.respuestaPaypal;
      const nombreError = respuesta?.name ?? "";
      const incidencia = respuesta?.details?.[0]?.issue ?? "";

      if (nombreError === "ORDER_ALREADY_AUTHORIZED") {
        // Doble clic o recarga: se consulta la orden, que ya trae su
        // autorización, y se continúa como si fuera la primera vez.
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

    const unidadDeCompra = resultado?.purchase_units?.[0];
    const autorizacion = unidadDeCompra?.payments?.authorizations?.[0];
    const productoId = String(unidadDeCompra?.reference_id ?? "");
    const autorizacionPaypalId = String(autorizacion?.id ?? "");

    if (!autorizacionPaypalId) {
      const detalle =
        resultado?.details?.[0]?.description ?? resultado?.name ?? null;
      return res.status(400).json({
        message: detalle
          ? `El pago no se autorizó correctamente (${detalle})`
          : "El pago no se autorizó correctamente",
      });
    }

    if (String(autorizacion?.status ?? "") !== "CREATED") {
      return res.status(400).json({
        message:
          "La autorización de este pago ya no está activa; crea una orden nueva.",
      });
    }

    const producto = await buscarProducto(productoId);
    if (!producto || typeof productoId !== "string")
      return res.status(404).json({ message: "Producto no encontrado" });

    const vendedorId = Number(producto.vendedorId);
    if (!Number.isInteger(vendedorId)) {
      return res.status(404).json({ message: "Vendedor no encontrado" });
    }

    const monto = Number(autorizacion?.amount?.value) || producto.precio;

    const { nueva, venta } = await registrarVentaExitosa({
      productoId,
      compradorId,
      vendedorId,
      monto,
      referenciaExterna: orderId,
      autorizacionPaypalId,
    });

    const vendedor = await buscarVendedorDeProducto(vendedorId);
    if (nueva) {
      await avisarPalabraClave(
        productoId,
        compradorId,
        producto.nombre,
        venta?.codigoPago ?? null,
        vendedor as UsuarioEscrow | null,
      );
    }

    res.json({
      message: "Pago autorizado",
      ventaId: venta?.id ?? null,
      vendedorId,
      productoId,
      codigoPago: venta?.codigoPago ?? null,
      estado: venta?.estado ?? "pendiente_comprobante",
    });
  } catch (error) {
    console.error("[paypal] Error al autorizar el pago:", error);
    const detalle = error instanceof Error ? error.message : "";
    res.status(500).json({
      message: detalle
        ? `No se pudo confirmar el pago con PayPal: ${detalle}`
        : "Error al autorizar el pago",
    });
  }
}

/**
 * Confirma un pago de MercadoPago una vez que el comprador vuelve del
 * checkout con `?fuente=mercadopago&payment_id=...`.
 *
 * No hay paso de captura: se consulta el pago a MercadoPago (fuente única de
 * verdad, lo que hace la operación idempotente) y, si está aprobado, se
 * registran los mismos efectos que con PayPal. El dinero entra a la cuenta de
 * la plataforma (escrow interno) y se reembolsa por la API si se cancela.
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

    const compradorId = req.compradorId as string;
    const { nueva, venta } = await registrarVentaExitosa({
      productoId,
      compradorId,
      vendedorId,
      monto,
      referenciaExterna: `mp:${paymentId}`,
    });

    if (nueva) {
      const vendedor = await buscarVendedorDeProducto(vendedorId);
      await avisarPalabraClave(
        productoId,
        compradorId,
        producto.nombre,
        venta?.codigoPago ?? null,
        vendedor as UsuarioEscrow | null,
      );
    }

    res.json({
      message: "Pago completado",
      ventaId: venta?.id ?? null,
      vendedorId,
      productoId,
      codigoPago: venta?.codigoPago ?? null,
      estado: venta?.estado ?? "pendiente_comprobante",
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

    const { nueva, venta } = await registrarVentaExitosa({
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
      const vendedor = await buscarVendedorDeProducto(vendedorId);
      await avisarPalabraClave(
        productoId,
        compradorId,
        producto.nombre,
        venta?.codigoPago ?? null,
        vendedor as UsuarioEscrow | null,
      );
    }
  } catch (error) {
    console.error("[mercadopago] Error en el webhook:", error);
  }
}

/**
 * RQF22 / RQNF18 / RQNF24.4: el comprador registra su comprobante (palabra
 * clave + referencia + fotografía). La imagen se moderó antes de guardarse;
 * la venta pasa a `pendiente_confirmacion` y la fila queda en reposo.
 */
export async function registrarComprobante(
  req: RequestConComprador,
  res: Response,
) {
  const archivo = req.file;
  const limpiarArchivo = () => {
    if (archivo) fs.unlink(archivo.path, () => {});
  };

  try {
    const ventaId = Number(req.params.ventaId);
    const compradorId = req.compradorId as string;

    if (!Number.isInteger(ventaId)) {
      limpiarArchivo();
      return res.status(404).json({ message: "Compra no encontrada" });
    }

    const venta = await cargarVenta(ventaId);
    if (!venta) {
      limpiarArchivo();
      return res.status(404).json({ message: "Compra no encontrada" });
    }

    if (venta.compradorId !== compradorId) {
      limpiarArchivo();
      return res
        .status(403)
        .json({ message: "No puedes registrar el comprobante de esta compra" });
    }

    if (!archivo) {
      return res.status(400).json({
        message: "Adjunta la fotografía o captura de pantalla del comprobante",
      });
    }

    // El filtro global de palabras corre antes de Multer, así que aquí se
    // revisa otra vez la referencia escrita.
    const referencia = String(req.body?.referencia ?? "").trim();
    const campoProhibido = campoConPalabrasProhibidas({ referencia });
    if (campoProhibido) {
      limpiarArchivo();
      return res
        .status(400)
        .json({ message: mensajePalabrasProhibidas(campoProhibido) });
    }

    // RQNF18 (de RQF22): moderación de contenido antes de mostrarla.
    const bloqueo = await moderarComprobante(archivo.path);
    if (bloqueo) {
      limpiarArchivo();
      return res.status(400).json({ message: bloqueo });
    }

    const resultado = await registrarComprobanteDeVenta(venta, {
      palabraClave: String(req.body?.palabraClave ?? ""),
      referencia,
      imagen: `/uploads/comprobantes/${archivo.filename}`,
    });

    if (resultado.error) {
      limpiarArchivo();
      return res.status(400).json({ message: resultado.error });
    }

    res.json({
      message:
        "Comprobante recibido. El vendedor lo revisará dentro de su horario de atención.",
      estado: "pendiente_confirmacion",
      confirmacionLimite: resultado.confirmacionLimite ?? null,
    });
  } catch (error) {
    limpiarArchivo();
    console.error("[pago] Error al registrar el comprobante:", error);
    res.status(500).json({ message: "Error al registrar el comprobante" });
  }
}

/** RQF31: el vendedor confirma el comprobante (cierra reposo, abre chat). */
export async function confirmarComprobante(
  req: RequestConUsuario,
  res: Response,
) {
  try {
    const ventaId = Number(req.params.ventaId);
    const vendedorId = Number(req.usuarioId);

    if (!Number.isInteger(ventaId)) {
      return res.status(404).json({ message: "Compra no encontrada" });
    }

    const venta = await cargarVenta(ventaId);
    if (!venta) {
      return res.status(404).json({ message: "Compra no encontrada" });
    }

    const resultado = await confirmarComprobanteDeVenta(venta, vendedorId);
    if (resultado.error) {
      return res.status(400).json({ message: resultado.error });
    }

    res.json({
      message:
        "Comprobante confirmado. El chat de coordinación quedó habilitado y el comprador recibió su código de entrega.",
      estado: "en_entrega",
      entregaLimite: resultado.entregaLimite ?? null,
      ventaId: venta.id,
    });
  } catch (error) {
    console.error("[pago] Error al confirmar el comprobante:", error);
    res.status(500).json({ message: "Error al confirmar el comprobante" });
  }
}

/** RQF31 / RQNF23: el vendedor rechaza el comprobante (se reembolsa). */
export async function rechazarComprobante(
  req: RequestConUsuario,
  res: Response,
) {
  try {
    const ventaId = Number(req.params.ventaId);
    const vendedorId = Number(req.usuarioId);

    if (!Number.isInteger(ventaId)) {
      return res.status(404).json({ message: "Compra no encontrada" });
    }

    const venta = await cargarVenta(ventaId);
    if (!venta) {
      return res.status(404).json({ message: "Compra no encontrada" });
    }

    const resultado = await rechazarComprobanteDeVenta(
      venta,
      vendedorId,
      String(req.body?.motivo ?? ""),
    );
    if (resultado.error) {
      return res.status(400).json({ message: resultado.error });
    }

    res.json({
      message:
        "Comprobante rechazado. Se reembolsó al comprador y el turno pasó al siguiente en la fila.",
      estado: "cancelada",
      ventaId: venta.id,
    });
  } catch (error) {
    console.error("[pago] Error al rechazar el comprobante:", error);
    res.status(500).json({ message: "Error al rechazar el comprobante" });
  }
}

/**
 * RQF33 / RQNF27: el vendedor registra el código de confirmación de entrega
 * que le dio el comprador. Con esto se libera el dinero del escrow y la
 * transacción queda completada (RQNF26 cierra el chat).
 */
export async function registrarEntrega(
  req: RequestConUsuario,
  res: Response,
) {
  try {
    const ventaId = Number(req.params.ventaId);
    const vendedorId = Number(req.usuarioId);

    if (!Number.isInteger(ventaId)) {
      return res.status(404).json({ message: "Compra no encontrada" });
    }

    const venta = await cargarVenta(ventaId);
    if (!venta) {
      return res.status(404).json({ message: "Compra no encontrada" });
    }

    const resultado = await registrarEntregaDeVenta(
      venta,
      vendedorId,
      String(req.body?.codigoEntrega ?? req.body?.codigo ?? ""),
    );
    if (resultado.error) {
      return res.status(400).json({ message: resultado.error });
    }

    res.json({
      message:
        "Entrega confirmada: la transacción quedó completada y los fondos fueron liberados.",
      estado: "completada",
      ventaId: venta.id,
    });
  } catch (error) {
    console.error("[pago] Error al registrar la entrega:", error);
    res.status(500).json({ message: "Error al registrar la entrega" });
  }
}

/**
 * Detalle completo de una compra. Cada parte ve lo que le corresponde: el
 * comprador su palabra clave y su código de entrega; el vendedor las fechas
 * y el comprobante para revisarlo (RQF30), nunca los códigos secretos.
 */
export async function detalleDeVenta(req: Request, res: Response) {
  try {
    const ventaId = Number(req.params.ventaId);
    if (!Number.isInteger(ventaId)) {
      return res.status(404).json({ message: "Compra no encontrada" });
    }

    const venta = await cargarVenta(ventaId);
    if (!venta) {
      return res.status(404).json({ message: "Compra no encontrada" });
    }

    const rol = identificarRolEnVenta(req, venta);
    if (!rol) {
      return res.status(403).json({ message: "No tienes acceso a esta compra" });
    }

    const producto = await buscarProducto(venta.productoId);
    const vendedor = await clientePrisma.usuario.findUnique({
      where: { id: Number(venta.vendedorId) },
    });

    res.json({
      ventaId: venta.id,
      estado: venta.estado,
      rol,
      monto: Number(venta.monto),
      producto: producto
        ? {
            id: String(producto._id),
            nombre: producto.nombre,
            imagenes: producto.imagenes ?? [],
          }
        : null,
      vendedor: vendedor
        ? {
            id: Number(vendedor.id),
            nombreCompleto: vendedor.nombreCompleto,
          }
        : null,
      // RQNF20: solo el comprador conoce la palabra clave.
      codigoPago: rol === "comprador" ? (venta.codigoPago ?? null) : null,
      // RQNF24.4: el código de entrega es del comprador (RQNF26).
      codigoEntrega:
        rol === "comprador" && venta.estado === "en_entrega"
          ? (venta.codigoEntrega ?? null)
          : null,
      comprobante: venta.comprobanteImagen
        ? {
            referencia: venta.comprobanteReferencia ?? null,
            imagen: `/api/pagos/comprobante/${venta.id}/imagen`,
            enviadoEn: venta.comprobanteEnviadoEn ?? null,
          }
        : null,
      fechas: {
        creada: venta.createdAt ?? null,
        comprobanteEnviadoEn: venta.comprobanteEnviadoEn ?? null,
        comprobanteConfirmadoEn: venta.comprobanteConfirmadoEn ?? null,
        confirmacionLimite: venta.confirmacionLimite ?? null,
        entregaLimite: venta.entregaLimite ?? null,
        entregadoEn: venta.entregadoEn ?? null,
        reembolsadoEn: venta.reembolsadoEn ?? null,
      },
      canceladoMotivo: venta.canceladoMotivo ?? null,
      chatHabilitado: venta.estado === "en_entrega",
      retenido: Boolean(venta.retenido),
    });
  } catch (error) {
    console.error("[pago] Error al consultar el detalle de la venta:", error);
    res.status(500).json({ message: "Error al consultar la compra" });
  }
}

/**
 * Sirve la fotografía del comprobante. Nunca se expone como archivo
 * estático: solo la ven las partes de la venta y ya pasó la moderación.
 */
export async function imagenDeComprobante(req: Request, res: Response) {
  try {
    const ventaId = Number(req.params.ventaId);
    if (!Number.isInteger(ventaId)) {
      return res.status(404).json({ message: "Compra no encontrada" });
    }

    const venta = await cargarVenta(ventaId);
    if (!venta || !venta.comprobanteImagen) {
      return res.status(404).json({ message: "Comprobante no encontrado" });
    }

    const rol = identificarRolEnVenta(req, venta);
    if (!rol) {
      return res.status(403).json({ message: "No tienes acceso a esta compra" });
    }

    const nombreArchivo = path.basename(venta.comprobanteImagen);
    const rutaAbsoluta = path.join(carpetaComprobantes, nombreArchivo);

    if (!fs.existsSync(rutaAbsoluta)) {
      return res.status(404).json({ message: "Comprobante no encontrado" });
    }

    res.sendFile(rutaAbsoluta);
  } catch (error) {
    console.error("[pago] Error al servir el comprobante:", error);
    res.status(500).json({ message: "Error al obtener el comprobante" });
  }
}

/**
 * RQF30 / RQF32 / RQF33: ventas del vendedor para su panel: comprobantes por
 * revisar, entregas en curso e historial.
 */
export async function ventasDelVendedor(
  req: RequestConUsuario,
  res: Response,
) {
  try {
    const vendedorId = Number(req.usuarioId);
    const filtro =
      typeof req.query.estado === "string" ? req.query.estado : null;

    const ventas = (await clientePrisma.venta.findMany({
      where: { vendedorId },
      orderBy: { id: "desc" },
    })) as VentaEscrow[];

    const visibles = filtro
      ? ventas.filter((venta) => venta.estado === filtro)
      : ventas;

    const idsProducto = [
      ...new Set(
        visibles
          .map((venta) => String(venta.productoId))
          .filter((id) => /^[0-9a-fA-F]{24}$/.test(id)),
      ),
    ];
    const productos = idsProducto.length
      ? await Producto.find({ _id: { $in: idsProducto } }).select(
          "nombre imagenes",
        )
      : [];
    const mapaProductos = new Map(
      productos.map((producto) => [String(producto._id), producto]),
    );

    res.json({
      resumen: {
        porRevisar: ventas.filter(
          (venta) => venta.estado === "pendiente_confirmacion",
        ).length,
        enEntrega: ventas.filter((venta) => venta.estado === "en_entrega")
          .length,
        completadas: ventas.filter((venta) => venta.estado === "completada")
          .length,
      },
      ventas: visibles.map((venta) => {
        const producto = mapaProductos.get(String(venta.productoId));
        return {
          ventaId: Number(venta.id),
          estado: venta.estado,
          monto: Number(venta.monto),
          producto: producto
            ? { nombre: producto.nombre, imagenes: producto.imagenes ?? [] }
            : null,
          compradorId: venta.compradorId,
          comprobante:
            venta.comprobanteImagen &&
            (venta.estado === "pendiente_confirmacion" ||
              venta.estado === "en_entrega" ||
              venta.estado === "completada")
              ? {
                  referencia: venta.comprobanteReferencia ?? null,
                  imagen: `/api/pagos/comprobante/${venta.id}/imagen`,
                  enviadoEn: venta.comprobanteEnviadoEn ?? null,
                }
              : null,
          fechas: {
            creada: venta.createdAt ?? null,
            comprobanteEnviadoEn: venta.comprobanteEnviadoEn ?? null,
            confirmacionLimite: venta.confirmacionLimite ?? null,
            comprobanteConfirmadoEn: venta.comprobanteConfirmadoEn ?? null,
            entregaLimite: venta.entregaLimite ?? null,
            entregadoEn: venta.entregadoEn ?? null,
          },
          canceladoMotivo: venta.canceladoMotivo ?? null,
        };
      }),
    });
  } catch (error) {
    console.error("[pago] Error al listar las ventas del vendedor:", error);
    res.status(500).json({ message: "Error al consultar tus ventas" });
  }
}

/**
 * Seguimiento de compras del comprador: estado del escrow, palabra clave,
 * código de entrega y si el chat está habilitado.
 */
export async function misComprasDelComprador(
  req: RequestConComprador,
  res: Response,
) {
  try {
    const compradorId = req.compradorId as string;

    const ventas = (await clientePrisma.venta.findMany({
      where: { compradorId },
      orderBy: { id: "desc" },
    })) as VentaEscrow[];

    const idsProducto = [
      ...new Set(
        ventas
          .map((venta) => String(venta.productoId))
          .filter((id) => /^[0-9a-fA-F]{24}$/.test(id)),
      ),
    ];
    const productos = idsProducto.length
      ? await Producto.find({ _id: { $in: idsProducto } }).select(
          "nombre imagenes",
        )
      : [];
    const mapaProductos = new Map(
      productos.map((producto) => [String(producto._id), producto]),
    );

    const espejos = ventas.length
      ? await Venta.find({
          paypalOrderId: { $in: ventas.map((venta) => venta.paypalOrderId) },
        }).select("_id paypalOrderId")
      : [];
    const mapaEspejos = new Map(
      espejos.map((espejo) => [String(espejo.paypalOrderId), String(espejo._id)]),
    );

    res.json({
      compras: ventas.map((venta) => {
        const producto = mapaProductos.get(String(venta.productoId));
        return {
          ventaId: Number(venta.id),
          ventaMongoId: mapaEspejos.get(String(venta.paypalOrderId)) ?? null,
          estado: venta.estado,
          monto: Number(venta.monto),
          producto: producto
            ? { nombre: producto.nombre, imagenes: producto.imagenes ?? [] }
            : null,
          codigoPago: venta.codigoPago ?? null,
          codigoEntrega:
            venta.estado === "en_entrega"
              ? (venta.codigoEntrega ?? null)
              : null,
          comprobanteEnviadoEn: venta.comprobanteEnviadoEn ?? null,
          confirmacionLimite: venta.confirmacionLimite ?? null,
          entregaLimite: venta.entregaLimite ?? null,
          entregadoEn: venta.entregadoEn ?? null,
          canceladoMotivo: venta.canceladoMotivo ?? null,
          chatHabilitado: venta.estado === "en_entrega",
          calificacionComprador: venta.calificacionComprador ?? null,
        };
      }),
    });
  } catch (error) {
    console.error("[pago] Error al listar las compras del comprador:", error);
    res.status(500).json({ message: "Error al consultar tus compras" });
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

    // RQF27: la calificación se hace después de confirmada la entrega.
    if (venta.estado !== "completada") {
      return res.status(400).json({
        message:
          "Solo puedes calificar cuando la entrega esté confirmada (transacción completada)",
      });
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
