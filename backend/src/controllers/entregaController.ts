import { Response } from "express";
import { Venta } from "../models/Venta.js";
import { Producto } from "../models/producto.js";
import { Mensaje } from "../models/Mensaje.js";
import { RequestConComprador } from "../middleware/comprador.js";
import { RequestConUsuario } from "../middleware/auth.js";
import { campoConPalabrasProhibidas, mensajePalabrasProhibidas } from "../utils/filtroPalabras.js";

type Rol = "comprador" | "vendedor";

const MENSAJE_AJENO =
  "No puedes acceder a esta entrega porque la compra no pertenece a tu cuenta";

function esObjectId(valor: unknown): valor is string {
  return typeof valor === "string" && /^[0-9a-fA-F]{24}$/.test(valor);
}

function minutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

async function cargarVentaParaRol(
  ventaId: unknown,
  rol: Rol,
  identidad: string,
) {
  if (!esObjectId(ventaId)) return null;
  const venta = await Venta.findById(ventaId);
  if (!venta) return null;
  if (rol === "comprador" && venta.compradorId !== identidad) return null;
  if (rol === "vendedor" && String(venta.vendedorId) !== String(identidad)) {
    return null;
  }
  return venta;
}

async function productoDeVenta(venta: { productoId: unknown }) {
  return Producto.findById(venta.productoId).select(
    "nombre metodoEntrega horarioEntregaInicio horarioEntregaFin",
  );
}

function esEntregaCoordinada(metodo: unknown): boolean {
  return metodo === "tienda" || metodo === "punto-encuentro";
}

function respuestaDeEntrega(venta: any, producto: any, rol: Rol) {
  return {
    estadoVenta: venta.estado,
    metodoEntrega: producto?.metodoEntrega ?? null,
    horarioEntregaInicio: producto?.horarioEntregaInicio ?? null,
    horarioEntregaFin: producto?.horarioEntregaFin ?? null,
    propuesta: venta.propuestaEntrega?.estado ? venta.propuestaEntrega : null,
    propuestasRechazadas: venta.propuestasRechazadas ?? [],
    direccion: venta.direccionEntrega?.registradaEn
      ? venta.direccionEntrega
      : null,
    envio: venta.datosEnvio?.registradoEn ? venta.datosEnvio : null,
    rol,
  };
}

async function avisoEnChat(
  venta: { _id: unknown; compradorId: string; vendedorId: unknown },
  texto: string,
  remitente: Rol,
) {
  try {
    await Mensaje.create({
      ventaId: venta._id as never,
      remitente,
      remitenteId:
        remitente === "comprador" ? venta.compradorId : String(venta.vendedorId),
      contenido: texto,
    });
  } catch (error) {
    console.error(
      "[entrega] No se pudo dejar el aviso en el chat:",
      error instanceof Error ? error.message : error,
    );
  }
}

export async function entregaComoComprador(
  req: RequestConComprador,
  res: Response,
) {
  try {
    const venta = await cargarVentaParaRol(
      req.params.ventaId,
      "comprador",
      req.compradorId as string,
    );
    if (!venta) return res.status(403).json({ message: MENSAJE_AJENO });
    const producto = await productoDeVenta(venta);
    res.json(respuestaDeEntrega(venta, producto, "comprador"));
  } catch (error) {
    console.error("[entrega] Error al consultar la entrega:", error);
    res.status(500).json({ message: "Error al consultar la entrega" });
  }
}

export async function entregaComoVendedor(
  req: RequestConUsuario,
  res: Response,
) {
  try {
    const venta = await cargarVentaParaRol(
      req.params.ventaId,
      "vendedor",
      String(req.usuarioId),
    );
    if (!venta) return res.status(403).json({ message: MENSAJE_AJENO });
    const producto = await productoDeVenta(venta);
    res.json(respuestaDeEntrega(venta, producto, "vendedor"));
  } catch (error) {
    console.error("[entrega] Error al consultar la entrega:", error);
    res.status(500).json({ message: "Error al consultar la entrega" });
  }
}

