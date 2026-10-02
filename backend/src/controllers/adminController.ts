import { Request, Response } from "express";
import mongoose from "mongoose";
import clientePrisma from "../configuracion/prisma.js";
import { Cola } from "../models/Cola.js";
import { Mensaje } from "../models/Mensaje.js";
import { Reporte } from "../models/Reporte.js";
import { Venta } from "../models/Venta.js";
import { Usuario } from "../models/usuario.js";
import { aplicarFaltaConfirmada } from "./reporteController.js";

const USUARIOS_POR_PAGINA = 10;

type UsuarioResumido = {
  id: string;
  nombreCompleto: string;
  correo: string;
  tipo: string;
  suspendido: boolean;
  fechaRegistro: Date | null;
};

function resumirUsuario(usuario: {
  _id: unknown;
  nombreCompleto?: string;
  correo?: string;
  tipo?: string;
  suspendido?: boolean;
  createdAt?: Date;
}): UsuarioResumido {
  return {
    id: String(usuario._id),
    nombreCompleto: usuario.nombreCompleto ?? "",
    correo: usuario.correo ?? "",
    tipo: usuario.tipo ?? "",
    suspendido: usuario.suspendido === true,
    fechaRegistro: usuario.createdAt ?? null,
  };
}

export async function obtenerTodosLosUsuarios(req: Request, res: Response) {
  try {
    const pagina = Math.max(Number(req.query.pagina) || 1, 1);
    const porPagina = Math.max(
      Number(req.query.porPagina) || USUARIOS_POR_PAGINA,
      1,
    );

    const [usuarios, total] = await Promise.all([
      Usuario.find()
        .select("nombreCompleto correo tipo suspendido createdAt")
        .sort({ createdAt: -1 })
        .skip((pagina - 1) * porPagina)
        .limit(porPagina)
        .lean(),
      Usuario.countDocuments(),
    ]);

    res.json({
      usuarios: usuarios.map(resumirUsuario),
      pagina,
      porPagina,
      total,
      totalPaginas: Math.max(Math.ceil(total / porPagina), 1),
    });
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al obtener los usuarios" });
  }
}

async function cambiarSuspension(
  req: Request,
  res: Response,
  suspendido: boolean,
) {
  try {
    const id = req.params.id;

    if (!id || !mongoose.isValidObjectId(id)) {
      return res
        .status(400)
        .json({ message: "Indica el usuario que quieres modificar" });
    }

    const usuario = await Usuario.findByIdAndUpdate(
      id,
      { suspendido },
      { new: true },
    );

    if (!usuario) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    res.json(resumirUsuario(usuario));
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al actualizar el usuario" });
  }
}

export async function suspenderUsuario(req: Request, res: Response) {
  await cambiarSuspension(req, res, true);
}

export async function reactivarUsuario(req: Request, res: Response) {
  await cambiarSuspension(req, res, false);
}

export async function obtenerReportesPendientes(req: Request, res: Response) {
  try {
    const reportes = await clientePrisma.reporte.findMany({
      where: { estado: "pendiente" },
      orderBy: { createdAt: "desc" },
    });

    const vendedores: Record<string, string> = {};
    for (const reporte of reportes) {
      const idVendedor = String(reporte.vendedorId);
      if (vendedores[idVendedor]) continue;

      const vendedor = await clientePrisma.usuario.findUnique({
        where: { id: Number(reporte.vendedorId) },
        select: { nombreCompleto: true },
      });
      vendedores[idVendedor] =
        vendedor?.nombreCompleto ?? "Vendedor no encontrado";
    }

    res.json(
      reportes.map((reporte) => ({
        id: reporte.id,
        categoria: reporte.categoria,
        categoriaNombre: reporte.categoriaNombre,
        elemento: reporte.elemento,
        tipoFalta: reporte.tipoFalta,
        detalle: reporte.detalle ?? null,
        estado: reporte.estado,
        sujetoTipo: reporte.sujetoTipo,
        reportadoPorTipo: reporte.reportadoPorTipo,
        vendedorNombre: vendedores[String(reporte.vendedorId)],
        fecha: reporte.createdAt,
      })),
    );
  } catch (error) {
    console.error("Error real:", error);
    res
      .status(500)
      .json({ message: "Error al obtener los reportes pendientes" });
  }
}

