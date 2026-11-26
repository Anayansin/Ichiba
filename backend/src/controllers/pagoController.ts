import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import {
  carpetaComprobantes,
  carpetaDisputas,
} from "../configuracion/almacenamiento.js";
import { enviarArchivoGuardado } from "../configuracion/archivosPersistentes.js";
import { Producto } from "../models/producto.js";
import { Venta } from "../models/Venta.js";
import { Disputa } from "../models/Disputa.js";
import { VinculoPayPal } from "../models/VinculoPayPal.js";
import {
  crearOrdenPaypal,
  autorizarOrdenPaypal,
  obtenerOrdenPaypal,
  obtenerCapturaPaypal,
  verificarFirmaWebhookPaypal,
} from "../services/paypalService.js";

type EstadoFondos = "retenido" | "en_proceso" | "liberado" | "reembolsado" | "cancelado";

async function estadoDeFondos(venta: {
  estado: string;
  capturaPaypalId?: string | null;
}): Promise<EstadoFondos> {
  if (venta.estado === "reembolsada") return "reembolsado";
  if (venta.estado === "cancelada") return "cancelado";
  if (venta.estado !== "completada") return "retenido";
  if (!venta.capturaPaypalId) return "en_proceso";
  try {
    const captura = await obtenerCapturaPaypal(venta.capturaPaypalId);
    return captura?.status === "COMPLETED" ? "liberado" : "en_proceso";
  } catch (error) {
    console.error(
      "[pago] No se pudo consultar la captura en PayPal:",
      error instanceof Error ? error.message : error,
    );
    return "en_proceso";
  }
}
import { registrarVentaExitosa } from "../services/ventaService.js";
import { validarDimensionesProducto } from "../services/imagenProductoService.js";
import { enviarCorreoPalabraClaveCompra } from "../services/emailService.js";
import {
  mensajeDeVerificacionComprobante,
  moderarComprobante,
  verificarComprobanteConTexto,
} from "../services/visionService.js";
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
  crearDisputa,
  listarDisputasDeComprador,
  listarDisputasDeVendedor,
  responderDisputa,
} from "../services/disputaService.js";
import { ErrorBackoffice } from "../services/errorBackoffice.js";
import {
  iniciarTemporizadorPago,
  expirarTurnoSiVencido,
} from "../services/filaService.js";
import clientePrisma from "../configuracion/prisma.js";
import { calcularReputacionVendedor } from "../services/reputacionService.js";
import { comisionDeVenta } from "../services/comisionService.js";
import {
  PUNTOS_CANCELACION,
  purgarCuentaSiCorresponde,
} from "../services/cancelacionCuentaService.js";
import {
  campoConPalabrasProhibidas,
  mensajePalabrasProhibidas,
} from "../utils/filtroPalabras.js";

const ESTADOS_CON_CODIGO_ENTREGA = [
  "pendiente_comprobante",
  "pendiente_confirmacion",
  "en_entrega",
];

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

async function purgarCuentaSiYaNoTieneEntregas(vendedorId: number) {
  try {
    await purgarCuentaSiCorresponde(vendedorId);
  } catch (error) {
    console.error(
      "[cancelacion] No se pudo purgar la cuenta tras resolver la entrega:",
      error instanceof Error ? error.message : error,
    );
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
    }
  }

  return null;
}

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

async function asegurarTurnoDePago(
  productoId: string,
  compradorId: string,
): Promise<string | null> {
  const miFila = await clientePrisma.cola.findFirst({
    where: {
      productoId,
      compradorId,
      estado: "activa",
    },
  });

  if (!miFila || miFila.posicion !== 1) {
    return "No es tu turno para pagar todavía";
  }

  if (!miFila.pagoExpiraEn) {
    await iniciarTemporizadorPago(miFila);
    await clientePrisma.cola.update({
      where: { id: miFila.id },
      data: { pagoExpiraEn: miFila.pagoExpiraEn },
    });
  } else if (await expirarTurnoSiVencido(miFila)) {
    return "Se agotó tu tiempo para pagar y perdiste tu turno en la fila";
  }

  return null;
}

