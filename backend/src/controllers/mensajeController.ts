import { Response, Request } from "express";
import fs from "fs";
import { Mensaje } from "../models/Mensaje.js";
import { Venta } from "../models/Venta.js";
import { RequestConComprador } from "../middleware/comprador.js";
import { RequestConUsuario } from "../middleware/auth.js";
import { registrarActividadDeChat } from "../services/escrowService.js";
import {
  campoConPalabrasProhibidas,
  mensajePalabrasProhibidas,
} from "../utils/filtroPalabras.js";

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

/**
 * RQNF24.2 / RQNF26 / RQNF29: el chat de coordinación solo está habilitado
 * cuando el vendedor ya confirmó el comprobante (`en_entrega`). Antes está
 * bloqueado esperando la revisión; después de completada o cancelada queda
 * deshabilitado. Devuelve el mensaje para el usuario, o null si puede
 * escribir.
 */
function motivoChatBloqueado(venta: {
  estado?: string | null;
}): string | null {
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

/** Elimina la imagen subida cuando el mensaje no se va a guardar. */
function descartarImagen(req: Request) {
  if (req.file) fs.unlink(req.file.path, () => {});
}

/**
 * Valida el texto y la imagen adjunta del mensaje entrante.
 * El filtro global de palabras corre antes de que Multer arme el cuerpo
 * multipart, así que aquí se vuelve a revisar el contenido.
 */
function datosDelMensaje(req: Request): {
  contenido: string;
  imagen: string;
  error?: string;
} {
  const contenido =
    typeof req.body?.contenido === "string" ? req.body.contenido.trim() : "";
  const imagen = req.file ? `/uploads/${req.file.filename}` : "";

  const rechazar = (mensaje: string) => {
    descartarImagen(req);
    return { contenido: "", imagen: "", error: mensaje };
  };

  if (!contenido && !imagen)
    return rechazar("Escribe un mensaje o adjunta una imagen");

  const campoProhibido = campoConPalabrasProhibidas({ contenido });
  if (campoProhibido)
    return rechazar(mensajePalabrasProhibidas(campoProhibido));

  return { contenido, imagen };
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
      return res.status(403).json({ message: "No tienes acceso a este chat" });

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
      descartarImagen(req);
      return res.status(403).json({ message: "No tienes acceso a este chat" });
    }

    // RQNF24.2 / RQNF26 / RQNF29: el chat solo se escribe tras confirmar el
    // comprobante.
    const bloqueo = motivoChatBloqueado(venta);
    if (bloqueo) {
      descartarImagen(req);
      return res.status(403).json({ message: bloqueo });
    }

    const { contenido, imagen, error } = datosDelMensaje(req);
    if (error) return res.status(400).json({ message: error });

    const mensaje = new Mensaje({
      ventaId,
      remitente: "comprador",
      remitenteId: compradorId,
      contenido,
      imagen: imagen || null,
    });
    await mensaje.save();

    // RQNF31: la inactividad del chat se cuenta desde el último mensaje.
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
      return res.status(403).json({ message: "No tienes acceso a este chat" });

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
      descartarImagen(req);
      return res.status(403).json({ message: "No tienes acceso a este chat" });
    }

    // RQNF24.2 / RQNF26 / RQNF29: el chat solo se escribe tras confirmar el
    // comprobante.
    const bloqueo = motivoChatBloqueado(venta);
    if (bloqueo) {
      descartarImagen(req);
      return res.status(403).json({ message: bloqueo });
    }

    const { contenido, imagen, error } = datosDelMensaje(req);
    if (error) return res.status(400).json({ message: error });

    const mensaje = new Mensaje({
      ventaId,
      remitente: "vendedor",
      remitenteId: vendedorId,
      contenido,
      imagen: imagen || null,
    });
    await mensaje.save();

    // RQNF31: la inactividad del chat se cuenta desde el último mensaje.
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
    // Seguridad: se eligen solo los campos que el chat necesita. El
    // comprador conserva sus códigos (palabra clave y entrega), pero nada
    // más del escrow.
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
          // RQNF24.4: el código de entrega solo se muestra en la etapa de
          // entrega; antes aún no existe para el comprador.
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
    // Seguridad: el vendedor nunca recibe los códigos secretos del comprador
    // (palabra clave del pago ni código de confirmación de entrega). Él los
    // captura a mano cuando el comprador se los da en persona.
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