export async function resolverReporte(req: Request, res: Response) {
  try {
    const idReporte = req.params.id;
    const resultado =
      typeof req.body?.resultado === "string" ? req.body.resultado : "";

    if (!idReporte || isNaN(Number(idReporte))) {
      return res
        .status(400)
        .json({ message: "Indica el reporte que quieres resolver" });
    }

    if (resultado !== "confirmado" && resultado !== "rechazado") {
      return res
        .status(400)
        .json({ message: "El resultado debe ser confirmado o rechazado" });
    }

    const reporte = await clientePrisma.reporte.findUnique({
      where: { id: Number(idReporte) },
    });

    if (!reporte) {
      return res.status(404).json({ message: "Reporte no encontrado" });
    }

    if (reporte.estado !== "pendiente") {
      return res
        .status(400)
        .json({ message: "Este reporte ya fue resuelto" });
    }

    if (resultado === "rechazado") {
      await clientePrisma.reporte.update({
        where: { id: reporte.id },
        data: { estado: "rechazado" },
      });

      return res.json({ message: "Reporte rechazado", estado: "rechazado" });
    }

    const sujetoEsVendedor =
      reporte.tipoReportado === "vendedor" || reporte.sujetoTipo === "usuario";
    const idVendedorAcusado = Number(reporte.sujetoId);
    let vendedor: { faltasLeves: number } | null = null;

    if (sujetoEsVendedor) {
      if (!Number.isFinite(idVendedorAcusado)) {
        return res
          .status(400)
          .json({ message: "El vendedor de este reporte no es válido" });
      }

      vendedor = await clientePrisma.usuario.findUnique({
        where: { id: idVendedorAcusado },
      });

      if (!vendedor) {
        return res.status(404).json({ message: "Vendedor no encontrado" });
      }
    }

    await clientePrisma.reporte.update({
      where: { id: reporte.id },
      data: { estado: "confirmado" },
    });

    if (!vendedor) {
      return res.json({
        message: "Reporte confirmado correctamente",
        estado: "confirmado",
      });
    }

    const faltas = await aplicarFaltaConfirmada(
      idVendedorAcusado,
      vendedor.faltasLeves,
    );

    res.json({
      message: "Reporte confirmado correctamente",
      estado: "confirmado",
      faltasLeves: faltas.faltasLeves,
      faltaGraveRegistrada: faltas.faltaGraveRegistrada,
    });
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al resolver el reporte" });
  }
}

const LIMITE_HISTORIAL = 100;
const PRODUCTO_INEXISTENTE = "Producto no encontrado";
const VENDEDOR_INEXISTENTE = "Vendedor no encontrado";

type EntradaHistorial = {
  id: string;
  tipo: "fila" | "venta" | "reporte";
  fecha: Date;
  estado: string;
  productoNombre: string;
  vendedorNombre: string;
  monto: number | null;
  detalle: string;
};

function resolverProducto(...candidatos: unknown[]) {
  for (const candidato of candidatos) {
    const producto = candidato as { nombre?: string; vendedor?: string } | null;
    if (!producto?.nombre) continue;

    return {
      nombre: producto.nombre,
      vendedor: producto.vendedor ?? VENDEDOR_INEXISTENTE,
    };
  }

  return { nombre: PRODUCTO_INEXISTENTE, vendedor: VENDEDOR_INEXISTENTE };
}

function fechaDeDocumento(createdAt?: Date | string) {
  return createdAt ? new Date(createdAt) : new Date(0);
}