export async function crearOrden(req: RequestConComprador, res: Response) {
  try {
    const { productoId } = req.body;
    const compradorId = req.compradorId as string;

    const problemaDeTurno = await asegurarTurnoDePago(productoId, compradorId);
    if (problemaDeTurno) {
      return res.status(403).json({ message: problemaDeTurno });
    }

    const producto = await buscarProducto(productoId);
    if (!producto)
      return res.status(404).json({ message: "Producto no encontrado" });

    const vendedor = await buscarVendedorDeProducto(producto.vendedorId);
    if (!vendedor)
      return res.status(404).json({ message: "Vendedor no encontrado" });

    const avisoAtencion = avisoDeAtencion(vendedor as UsuarioEscrow);

    const paypalEmail = (vendedor as { paypalEmail?: string | null })
      .paypalEmail;
    if (!paypalEmail) {
      return res.status(400).json({
        message:
          "El vendedor aún no tiene configurado su correo de PayPal. Inténtalo más tarde.",
      });
    }

    const vinculo = await VinculoPayPal.findOne({ usuarioId: vendedor.id })
      .select("merchantId correoPayPal")
      .lean();

    const orden = await crearOrdenPaypal(
      producto.precio,
      vinculo?.correoPayPal ?? paypalEmail,
      productoId,
      vinculo?.merchantId,
      compradorId,
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

type ResultadoAutorizacion =
  | { ok: true; datos: Record<string, unknown> }
  | { ok: false; estado: number; message: string };

async function autorizarYRegistrarOrden(
  orderId: string,
  compradorId: string,
): Promise<ResultadoAutorizacion> {
  const ventaExistente = await clientePrisma.venta.findFirst({
    where: { paypalOrderId: orderId },
  });
  if (ventaExistente) {
    return {
      ok: true,
      datos: {
        message: "Pago autorizado",
        ventaId: Number(ventaExistente.id),
        vendedorId: Number(ventaExistente.vendedorId),
        productoId: String(ventaExistente.productoId),
        codigoPago: ventaExistente.codigoPago ?? null,
        estado: ventaExistente.estado,
      },
    };
  }

  let resultado: any;
  try {
    resultado = await autorizarOrdenPaypal(orderId);
  } catch (error) {
    const respuesta = (error as any)?.respuestaPaypal;
    const nombreError = respuesta?.name ?? "";
    const incidencia = respuesta?.details?.[0]?.issue ?? "";

    if (nombreError === "ORDER_ALREADY_AUTHORIZED") {
      resultado = await obtenerOrdenPaypal(orderId);
    } else if (
      incidencia === "PAYER_NOT_APPROVED" ||
      incidencia === "ORDER_NOT_APPROVED" ||
      incidencia === "INSTRUMENT_DECLINED" ||
      nombreError === "ORDER_NOT_APPROVED"
    ) {
      return {
        ok: false,
        estado: 400,
        message:
          incidencia === "INSTRUMENT_DECLINED"
            ? "PayPal rechazó el método de pago elegido, prueba con otro"
            : "El pago aún no se ha aprobado en PayPal, completa el pago antes de confirmar",
      };
    } else {
      throw error;
    }
  }

  const unidadDeCompra = resultado?.purchase_units?.[0];
  const autorizacion = unidadDeCompra?.payments?.authorizations?.[0];
  const productoId = String(unidadDeCompra?.reference_id ?? "");
  const autorizacionPaypalId = String(autorizacion?.id ?? "");
  const compradorFinal = String(unidadDeCompra?.custom_id || compradorId || "");

  if (!autorizacionPaypalId) {
    const detalle =
      resultado?.details?.[0]?.description ?? resultado?.name ?? null;
    return {
      ok: false,
      estado: 400,
      message: detalle
        ? `El pago no se autorizó correctamente (${detalle})`
        : "El pago no se autorizó correctamente",
    };
  }

  if (String(autorizacion?.status ?? "") !== "CREATED") {
    return {
      ok: false,
      estado: 400,
      message:
        "La autorización de este pago ya no está activa; crea una orden nueva.",
    };
  }

  if (!compradorFinal) {
    return { ok: false, estado: 400, message: "Falta identificador de comprador" };
  }

  const producto = await buscarProducto(productoId);
  if (!producto) {
    return { ok: false, estado: 404, message: "Producto no encontrado" };
  }

  const vendedorId = Number(producto.vendedorId);
  if (!Number.isInteger(vendedorId)) {
    return { ok: false, estado: 404, message: "Vendedor no encontrado" };
  }

  const monto = Number(autorizacion?.amount?.value) || producto.precio;

  const { nueva, venta } = await registrarVentaExitosa({
    productoId,
    compradorId: compradorFinal,
    vendedorId,
    monto,
    referenciaExterna: orderId,
    autorizacionPaypalId,
  });

  const vendedor = await buscarVendedorDeProducto(vendedorId);
  if (nueva) {
    await avisarPalabraClave(
      productoId,
      compradorFinal,
      producto.nombre,
      venta?.codigoPago ?? null,
      vendedor as UsuarioEscrow | null,
    );
  }

  return {
    ok: true,
    datos: {
      message: "Pago autorizado",
      ventaId: venta?.id ?? null,
      vendedorId,
      productoId,
      codigoPago: venta?.codigoPago ?? null,
      estado: venta?.estado ?? "pendiente_comprobante",
    },
  };
}

export async function capturarOrden(req: RequestConComprador, res: Response) {
  try {
    const resultado = await autorizarYRegistrarOrden(
      req.params.orderId as string,
      req.compradorId as string,
    );
    if (!resultado.ok) {
      return res.status(resultado.estado).json({ message: resultado.message });
    }
    res.json(resultado.datos);
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

export async function webhookPaypal(req: Request, res: Response) {
  try {
    const evento = req.body ?? {};
    const valido = await verificarFirmaWebhookPaypal(req.headers, evento);
    if (!valido) {
      return res.status(400).json({ message: "Firma del webhook no válida" });
    }

    if (evento.event_type === "CHECKOUT.ORDER.APPROVED") {
      const orden = evento.resource ?? {};
      const compradorId = String(orden.purchase_units?.[0]?.custom_id ?? "");
      if (orden.id && compradorId) {
        const resultado = await autorizarYRegistrarOrden(String(orden.id), compradorId);
        if (!resultado.ok) {
          console.warn(`[paypal] Webhook sin registrar la orden ${orden.id}: ${resultado.message}`);
        }
      }
    }

    res.json({ recibido: true });
  } catch (error) {
    console.error("[paypal] Error en el webhook:", error);
    res.status(500).json({ message: "Error al procesar el webhook" });
  }
}

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
        .json({
          message:
            "Solo el comprador de esta compra puede registrar el comprobante",
        });
    }

    if (!archivo) {
      return res.status(400).json({
        message: "Adjunta la fotografía o captura de pantalla del comprobante",
      });
    }

    const referencia = String(req.body?.referencia ?? "").trim();
    const campoProhibido = campoConPalabrasProhibidas({ referencia });
    if (campoProhibido) {
      limpiarArchivo();
      return res
        .status(400)
        .json({ message: mensajePalabrasProhibidas(campoProhibido) });
    }

    const palabraClave = String(req.body?.palabraClave ?? "").trim();
    if (!/^\d{4}$/.test(palabraClave)) {
      limpiarArchivo();
      return res
        .status(400)
        .json({ message: "Ingresa la palabra clave de 4 dígitos de tu compra" });
    }
    if (!/^\d{6,8}$/.test(referencia)) {
      limpiarArchivo();
      return res.status(400).json({
        message:
          "El número de referencia debe ser numérico y tener entre 6 y 8 dígitos",
      });
    }
    if (!(await validarDimensionesProducto(archivo.path))) {
      limpiarArchivo();
      return res.status(400).json({
        message:
          "La imagen del comprobante debe medir entre 420x540 y 2560x2560 píxeles",
      });
    }

    const bloqueo = await moderarComprobante(archivo.path);
    if (bloqueo) {
      limpiarArchivo();
      return res.status(400).json({ message: bloqueo });
    }

    const verificacion = await verificarComprobanteConTexto(archivo.path, {
      referencia,
      monto: Number(venta.monto ?? 0),
    });
    if (!verificacion.verificado) {
      limpiarArchivo();
      return res.status(400).json({
        message: mensajeDeVerificacionComprobante(verificacion.motivo ?? "error"),
      });
    }

    const resultado = await registrarComprobanteDeVenta(venta, {
      palabraClave,
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

    await purgarCuentaSiYaNoTieneEntregas(vendedorId);

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

    await purgarCuentaSiYaNoTieneEntregas(vendedorId);

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
      return res.status(403).json({
        message: "No puedes acceder a esta compra porque no participas en ella",
      });
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
      ...(rol === "vendedor"
        ? { comision: comisionDeVenta(Number(venta.monto), venta.estado) }
        : {}),
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
      codigoPago: rol === "comprador" ? (venta.codigoPago ?? null) : null,
      codigoEntrega:
        rol === "comprador" && ESTADOS_CON_CODIGO_ENTREGA.includes(venta.estado)
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
      return res.status(403).json({
        message: "No puedes acceder a esta compra porque no participas en ella",
      });
    }

    const nombreArchivo = path.basename(venta.comprobanteImagen);
    const rutaAbsoluta = path.join(carpetaComprobantes, nombreArchivo);

    if (!(await enviarArchivoGuardado(res, [rutaAbsoluta]))) {
      return res.status(404).json({ message: "Comprobante no encontrado" });
    }
  } catch (error) {
    console.error("[pago] Error al servir el comprobante:", error);
    res.status(500).json({ message: "Error al obtener el comprobante" });
  }
}

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

    const cuenta = await clientePrisma.usuario.findUnique({
      where: { id: vendedorId },
      select: { estadoCuenta: true, puntosReputacion: true },
    });
    const reputacion = await calcularReputacionVendedor(vendedorId);

    const comisiones = ventas.reduce(
      (acumulado, venta) => {
        const desglose = comisionDeVenta(Number(venta.monto), venta.estado);
        if (desglose.cobrada) {
          acumulado.cobradas += desglose.total;
          acumulado.netoRecibido += desglose.netoVendedor;
        } else if (!desglose.reembolsada) {
          acumulado.porCobrar += desglose.total;
          acumulado.netoPorRecibir += desglose.netoVendedor;
        }
        return acumulado;
      },
      {
        cobradas: 0,
        porCobrar: 0,
        netoRecibido: 0,
        netoPorRecibir: 0,
      },
    );

    res.json({
      cuenta: {
        estadoCuenta: cuenta?.estadoCuenta ?? "activa",
        puntosReputacion: Number(cuenta?.puntosReputacion ?? 0),
        puntosCancelacion: PUNTOS_CANCELACION,
      },
      reputacion,
      resumen: {
        porRevisar: ventas.filter(
          (venta) => venta.estado === "pendiente_confirmacion",
        ).length,
        enEntrega: ventas.filter((venta) => venta.estado === "en_entrega")
          .length,
        completadas: ventas.filter((venta) => venta.estado === "completada")
          .length,
        comisiones: {
          cobradas: Number(comisiones.cobradas.toFixed(2)),
          porCobrar: Number(comisiones.porCobrar.toFixed(2)),
          netoRecibido: Number(comisiones.netoRecibido.toFixed(2)),
          netoPorRecibir: Number(comisiones.netoPorRecibir.toFixed(2)),
        },
      },
      ventas: await Promise.all(visibles.map(async (venta) => {
        const producto = mapaProductos.get(String(venta.productoId));
        return {
          ventaId: Number(venta.id),
          estado: venta.estado,
          estadoFondos: await estadoDeFondos(venta),
          monto: Number(venta.monto),
          comision: comisionDeVenta(Number(venta.monto), venta.estado),
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
      })),
    });
  } catch (error) {
    console.error("[pago] Error al listar las ventas del vendedor:", error);
    res.status(500).json({ message: "Error al consultar tus ventas" });
  }
}

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
          creada: venta.createdAt ?? null,
          producto: producto
            ? { nombre: producto.nombre, imagenes: producto.imagenes ?? [] }
            : null,
          codigoPago: venta.codigoPago ?? null,
          codigoEntrega:
            ESTADOS_CON_CODIGO_ENTREGA.includes(venta.estado)
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
        .json({
          message:
            "Solo el comprador o el vendedor de esta compra pueden calificarla",
        });
    }

    if (esElVendedorDeLaVenta) {
      const vendedor = await clientePrisma.usuario.findUnique({
        where: { id: Number(venta.vendedorId) },
        select: { estadoCuenta: true },
      });
      if (vendedor?.estadoCuenta === "cancelada") {
        return res.status(403).json({
          message:
            "Tu cuenta fue cancelada de forma permanente: solo puedes completar las entregas cuyo pago ya está confirmado",
        });
      }
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

function archivosDeDisputa(req: Request): Express.Multer.File[] {
  return (req.files as Express.Multer.File[] | undefined) ?? [];
}

function limpiarArchivosDeDisputa(archivos: Express.Multer.File[]) {
  for (const archivo of archivos) {
    fs.unlink(archivo.path, () => {});
  }
}

function rutasDeEvidencias(archivos: Express.Multer.File[]): string[] {
  return archivos.map((archivo) => `/uploads/disputas/${archivo.filename}`);
}

export async function abrirDisputa(req: RequestConComprador, res: Response) {
  const archivos = archivosDeDisputa(req);

  try {
    const compradorId = req.compradorId as string;
    const ventaId = Number(req.params.ventaId);

    const motivo = String(req.body?.motivo ?? "").trim();
    const descripcion = String(req.body?.descripcion ?? "").trim();

    const campoProhibido = campoConPalabrasProhibidas({ motivo, descripcion });
    if (campoProhibido) {
      limpiarArchivosDeDisputa(archivos);
      return res
        .status(400)
        .json({ message: mensajePalabrasProhibidas(campoProhibido) });
    }

    const resultado = await crearDisputa({
      compradorId,
      ventaId,
      motivo,
      descripcion,
      evidencias: rutasDeEvidencias(archivos),
    });

    res.status(201).json(resultado);
  } catch (error) {
    limpiarArchivosDeDisputa(archivos);

    if (error instanceof ErrorBackoffice) {
      return res.status(error.estado).json({ message: error.message });
    }

    console.error("[disputas] Error al abrir la disputa:", error);
    res.status(500).json({ message: "Error al abrir la disputa" });
  }
}

export async function responderDisputaDeVenta(
  req: RequestConUsuario,
  res: Response,
) {
  const archivos = archivosDeDisputa(req);

  try {
    const vendedorId = Number(req.usuarioId);
    const respuesta = String(req.body?.respuesta ?? "").trim();

    const campoProhibido = campoConPalabrasProhibidas({ respuesta });
    if (campoProhibido) {
      limpiarArchivosDeDisputa(archivos);
      return res
        .status(400)
        .json({ message: mensajePalabrasProhibidas(campoProhibido) });
    }

    const resultado = await responderDisputa({
      vendedorId,
      disputaId: req.params.disputaId,
      respuesta,
      evidencias: rutasDeEvidencias(archivos),
    });

    res.json(resultado);
  } catch (error) {
    limpiarArchivosDeDisputa(archivos);

    if (error instanceof ErrorBackoffice) {
      return res.status(error.estado).json({ message: error.message });
    }

    console.error("[disputas] Error al responder la disputa:", error);
    res.status(500).json({ message: "Error al responder la disputa" });
  }
}

export async function misDisputasDelComprador(
  req: RequestConComprador,
  res: Response,
) {
  try {
    const compradorId = req.compradorId as string;
    res.json({ disputas: await listarDisputasDeComprador(compradorId) });
  } catch (error) {
    console.error("[disputas] Error al listar las disputas del comprador:", error);
    res.status(500).json({ message: "Error al consultar tus disputas" });
  }
}

export async function disputasDelVendedor(
  req: RequestConUsuario,
  res: Response,
) {
  try {
    const vendedorId = Number(req.usuarioId);
    res.json({ disputas: await listarDisputasDeVendedor(vendedorId) });
  } catch (error) {
    console.error("[disputas] Error al listar las disputas del vendedor:", error);
    res.status(500).json({ message: "Error al consultar tus disputas" });
  }
}

export async function imagenEvidenciaDisputa(req: Request, res: Response) {
  try {
    const disputaId = String(req.params.disputaId ?? "");
    if (!/^[0-9a-fA-F]{24}$/.test(disputaId)) {
      return res.status(404).json({ message: "Evidencia no encontrada" });
    }

    const disputa = (await Disputa.findById(disputaId).lean()) as {
      compradorId?: string;
      vendedorId?: number;
      evidenciasComprador?: string[];
      evidenciasVendedor?: string[];
    } | null;
    if (!disputa) {
      return res.status(404).json({ message: "Disputa no encontrada" });
    }

    const lado = String(req.params.lado ?? "");
    if (lado !== "comprador" && lado !== "vendedor") {
      return res.status(404).json({ message: "Evidencia no encontrada" });
    }

    let autorizado = false;

    const compradorIdCabecera = req.headers["x-comprador-id"];
    if (
      typeof compradorIdCabecera === "string" &&
      compradorIdCabecera !== "" &&
      compradorIdCabecera === String(disputa.compradorId)
    ) {
      autorizado = true;
    }

    if (!autorizado) {
      const cabecera = req.headers.authorization;
      if (cabecera?.startsWith("Bearer ")) {
        try {
          const payload = jwt.verify(
            cabecera.split(" ")[1],
            process.env.JWT_SECRET as string,
          ) as { id?: number | string; tipo?: string };

          if (payload.tipo === "admin") {
            autorizado = true;
          } else if (Number(payload.id) === Number(disputa.vendedorId)) {
            autorizado = true;
          }
        } catch {
        }
      }
    }

    if (!autorizado) {
      return res
        .status(403)
        .json({
          message:
            "No puedes ver esta evidencia porque solo el comprador, el vendedor o un administrador de esta disputa pueden consultarla",
        });
    }

    const rutas =
      lado === "comprador"
        ? disputa.evidenciasComprador
        : disputa.evidenciasVendedor;
    const indice = Number(req.params.indice);
    const ruta = Array.isArray(rutas) ? rutas[indice] : undefined;

    if (!ruta) {
      return res.status(404).json({ message: "Evidencia no encontrada" });
    }

    const rutaAbsoluta = path.join(carpetaDisputas, path.basename(String(ruta)));
    if (!(await enviarArchivoGuardado(res, [rutaAbsoluta]))) {
      return res.status(404).json({ message: "Evidencia no encontrada" });
    }
  } catch (error) {
    console.error("[disputas] Error al servir la evidencia:", error);
    res.status(500).json({ message: "Error al obtener la evidencia" });
  }
}