export async function registrarPropuesta(
  req: RequestConUsuario,
  res: Response,
) {
  try {
    const venta = await cargarVentaParaRol(
      req.params.ventaId,
      "vendedor",
      String(req.usuarioId),
    );
    if (!venta) return res.status(403).json({ message: MENSAJE_AJENO });

    if (venta.estado !== "en_entrega") {
      return res.status(400).json({
        message:
          "Solo puedes proponer la entrega cuando el pago y el comprobante ya están confirmados",
      });
    }

    const producto = await productoDeVenta(venta);
    if (!esEntregaCoordinada(producto?.metodoEntrega)) {
      return res.status(400).json({
        message:
          "La propuesta de entrega solo aplica a punto de encuentro o entrega en tienda",
      });
    }

    if (venta.propuestaEntrega?.estado === "pendiente") {
      return res.status(400).json({
        message: "Ya enviaste una propuesta; espera la respuesta del comprador",
      });
    }
    if (venta.propuestaEntrega?.estado === "aceptada") {
      return res
        .status(400)
        .json({ message: "El comprador ya aceptó la propuesta de entrega" });
    }

    const lugar = String(req.body?.lugar ?? "").trim();
    const fecha = String(req.body?.fecha ?? "").trim();
    const hora = String(req.body?.hora ?? "").trim();

    if (!lugar || !fecha || !hora) {
      return res
        .status(400)
        .json({ message: "Completa el lugar, la fecha y la hora de entrega" });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) {
      return res
        .status(400)
        .json({ message: "La fecha o la hora de entrega no son válidas" });
    }

    const campoProhibido = campoConPalabrasProhibidas({ lugar });
    if (campoProhibido) {
      return res
        .status(400)
        .json({ message: mensajePalabrasProhibidas(campoProhibido) });
    }

    const inicio = producto?.horarioEntregaInicio;
    const fin = producto?.horarioEntregaFin;
    if (inicio && fin && (minutos(hora) < minutos(inicio) || minutos(hora) > minutos(fin))) {
      return res.status(400).json({
        message: `La hora de entrega debe estar dentro del horario de coordinación de la publicación (${inicio} a ${fin})`,
      });
    }

    const hoy = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString().slice(0, 10);
    if (fecha < hoy) {
      return res
        .status(400)
        .json({ message: "La fecha de entrega no puede estar en el pasado" });
    }

    venta.set("propuestaEntrega", {
      lugar,
      fecha,
      hora,
      estado: "pendiente",
      registradaEn: new Date(),
      respondidaEn: undefined,
    });
    await venta.save();

    await avisoEnChat(
      venta,
      `Propuesta de entrega: ${lugar}, el ${fecha} a las ${hora}. El chat queda en pausa hasta que el comprador la acepte o la rechace.`,
      "vendedor",
    );

    const productoActual = await productoDeVenta(venta);
    res.status(201).json(respuestaDeEntrega(venta, productoActual, "vendedor"));
  } catch (error) {
    console.error("[entrega] Error al registrar la propuesta:", error);
    res.status(500).json({ message: "Error al registrar la propuesta" });
  }
}

export async function responderPropuesta(
  req: RequestConComprador,
  res: Response,
) {
  try {
    const venta = await cargarVentaParaRol(
      req.params.ventaId,
      "comprador",
      req.compradorId as string,
    );
    if (!venta) return res.status(403).json({ message: MENSAJE_AJENO });

    if (venta.propuestaEntrega?.estado !== "pendiente") {
      return res
        .status(400)
        .json({ message: "No hay una propuesta de entrega pendiente" });
    }

    const aceptar = req.body?.aceptar === true || req.body?.aceptar === "true";
    const ahora = new Date();
    const propuesta = venta.propuestaEntrega;

    if (aceptar) {
      venta.set("propuestaEntrega.estado", "aceptada");
      venta.set("propuestaEntrega.respondidaEn", ahora);
    } else {
      venta.propuestasRechazadas.push({
        lugar: propuesta.lugar,
        fecha: propuesta.fecha,
        hora: propuesta.hora,
        registradaEn: propuesta.registradaEn,
        respondidaEn: ahora,
      });
      venta.set("propuestaEntrega.estado", "rechazada");
      venta.set("propuestaEntrega.respondidaEn", ahora);
    }
    await venta.save();

    await avisoEnChat(
      venta,
      aceptar
        ? `El comprador aceptó la entrega: ${propuesta.lugar}, el ${propuesta.fecha} a las ${propuesta.hora}.`
        : "El comprador rechazó la propuesta de entrega. El vendedor debe registrar una nueva propuesta.",
      "comprador",
    );

    const producto = await productoDeVenta(venta);
    res.json(respuestaDeEntrega(venta, producto, "comprador"));
  } catch (error) {
    console.error("[entrega] Error al responder la propuesta:", error);
    res.status(500).json({ message: "Error al responder la propuesta" });
  }
}