function entradaDeCola(cola: unknown): EntradaHistorial {
  const datos = cola as {
    _id: unknown;
    createdAt?: Date | string;
    posicion?: number;
    estado?: string;
    productoId?: unknown;
  };
  const producto = resolverProducto(datos.productoId);

  return {
    id: String(datos._id),
    tipo: "fila",
    fecha: fechaDeDocumento(datos.createdAt),
    estado: datos.estado ?? "activa",
    productoNombre: producto.nombre,
    vendedorNombre: producto.vendedor,
    monto: null,
    detalle: `Posición ${datos.posicion ?? "-"}`,
  };
}

function entradaDeVenta(venta: unknown): EntradaHistorial {
  const datos = venta as {
    _id: unknown;
    createdAt?: Date | string;
    estado?: string;
    monto?: number;
    paypalOrderId?: string;
    productoId?: unknown;
  };
  const producto = resolverProducto(datos.productoId);

  return {
    id: String(datos._id),
    tipo: "venta",
    fecha: fechaDeDocumento(datos.createdAt),
    estado: datos.estado ?? "completada",
    productoNombre: producto.nombre,
    vendedorNombre: producto.vendedor,
    monto: typeof datos.monto === "number" ? datos.monto : null,
    detalle: datos.paypalOrderId
      ? `Referencia ${datos.paypalOrderId}`
      : "Sin referencia",
  };
}

function entradaDeReporte(reporte: unknown): EntradaHistorial {
  const datos = reporte as {
    _id: unknown;
    createdAt?: Date | string;
    estado?: string;
    categoria?: string;
    categoriaNombre?: string;
    tipoFalta?: string;
    productoId?: unknown;
    ventaId?: unknown;
  };
  const venta = datos.ventaId as { productoId?: unknown } | null | undefined;
  const producto = resolverProducto(datos.productoId, venta?.productoId);
  const categoria =
    datos.categoriaNombre ?? datos.categoria ?? "Reporte sin categoría";

  return {
    id: String(datos._id),
    tipo: "reporte",
    fecha: fechaDeDocumento(datos.createdAt),
    estado: datos.estado ?? "pendiente",
    productoNombre: producto.nombre,
    vendedorNombre: producto.vendedor,
    monto: null,
    detalle: datos.tipoFalta
      ? `${categoria} (falta ${datos.tipoFalta})`
      : categoria,
  };
}

export async function obtenerHistorialTransacciones(
  req: Request,
  res: Response,
) {
  try {
    const [colas, ventas, reportes] = await Promise.all([
      Cola.find()
        .sort({ createdAt: -1 })
        .limit(LIMITE_HISTORIAL)
        .populate("productoId", "nombre vendedor"),
      Venta.find()
        .sort({ createdAt: -1 })
        .limit(LIMITE_HISTORIAL)
        .populate("productoId", "nombre vendedor"),
      Reporte.find()
        .sort({ createdAt: -1 })
        .limit(LIMITE_HISTORIAL)
        .populate("productoId", "nombre vendedor")
        .populate({
          path: "ventaId",
          select: "productoId",
          populate: { path: "productoId", select: "nombre vendedor" },
        }),
    ]);

    const historial: EntradaHistorial[] = [
      ...colas.map(entradaDeCola),
      ...ventas.map(entradaDeVenta),
      ...reportes.map(entradaDeReporte),
    ];

    historial.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());

    res.json(historial);
  } catch (error) {
    console.error("Error real:", error);
    res
      .status(500)
      .json({ message: "Error al obtener el historial de transacciones" });
  }
}

export async function obtenerMensajesDeVenta(req: Request, res: Response) {
  try {
    const ventaId = req.params.ventaId;

    if (!ventaId || !mongoose.isValidObjectId(ventaId)) {
      return res
        .status(400)
        .json({ message: "Indica la venta de la conversación" });
    }

    const venta = await Venta.findById(ventaId);
    if (!venta) {
      return res.status(404).json({ message: "Venta no encontrada" });
    }

    const mensajes = await Mensaje.find({ ventaId }).sort({ createdAt: 1 });

    res.json(mensajes);
  } catch (error) {
    console.error("Error real:", error);
    res
      .status(500)
      .json({ message: "Error al obtener los mensajes de la venta" });
  }
}
