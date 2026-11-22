import { Response, Request } from "express";
import { Mensaje } from "../models/Mensaje.js";
import { Venta } from "../models/Venta.js";
import { RequestConComprador } from "../middleware/comprador.js";
import { RequestConUsuario } from "../middleware/auth.js";
import { registrarActividadDeChat } from "../services/escrowService.js";
import { campoConPalabrasProhibidas } from "../utils/filtroPalabras.js";

const MENSAJE_CHAT_AJENO =
  "No puedes acceder a este chat porque esta venta no pertenece a tu cuenta";

async function validarAccesoComprador(ventaId: string, compradorId: string) {
  const venta = await Venta.findById(ventaId);
  if (!venta) return null;
  if (venta.compradorId !== compradorId) return null;
  return venta;
}

async function validarAccesoVendedor(ventaId: string, vendedorId: string) {
  const venta = await Venta.findById(ventaId);
  if (!venta) return null;
  if (String(venta.vendedorId) !== String(vendedorId)) return null;
  return venta;
}

function motivoChatBloqueado(venta: {
  estado?: string | null;
  propuestaEntrega?: { estado?: string | null } | null;
}): string | null {
  if (venta.estado === "en_entrega" && venta.propuestaEntrega?.estado === "pendiente") {
    return "El chat está en pausa hasta que el comprador acepte o rechace la propuesta de entrega.";
  }
  switch (venta.estado) {
    case "en_entrega":
      return null;
    case "pendiente_comprobante":
      return "El chat de coordinación se abrirá cuando el vendedor confirme tu pago y tu comprobante (RQNF29).";
    case "pendiente_confirmacion":
      return "El chat está bloqueado hasta que el vendedor revise y confirme tu comprobante de pago (RQNF24.2).";
    case "completada":
      return "La transacción ya concluyó: el chat de coordinación quedó deshabilitado (RQNF26).";
    case "reembolsada":
    case "cancelada":
      return "Esta compra fue cancelada y reembolsada: el chat quedó deshabilitado (RQNF26).";
    default:
      return "El chat de esta compra no está disponible.";
  }
}

async function datosDelMensaje(req: Request): Promise<{
  contenido: string;
  imagen: string;
  error?: string;
}> {
  const contenido =
    typeof req.body?.contenido === "string" ? req.body.contenido.trim() : "";

  if (!contenido) return { contenido: "", imagen: "", error: "Escribe un mensaje" };

  if (campoConPalabrasProhibidas({ contenido })) {
    return {
      contenido: "",
      imagen: "",
      error:
        "Tu mensaje no fue enviado porque contiene contenido no permitido. Corrígelo e inténtalo de nuevo.",
    };
  }

  return { contenido, imagen: "" };
}

export async function fetchMensajesComoComprador(
  req: RequestConComprador,
  res: Response,
) {
  try {
    const ventaId = req.params.ventaId as string;
    const compradorId = req.compradorId as string;

    const venta = await validarAccesoComprador(ventaId, compradorId);
    if (!venta)
      return res.status(403).json({ message: MENSAJE_CHAT_AJENO });

    const mensajes = await Mensaje.find({ ventaId }).sort({ createdAt: 1 });
    res.json(mensajes);
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al obtener los mensajes" });
  }
}

export async function enviarMensajeComoComprador(
  req: RequestConComprador,
  res: Response,
) {
  try {
    const ventaId = req.params.ventaId as string;
    const compradorId = req.compradorId as string;

    const venta = await validarAccesoComprador(ventaId, compradorId);
    if (!venta) {

      return res.status(403).json({ message: MENSAJE_CHAT_AJENO });
    }

    const bloqueo = motivoChatBloqueado(venta);
    if (bloqueo) {

      return res.status(403).json({ message: bloqueo });
    }

    const { contenido, imagen, error } = await datosDelMensaje(req);
    if (error) return res.status(400).json({ message: error });

    const mensaje = new Mensaje({
      ventaId,
      remitente: "comprador",
      remitenteId: compradorId,
      contenido,
      imagen: imagen || null,
    });
    await mensaje.save();

    await registrarActividadDeChat({
      productoId: String(venta.productoId),
      compradorId: venta.compradorId,
    });

    res.status(201).json(mensaje);
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al enviar el mensaje" });
  }
}

export async function fetchMensajesComoVendedor(
  req: RequestConUsuario,
  res: Response,
) {
  try {
    const ventaId = req.params.ventaId as string;
    const vendedorId = req.usuarioId as string;

    const venta = await validarAccesoVendedor(ventaId, vendedorId);
    if (!venta)
      return res.status(403).json({ message: MENSAJE_CHAT_AJENO });

    const mensajes = await Mensaje.find({ ventaId }).sort({ createdAt: 1 });
    res.json(mensajes);
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al obtener los mensajes" });
  }
}

export async function enviarMensajeComoVendedor(
  req: RequestConUsuario,
  res: Response,
) {
  try {
    const ventaId = req.params.ventaId as string;
    const vendedorId = req.usuarioId as string;

    const venta = await validarAccesoVendedor(ventaId, vendedorId);
    if (!venta) {

      return res.status(403).json({ message: MENSAJE_CHAT_AJENO });
    }

    const bloqueo = motivoChatBloqueado(venta);
    if (bloqueo) {

      return res.status(403).json({ message: bloqueo });
    }

    const { contenido, imagen, error } = await datosDelMensaje(req);
    if (error) return res.status(400).json({ message: error });

    const mensaje = new Mensaje({
      ventaId,
      remitente: "vendedor",
      remitenteId: vendedorId,
      contenido,
      imagen: imagen || null,
    });
    await mensaje.save();

    await registrarActividadDeChat({
      productoId: String(venta.productoId),
      compradorId: venta.compradorId,
    });

    res.status(201).json(mensaje);
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al enviar el mensaje" });
  }
}

export async function fetchMisVentasComoComprador(
  req: RequestConComprador,
  res: Response,
) {
  try {
    const compradorId = req.compradorId as string;
    const ventas = await Venta.find({ compradorId })
      .select(
        "productoId monto createdAt estado codigoPago codigoEntrega canceladoMotivo entregaLimite ventaIdPg calificacionComprador",
      )
      .populate("productoId", "nombre imagenes")
      .sort({ createdAt: -1 });

    res.json(
      ventas.map((venta) => {
        const datos = venta.toObject();
        return {
          ...datos,
          codigoEntrega:
            venta.estado === "en_entrega"
              ? (venta.codigoEntrega ?? null)
              : null,
        };
      }),
    );
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al obtener tus compras" });
  }
}

export async function fetchMisVentasComoVendedor(
  req: RequestConUsuario,
  res: Response,
) {
  try {
    const vendedorId = req.usuarioId as string;
    const ventas = await Venta.find({ vendedorId })
      .select(
        "productoId monto createdAt estado canceladoMotivo entregaLimite ventaIdPg calificacionVendedor",
      )
      .populate("productoId", "nombre imagenes")
      .sort({ createdAt: -1 });
    res.json(ventas);
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al obtener tus ventas" });
  }
}