export async function registrarDireccion(
  req: RequestConComprador,
  res: Response,
) {
  try {
    const venta = await cargarVentaParaRol(
      req.params.ventaId,
      "comprador",
      req.compradorId as string,
    );
    if (!venta) return res.status(403).json({ message: MENSAJE_AJENO });

    if (venta.estado !== "en_entrega") {
      return res.status(400).json({
        message: "La dirección se registra cuando el chat de coordinación está abierto",
      });
    }

    const producto = await productoDeVenta(venta);
    if (producto?.metodoEntrega !== "domicilio") {
      return res
        .status(400)
        .json({ message: "Esta compra no se entrega por envío a domicilio" });
    }

    if (venta.datosEnvio?.registradoEn) {
      return res.status(400).json({
        message: "El vendedor ya registró el envío; la dirección ya no se puede cambiar",
      });
    }

    const campos = {
      nombreRecibe: String(req.body?.nombreRecibe ?? "").trim(),
      calleNumero: String(req.body?.calleNumero ?? "").trim(),
      colonia: String(req.body?.colonia ?? "").trim(),
      codigoPostal: String(req.body?.codigoPostal ?? "").trim(),
      ciudad: String(req.body?.ciudad ?? "").trim(),
      estado: String(req.body?.estado ?? "").trim(),
      telefono: String(req.body?.telefono ?? "").trim(),
      referencias: String(req.body?.referencias ?? "").trim(),
    };

    const obligatorios: (keyof typeof campos)[] = [
      "nombreRecibe",
      "calleNumero",
      "colonia",
      "codigoPostal",
      "ciudad",
      "estado",
      "telefono",
    ];
    if (obligatorios.some((campo) => !campos[campo])) {
      return res
        .status(400)
        .json({ message: "Completa todos los campos obligatorios de la dirección" });
    }
    if (!/^\d{5}$/.test(campos.codigoPostal)) {
      return res
        .status(400)
        .json({ message: "El código postal debe tener 5 dígitos" });
    }
    if (!/^\d{10}$/.test(campos.telefono)) {
      return res
        .status(400)
        .json({ message: "El teléfono de contacto debe tener 10 dígitos" });
    }

    const campoProhibido = campoConPalabrasProhibidas(campos);
    if (campoProhibido) {
      return res
        .status(400)
        .json({ message: mensajePalabrasProhibidas(campoProhibido) });
    }

    venta.set("direccionEntrega", { ...campos, registradaEn: new Date() });
    await venta.save();

    await avisoEnChat(
      venta,
      "El comprador registró su dirección de entrega.",
      "comprador",
    );

    res.status(201).json(respuestaDeEntrega(venta, producto, "comprador"));
  } catch (error) {
    console.error("[entrega] Error al registrar la dirección:", error);
    res.status(500).json({ message: "Error al registrar la dirección" });
  }
}

export async function registrarEnvio(req: RequestConUsuario, res: Response) {
  try {
    const venta = await cargarVentaParaRol(
      req.params.ventaId,
      "vendedor",
      String(req.usuarioId),
    );
    if (!venta) return res.status(403).json({ message: MENSAJE_AJENO });

    if (venta.estado !== "en_entrega") {
      return res
        .status(400)
        .json({ message: "Esta compra no está en proceso de entrega" });
    }

    const producto = await productoDeVenta(venta);
    if (producto?.metodoEntrega !== "domicilio") {
      return res
        .status(400)
        .json({ message: "Esta compra no se entrega por envío a domicilio" });
    }
    if (!venta.direccionEntrega?.registradaEn) {
      return res
        .status(400)
        .json({ message: "El comprador aún no registra su dirección de entrega" });
    }

    const paqueteria = String(req.body?.paqueteria ?? "").trim();
    const numeroGuia = String(req.body?.numeroGuia ?? "").trim();
    const fechaEstimada = String(req.body?.fechaEstimada ?? "").trim();

    if (!paqueteria || !numeroGuia || !fechaEstimada) {
      return res.status(400).json({
        message: "Completa la paquetería, el número de guía y la fecha estimada de llegada",
      });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaEstimada)) {
      return res
        .status(400)
        .json({ message: "La fecha estimada de llegada no es válida" });
    }

    const campoProhibido = campoConPalabrasProhibidas({ paqueteria, numeroGuia });
    if (campoProhibido) {
      return res
        .status(400)
        .json({ message: mensajePalabrasProhibidas(campoProhibido) });
    }

    venta.set("datosEnvio", {
      paqueteria,
      numeroGuia,
      fechaEstimada,
      registradoEn: new Date(),
    });
    await venta.save();

    await avisoEnChat(
      venta,
      `Envío registrado: ${paqueteria}, guía ${numeroGuia}, llegada estimada el ${fechaEstimada}.`,
      "vendedor",
    );

    res.status(201).json(respuestaDeEntrega(venta, producto, "vendedor"));
  } catch (error) {
    console.error("[entrega] Error al registrar el envío:", error);
    res.status(500).json({ message: "Error al registrar el envío" });
  }
}
