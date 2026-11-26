// Acceso completo del administrador: productos, datos de usuarios,
// transacciones con su motivo, todas las conversaciones y quejas.
import mongoose from "mongoose";
import clientePrisma from "../configuracion/prisma.js";
import { Producto } from "../models/producto.js";
import { Promocional } from "../models/Promocional.js";
import { Venta } from "../models/Venta.js";
import { Mensaje } from "../models/Mensaje.js";
import { Comentario } from "../models/Comentario.js";
import { ConsultaPromocional } from "../models/ConsultaPromocional.js";
import { Disputa } from "../models/Disputa.js";
import { Queja, ESTADOS_QUEJA } from "../models/Queja.js";
import { ErrorBackoffice } from "./errorBackoffice.js";
import { FORMATO_CORREO } from "../utils/formatoCorreo.js";

const POR_PAGINA = 20;

type Paginado<T> = {
  elementos: T[];
  pagina: number;
  porPagina: number;
  total: number;
  totalPaginas: number;
};

function paginar<T>(lista: T[], paginaSolicitada?: number): Paginado<T> {
  const total = lista.length;
  const totalPaginas = Math.max(Math.ceil(total / POR_PAGINA), 1);
  const pagina = Math.min(Math.max(Number(paginaSolicitada) || 1, 1), totalPaginas);
  return {
    elementos: lista.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA),
    pagina,
    porPagina: POR_PAGINA,
    total,
    totalPaginas,
  };
}

function normalizar(texto: unknown): string {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function coincide(busqueda: string, ...campos: unknown[]): boolean {
  if (!busqueda) return true;
  const termino = normalizar(busqueda);
  return campos.some((campo) => normalizar(campo).includes(termino));
}

function fecha(valor: unknown): string | null {
  if (!valor) return null;
  const d = new Date(valor as string);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function idCorto(id: unknown): string {
  return String(id ?? "").slice(-6);
}

async function nombresDeUsuarios(): Promise<Map<string, string>> {
  const usuarios = await clientePrisma.usuario.findMany({
    select: { id: true, nombreCompleto: true },
  });
  return new Map(
    usuarios.map((u: { id: number; nombreCompleto: string }) => [
      String(u.id),
      u.nombreCompleto,
    ]),
  );
}

function nombreComprador(compradorId: unknown, nombres: Map<string, string>) {
  const id = String(compradorId ?? "");
  return nombres.get(id) ?? `Comprador n.º ${idCorto(id)}`;
}

// ---------------------------------------------------------------- Productos

type TipoPublicacion = "producto" | "promocional";

function modeloDe(tipo: string) {
  if (tipo === "producto") return Producto;
  if (tipo === "promocional") return Promocional;
  throw new ErrorBackoffice(400, "Tipo de publicación no válido");
}

export async function listarPublicacionesAdmin(opciones: {
  q?: string;
  tipo?: string;
  estado?: string;
  pagina?: number;
}) {
  const tipo = opciones.tipo === "producto" || opciones.tipo === "promocional"
    ? opciones.tipo
    : "todos";
  const [productos, promocionales] = await Promise.all([
    tipo === "promocional" ? [] : Producto.find().sort({ createdAt: -1 }).lean(),
    tipo === "producto" ? [] : Promocional.find().sort({ createdAt: -1 }).lean(),
  ]);

  const lista = [
    ...productos.map((p: any) => ({ ...p, tipo: "producto" as TipoPublicacion })),
    ...promocionales.map((p: any) => ({
      ...p,
      tipo: "promocional" as TipoPublicacion,
    })),
  ]
    .filter((p) =>
      opciones.estado === "activo"
        ? p.activo !== false
        : opciones.estado === "inactivo"
          ? p.activo === false
          : true,
    )
    .filter((p) =>
      coincide(opciones.q ?? "", p.nombre, p.vendedor, p.categoria, p._id, p.descripcion),
    )
    .sort(
      (a, b) =>
        new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime(),
    )
    .map((p) => ({
      _id: String(p._id),
      tipo: p.tipo,
      nombre: p.nombre,
      descripcion: p.descripcion,
      precio: p.precio,
      categoria: p.categoria,
      condicionUso: p.condicionUso ?? null,
      imagenes: p.imagenes ?? [],
      vendedor: p.vendedor,
      vendedorId: String(p.vendedorId),
      activo: p.activo !== false,
      metodoEntrega: p.metodoEntrega ?? null,
      coberturaEnvio: p.coberturaEnvio ?? null,
      chatHabilitado: p.chatHabilitado ?? null,
      zonaComentariosHabilitada: p.zonaComentariosHabilitada ?? null,
      creadoEn: fecha(p.createdAt),
      actualizadoEn: fecha(p.updatedAt),
    }));

  return paginar(lista, opciones.pagina);
}

const CAMPOS_EDITABLES_PUBLICACION = [
  "nombre",
  "descripcion",
  "precio",
  "categoria",
  "activo",
  "chatHabilitado",
  "zonaComentariosHabilitada",
] as const;

export async function editarPublicacionAdmin(
  tipo: string,
  id: string,
  datos: Record<string, unknown>,
) {
  if (!mongoose.isValidObjectId(id)) {
    throw new ErrorBackoffice(400, "Publicación no válida");
  }
  const Modelo: any = modeloDe(tipo);
  const cambios: Record<string, unknown> = {};
  for (const campo of CAMPOS_EDITABLES_PUBLICACION) {
    if (!(campo in datos)) continue;
    const valor = datos[campo];
    if (campo === "precio") {
      const precio = Number(valor);
      if (!Number.isFinite(precio) || precio <= 0) {
        throw new ErrorBackoffice(400, "El precio debe ser mayor a cero");
      }
      cambios.precio = precio;
    } else if (
      campo === "activo" ||
      campo === "chatHabilitado" ||
      campo === "zonaComentariosHabilitada"
    ) {
      cambios[campo] = Boolean(valor);
    } else {
      const texto = String(valor ?? "").trim();
      if (!texto) {
        throw new ErrorBackoffice(400, `El campo ${campo} no puede quedar vacío`);
      }
      cambios[campo] = texto;
    }
  }
  if (!Object.keys(cambios).length) {
    throw new ErrorBackoffice(400, "No hay cambios que guardar");
  }

  try {
    const actualizado = await Modelo.findByIdAndUpdate(
      id,
      { $set: cambios },
      { returnDocument: "after", runValidators: true },
    ).lean();
    if (!actualizado) throw new ErrorBackoffice(404, "Publicación no encontrada");
    return { message: "Publicación actualizada", publicacion: actualizado };
  } catch (error) {
    if (error instanceof ErrorBackoffice) throw error;
    const mensaje =
      error instanceof mongoose.Error.ValidationError
        ? Object.values(error.errors)[0]?.message
        : null;
    throw new ErrorBackoffice(400, mensaje || "No se pudo guardar la publicación");
  }
}

// ----------------------------------------------------------------- Usuarios

export async function detalleUsuarioAdmin(id: string) {
  const idUsuario = Number(id);
  if (!Number.isInteger(idUsuario) || idUsuario <= 0) {
    throw new ErrorBackoffice(400, "Usuario no válido");
  }
  const usuario = await clientePrisma.usuario.findUnique({
    where: { id: idUsuario },
  });
  if (!usuario) throw new ErrorBackoffice(404, "Usuario no encontrado");

  const {
    password: _password,
    codigoCorreo: _codigoCorreo,
    codigoCorreoExpira: _codigoCorreoExpira,
    codigoRecuperacion: _codigoRecuperacion,
    codigoRecuperacionExpira: _codigoRecuperacionExpira,
    ...datos
  } = usuario;

  const [productos, promocionales, ventas] = await Promise.all([
    Producto.countDocuments({ vendedorId: String(idUsuario) }),
    Promocional.countDocuments({ vendedorId: String(idUsuario) }),
    Venta.countDocuments({ vendedorId: String(idUsuario) }),
  ]);

  return {
    ...datos,
    id: String(datos.id),
    tieneIneFrente: Boolean(usuario.ineFrente),
    tieneIneReverso: Boolean(usuario.ineReverso),
    totales: { productos, promocionales, ventas },
  };
}

const CAMPOS_EDITABLES_USUARIO = [
  "nombreCompleto",
  "correo",
  "telefono",
  "direccion",
  "rfc",
  "curp",
  "paypalEmail",
  "tipo",
] as const;

export async function editarUsuarioAdmin(
  id: string,
  datos: Record<string, unknown>,
) {
  const idUsuario = Number(id);
  if (!Number.isInteger(idUsuario) || idUsuario <= 0) {
    throw new ErrorBackoffice(400, "Usuario no válido");
  }
  const actual = await clientePrisma.usuario.findUnique({
    where: { id: idUsuario },
    select: { id: true, tipo: true },
  });
  if (!actual) throw new ErrorBackoffice(404, "Usuario no encontrado");

  const cambios: Record<string, string | null> = {};
  for (const campo of CAMPOS_EDITABLES_USUARIO) {
    if (!(campo in datos)) continue;
    const texto = String(datos[campo] ?? "").trim();
    if (campo === "curp") {
      cambios.curp = texto ? texto.toUpperCase() : null;
      continue;
    }
    if (!texto) {
      throw new ErrorBackoffice(400, `El campo ${campo} no puede quedar vacío`);
    }
    if ((campo === "correo" || campo === "paypalEmail") && !FORMATO_CORREO.test(texto)) {
      throw new ErrorBackoffice(400, "Escribe un correo válido");
    }
    if (campo === "telefono" && !/^\d{10}$/.test(texto)) {
      throw new ErrorBackoffice(400, "El teléfono debe tener 10 dígitos");
    }
    if (campo === "tipo" && !["vendedor", "admin"].includes(texto)) {
      throw new ErrorBackoffice(400, "Tipo de cuenta no válido");
    }
    cambios[campo] =
      campo === "rfc" ? texto.toUpperCase() : campo === "correo" ? texto.toLowerCase() : texto;
  }
  if (!Object.keys(cambios).length) {
    throw new ErrorBackoffice(400, "No hay cambios que guardar");
  }

  if (cambios.correo) {
    const otro = await clientePrisma.usuario.findFirst({
      where: { correo: cambios.correo },
      select: { id: true },
    });
    if (otro && Number(otro.id) !== idUsuario) {
      throw new ErrorBackoffice(400, "Ese correo ya pertenece a otra cuenta");
    }
  }

  await clientePrisma.usuario.update({ where: { id: idUsuario }, data: cambios });
  return { message: "Datos del usuario actualizados", usuario: await detalleUsuarioAdmin(id) };
}

// ------------------------------------------------------------ Transacciones

const TEXTO_ESTADO_VENTA: Record<string, string> = {
  pendiente_comprobante: "Esperando comprobante",
  pendiente_confirmacion: "Comprobante por confirmar",
  en_entrega: "En entrega",
  completada: "Completada",
  reembolsada: "Reembolsada",
  cancelada: "Cancelada",
};

function motivoDeVenta(venta: any, disputa: any | undefined): string {
  const partes: string[] = [];
  if (disputa) {
    partes.push(
      `Disputa ${disputa.estado}: ${disputa.motivo}${disputa.descripcion ? ` — ${disputa.descripcion}` : ""}`,
    );
    if (disputa.notaAdmin) partes.push(`Dictamen: ${disputa.notaAdmin}`);
  }
  if (venta.canceladoMotivo) partes.push(venta.canceladoMotivo);
  if (venta.retenido) partes.push("Pago retenido de forma preventiva por un reporte o una disputa");
  if (!partes.length) {
    switch (venta.estado) {
      case "pendiente_comprobante":
        return "Compra autorizada en PayPal; el comprador aún no envía su comprobante";
      case "pendiente_confirmacion":
        return "El comprador envió su comprobante; el vendedor debe confirmarlo";
      case "en_entrega":
        return "Pago confirmado; vendedor y comprador coordinan la entrega";
      case "completada":
        return "Entrega confirmada con el código del comprador; fondos liberados";
      case "reembolsada":
        return "Se reembolsó el pago al comprador";
      case "cancelada":
        return "Compra cancelada";
    }
  }
  return partes.join(" · ");
}

async function cargarVentasConContexto() {
  const [ventas, disputas, nombres, conteos] = await Promise.all([
    Venta.find().sort({ createdAt: -1 }).lean(),
    Disputa.find().sort({ createdAt: -1 }).lean(),
    nombresDeUsuarios(),
    Mensaje.aggregate([
      {
        $group: {
          _id: "$ventaId",
          total: { $sum: 1 },
          ultimo: { $max: "$createdAt" },
        },
      },
    ]),
  ]);

  const idsProducto = [...new Set(ventas.map((v: any) => String(v.productoId)))];
  const productos = await Producto.find({ _id: { $in: idsProducto } })
    .select("nombre vendedor")
    .lean();
  const productoPorId = new Map(productos.map((p: any) => [String(p._id), p]));

  const disputaPorVenta = new Map<string, any>();
  for (const d of disputas as any[]) {
    const clave = d.ventaMongoId ? String(d.ventaMongoId) : `pg:${d.ventaIdPg}`;
    if (!disputaPorVenta.has(clave)) disputaPorVenta.set(clave, d);
  }
  const conteoPorVenta = new Map(
    conteos.map((c: any) => [String(c._id), { total: c.total, ultimo: c.ultimo }]),
  );

  const reportes = await clientePrisma.reporte.findMany({
    select: { id: true, ventaId: true, estado: true },
  });
  const reportesPorVentaPg = new Map<string, number>();
  for (const r of reportes as any[]) {
    if (!r.ventaId) continue;
    reportesPorVentaPg.set(String(r.ventaId), (reportesPorVentaPg.get(String(r.ventaId)) ?? 0) + 1);
  }

  return ventas.map((v: any) => {
    const producto = productoPorId.get(String(v.productoId));
    const disputa =
      disputaPorVenta.get(String(v._id)) ??
      (v.ventaIdPg ? disputaPorVenta.get(`pg:${v.ventaIdPg}`) : undefined);
    const conteo = conteoPorVenta.get(String(v._id));
    return {
      _id: String(v._id),
      ventaIdPg: v.ventaIdPg ?? null,
      productoId: String(v.productoId),
      productoNombre: producto?.nombre ?? "Publicación eliminada",
      vendedorId: String(v.vendedorId),
      vendedorNombre: nombres.get(String(v.vendedorId)) ?? producto?.vendedor ?? "Vendedor",
      compradorId: String(v.compradorId),
      compradorNombre: nombreComprador(v.compradorId, nombres),
      monto: v.monto,
      estado: v.estado,
      estadoTexto: TEXTO_ESTADO_VENTA[v.estado] ?? v.estado,
      motivo: motivoDeVenta(v, disputa),
      retenido: Boolean(v.retenido),
      disputa: disputa
        ? {
            _id: String(disputa._id),
            estado: disputa.estado,
            motivo: disputa.motivo,
            descripcion: disputa.descripcion ?? "",
            respuestaVendedor: disputa.respuestaVendedor ?? "",
            notaAdmin: disputa.notaAdmin ?? "",
          }
        : null,
      reportes: v.ventaIdPg ? reportesPorVentaPg.get(String(v.ventaIdPg)) ?? 0 : 0,
      totalMensajes: conteo?.total ?? 0,
      ultimoMensaje: fecha(conteo?.ultimo),
      paypalOrderId: v.paypalOrderId,
      creadoEn: fecha(v.createdAt),
      actualizadoEn: fecha(v.updatedAt),
    };
  });
}

export async function listarTransaccionesAdmin(opciones: {
  q?: string;
  estado?: string;
  problema?: boolean;
  pagina?: number;
}) {
  const ventas = (await cargarVentasConContexto())
    .filter((v) => (opciones.estado ? v.estado === opciones.estado : true))
    .filter((v) =>
      opciones.problema ? Boolean(v.disputa) || v.retenido || v.reportes > 0 : true,
    )
    .filter((v) =>
      coincide(
        opciones.q ?? "",
        v._id,
        v.ventaIdPg,
        v.productoNombre,
        v.vendedorNombre,
        v.compradorNombre,
        v.compradorId,
        v.paypalOrderId,
        v.motivo,
      ),
    );
  return paginar(ventas, opciones.pagina);
}

// ------------------------------------------------------------ Conversaciones

type ResumenConversacion = {
  tipo: "venta" | "consulta" | "comentarios";
  id: string;
  titulo: string;
  enlace: string;
  participantes: string;
  totalMensajes: number;
  ultimaFecha: string | null;
  vistaPrevia: string;
  disputa: string | null;
  reportes: number;
  retenido: boolean;
};

async function reportesDeMensajes() {
  const reportes = await clientePrisma.reporte.findMany({
    select: { id: true, mensajeId: true, ventaId: true, categoriaNombre: true, detalle: true, estado: true },
  });
  const porMensaje = new Map<string, any[]>();
  for (const r of reportes as any[]) {
    if (!r.mensajeId) continue;
    const id = String(r.mensajeId).split(":").pop() as string;
    porMensaje.set(id, [...(porMensaje.get(id) ?? []), r]);
  }
  return { reportes: reportes as any[], porMensaje };
}

export async function listarConversacionesAdmin(opciones: {
  q?: string;
  tipo?: string;
  problema?: boolean;
  pagina?: number;
}) {
  const tipo = opciones.tipo ?? "todas";
  const q = (opciones.q ?? "").trim();
  const nombres = await nombresDeUsuarios();
  const { porMensaje } = await reportesDeMensajes();
  const conversaciones: ResumenConversacion[] = [];

  // Búsqueda en el texto de los mensajes.
  const regex = q ? new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") : null;

  if (tipo === "todas" || tipo === "venta") {
    const ventas = await cargarVentasConContexto();
    const conTexto = regex
      ? new Set(
          (await Mensaje.find({ contenido: regex }).select("ventaId").lean()).map((m: any) =>
            String(m.ventaId),
          ),
        )
      : null;
    const ultimos = await Mensaje.aggregate([
      { $sort: { createdAt: -1 } },
      { $group: { _id: "$ventaId", contenido: { $first: "$contenido" }, ids: { $push: "$_id" } } },
    ]);
    const ultimoPorVenta = new Map(ultimos.map((u: any) => [String(u._id), u]));

    for (const v of ventas) {
      const extra = ultimoPorVenta.get(v._id);
      const reportesMensajes = (extra?.ids ?? []).reduce(
        (suma: number, id: any) => suma + (porMensaje.get(String(id))?.length ?? 0),
        0,
      );
      const resumen: ResumenConversacion = {
        tipo: "venta",
        id: v._id,
        titulo: v.productoNombre,
        enlace: `/producto/${v.productoId}`,
        participantes: `${v.vendedorNombre} (vendedor) y ${v.compradorNombre}`,
        totalMensajes: v.totalMensajes,
        ultimaFecha: v.ultimoMensaje ?? v.actualizadoEn,
        vistaPrevia: extra?.contenido ?? "",
        disputa: v.disputa ? v.disputa.estado : null,
        reportes: v.reportes + reportesMensajes,
        retenido: v.retenido,
      };
      if (
        q &&
        !coincide(q, v._id, v.ventaIdPg, v.productoNombre, v.vendedorNombre, v.compradorNombre, v.compradorId, v.paypalOrderId) &&
        !conTexto?.has(v._id)
      ) {
        continue;
      }
      conversaciones.push(resumen);
    }
  }

  if (tipo === "todas" || tipo === "consulta" || tipo === "comentarios") {
    const promocionales = await Promocional.find().select("nombre vendedor vendedorId").lean();
    const promoPorId = new Map(promocionales.map((p: any) => [String(p._id), p]));

    if (tipo !== "comentarios") {
      const grupos = await ConsultaPromocional.aggregate([
        { $sort: { createdAt: 1 } },
        {
          $group: {
            _id: { promocionalId: "$promocionalId", compradorId: "$compradorId" },
            total: { $sum: 1 },
            ultima: { $max: "$createdAt" },
            ultimoContenido: { $last: "$contenido" },
            ids: { $push: "$_id" },
            textos: { $push: "$contenido" },
          },
        },
      ]);
      for (const g of grupos) {
        const promo: any = promoPorId.get(String(g._id.promocionalId));
        const vendedor = promo
          ? nombres.get(String(promo.vendedorId)) ?? promo.vendedor
          : "Vendedor";
        const comprador = nombreComprador(g._id.compradorId, nombres);
        if (
          q &&
          !coincide(q, promo?.nombre, vendedor, comprador, g._id.compradorId, g._id.promocionalId) &&
          !(regex && g.textos.some((t: string) => regex.test(t)))
        ) {
          continue;
        }
        conversaciones.push({
          tipo: "consulta",
          id: `${g._id.promocionalId}:${g._id.compradorId}`,
          titulo: promo?.nombre ?? "Promocional eliminado",
          enlace: `/promocional/${g._id.promocionalId}`,
          participantes: `${vendedor} (vendedor) y ${comprador}`,
          totalMensajes: g.total,
          ultimaFecha: fecha(g.ultima),
          vistaPrevia: g.ultimoContenido ?? "",
          disputa: null,
          reportes: g.ids.reduce(
            (suma: number, id: any) => suma + (porMensaje.get(String(id))?.length ?? 0),
            0,
          ),
          retenido: false,
        });
      }
    }

    if (tipo !== "consulta") {
      const grupos = await Comentario.aggregate([
        { $sort: { createdAt: 1 } },
        {
          $group: {
            _id: "$promocionalId",
            total: { $sum: 1 },
            ultima: { $max: "$createdAt" },
            ultimoContenido: { $last: "$texto" },
            ids: { $push: "$_id" },
            textos: { $push: "$texto" },
          },
        },
      ]);
      for (const g of grupos) {
        const promo: any = promoPorId.get(String(g._id));
        const vendedor = promo
          ? nombres.get(String(promo.vendedorId)) ?? promo.vendedor
          : "Vendedor";
        if (
          q &&
          !coincide(q, promo?.nombre, vendedor, g._id) &&
          !(regex && g.textos.some((t: string) => regex.test(t)))
        ) {
          continue;
        }
        conversaciones.push({
          tipo: "comentarios",
          id: String(g._id),
          titulo: promo?.nombre ?? "Promocional eliminado",
          enlace: `/promocional/${g._id}`,
          participantes: `Comentarios públicos · ${vendedor} (vendedor)`,
          totalMensajes: g.total,
          ultimaFecha: fecha(g.ultima),
          vistaPrevia: g.ultimoContenido ?? "",
          disputa: null,
          reportes: g.ids.reduce(
            (suma: number, id: any) => suma + (porMensaje.get(String(id))?.length ?? 0),
            0,
          ),
          retenido: false,
        });
      }
    }
  }

  const filtradas = conversaciones
    .filter((c) => (opciones.problema ? Boolean(c.disputa) || c.reportes > 0 || c.retenido : true))
    .sort(
      (a, b) =>
        new Date(b.ultimaFecha ?? 0).getTime() - new Date(a.ultimaFecha ?? 0).getTime(),
    );

  return paginar(filtradas, opciones.pagina);
}

type MensajeAdmin = {
  _id: string;
  autor: string;
  rol: "vendedor" | "comprador" | "visitante";
  contenido: string;
  imagen: string | null;
  fecha: string | null;
  reportes: { categoria: string; detalle: string | null; estado: string }[];
};

export async function detalleConversacionAdmin(tipo: string, id: string) {
  const nombres = await nombresDeUsuarios();
  const { porMensaje, reportes } = await reportesDeMensajes();
  const reportesDe = (idMensaje: unknown) =>
    (porMensaje.get(String(idMensaje)) ?? []).map((r) => ({
      categoria: r.categoriaNombre,
      detalle: r.detalle ?? null,
      estado: r.estado,
    }));

  if (tipo === "venta") {
    if (!mongoose.isValidObjectId(id)) throw new ErrorBackoffice(400, "Venta no válida");
    const venta = (await cargarVentasConContexto()).find((v) => v._id === id);
    if (!venta) throw new ErrorBackoffice(404, "Venta no encontrada");
    const mensajes = await Mensaje.find({ ventaId: id }).sort({ createdAt: 1 }).lean();
    return {
      tipo,
      titulo: venta.productoNombre,
      venta,
      reportesDeLaVenta: (reportes as any[])
        .filter((r) => venta.ventaIdPg && String(r.ventaId) === String(venta.ventaIdPg))
        .map((r) => ({ categoria: r.categoriaNombre, detalle: r.detalle ?? null, estado: r.estado })),
      mensajes: mensajes.map(
        (m: any): MensajeAdmin => ({
          _id: String(m._id),
          autor: m.remitente === "vendedor" ? venta.vendedorNombre : venta.compradorNombre,
          rol: m.remitente,
          contenido: m.contenido ?? "",
          imagen: m.imagen ?? null,
          fecha: fecha(m.createdAt),
          reportes: reportesDe(m._id),
        }),
      ),
    };
  }

  if (tipo === "consulta") {
    const [promocionalId, compradorId] = id.split(":");
    if (!mongoose.isValidObjectId(promocionalId) || !compradorId) {
      throw new ErrorBackoffice(400, "Conversación no válida");
    }
    const promo: any = await Promocional.findById(promocionalId).lean();
    const vendedor = promo ? nombres.get(String(promo.vendedorId)) ?? promo.vendedor : "Vendedor";
    const comprador = nombreComprador(compradorId, nombres);
    const mensajes = await ConsultaPromocional.find({ promocionalId, compradorId })
      .sort({ createdAt: 1 })
      .lean();
    return {
      tipo,
      titulo: promo?.nombre ?? "Promocional eliminado",
      participantes: `${vendedor} (vendedor) y ${comprador}`,
      mensajes: mensajes.map(
        (m: any): MensajeAdmin => ({
          _id: String(m._id),
          autor: m.remitente === "vendedor" ? vendedor : comprador,
          rol: m.remitente,
          contenido: m.contenido,
          imagen: null,
          fecha: fecha(m.createdAt),
          reportes: reportesDe(m._id),
        }),
      ),
    };
  }

  if (tipo === "comentarios") {
    if (!mongoose.isValidObjectId(id)) throw new ErrorBackoffice(400, "Promocional no válido");
    const promo: any = await Promocional.findById(id).lean();
    const vendedor = promo ? nombres.get(String(promo.vendedorId)) ?? promo.vendedor : "Vendedor";
    const comentarios = await Comentario.find({ promocionalId: id }).sort({ createdAt: 1 }).lean();
    const mensajes: MensajeAdmin[] = [];
    for (const c of comentarios as any[]) {
      mensajes.push({
        _id: String(c._id),
        autor: c.autorNombre || "Visitante",
        rol: "visitante",
        contenido: c.texto,
        imagen: null,
        fecha: fecha(c.createdAt),
        reportes: (porMensaje.get(String(c._id)) ?? [])
          .filter((r) => !String(r.mensajeId).startsWith("respuesta:"))
          .map((r) => ({ categoria: r.categoriaNombre, detalle: r.detalle ?? null, estado: r.estado })),
      });
      if (c.respuesta?.texto) {
        mensajes.push({
          _id: `${c._id}:respuesta`,
          autor: vendedor,
          rol: "vendedor",
          contenido: c.respuesta.texto,
          imagen: null,
          fecha: fecha(c.respuesta.fecha),
          reportes: (porMensaje.get(String(c._id)) ?? [])
            .filter((r) => String(r.mensajeId).startsWith("respuesta:"))
            .map((r) => ({ categoria: r.categoriaNombre, detalle: r.detalle ?? null, estado: r.estado })),
        });
      }
    }
    return {
      tipo,
      titulo: promo?.nombre ?? "Promocional eliminado",
      participantes: `Comentarios públicos · ${vendedor} (vendedor)`,
      mensajes,
    };
  }

  throw new ErrorBackoffice(400, "Tipo de conversación no válido");
}

// ------------------------------------------------------------------ Quejas

export async function listarQuejasAdmin(opciones: {
  q?: string;
  estado?: string;
  pagina?: number;
}) {
  const filtro: Record<string, unknown> = {};
  if (opciones.estado && (ESTADOS_QUEJA as readonly string[]).includes(opciones.estado)) {
    filtro.estado = opciones.estado;
  }
  const quejas = (await Queja.find(filtro).sort({ createdAt: -1 }).lean())
    .filter((q: any) =>
      coincide(opciones.q ?? "", q.nombre, q.correo, q.asunto, q.mensaje, q.referencia),
    )
    .map((q: any) => ({
      _id: String(q._id),
      autorTipo: q.autorTipo,
      nombre: q.nombre || (q.autorTipo === "comprador" ? `Comprador n.º ${idCorto(q.autorId)}` : "Usuario"),
      correo: q.correo,
      asunto: q.asunto,
      mensaje: q.mensaje,
      referencia: q.referencia,
      estado: q.estado,
      respuestaAdmin: q.respuestaAdmin,
      creadaEn: fecha(q.createdAt),
      atendidaEn: fecha(q.atendidaEn),
    }));
  const abiertas = await Queja.countDocuments({ estado: { $ne: "atendida" } });
  return { ...paginar(quejas, opciones.pagina), abiertas };
}

export async function actualizarQuejaAdmin(
  id: string,
  datos: { estado?: unknown; respuestaAdmin?: unknown },
) {
  if (!mongoose.isValidObjectId(id)) throw new ErrorBackoffice(400, "Queja no válida");
  const cambios: Record<string, unknown> = {};
  if (typeof datos.estado === "string") {
    if (!(ESTADOS_QUEJA as readonly string[]).includes(datos.estado)) {
      throw new ErrorBackoffice(400, "Estado no válido");
    }
    cambios.estado = datos.estado;
    cambios.atendidaEn = datos.estado === "atendida" ? new Date() : null;
  }
  if (typeof datos.respuestaAdmin === "string") {
    cambios.respuestaAdmin = datos.respuestaAdmin.trim().slice(0, 1000);
  }
  const queja = await Queja.findByIdAndUpdate(id, { $set: cambios }, { returnDocument: "after" }).lean();
  if (!queja) throw new ErrorBackoffice(404, "Queja no encontrada");
  return { message: "Queja actualizada" };
}

// ------------------------------------------------------- Todos los reportes

export async function listarTodosLosReportesAdmin(opciones: {
  q?: string;
  estado?: string;
  pagina?: number;
}) {
  const [reportes, nombres] = await Promise.all([
    clientePrisma.reporte.findMany({ orderBy: { createdAt: "desc" } }),
    nombresDeUsuarios(),
  ]);

  const nombreSujeto = (tipo: string, id: string) =>
    tipo === "usuario" ? nombres.get(id) ?? `Usuario #${id}` : nombreComprador(id, nombres);

  const lista = (reportes as any[])
    .filter((r) => (opciones.estado ? r.estado === opciones.estado : true))
    .map((r) => ({
      id: r.id,
      elemento: r.elemento,
      categoria: r.categoriaNombre,
      tipoFalta: r.tipoFalta,
      detalle: r.detalle ?? "",
      estado: r.estado,
      reportado: nombreSujeto(r.sujetoTipo, String(r.sujetoId)),
      reportadoPor: nombreSujeto(r.reportadoPorTipo, String(r.reportadoPorId)),
      ventaIdPg: r.ventaId ?? null,
      mensajeId: r.mensajeId ?? null,
      creadoEn: fecha(r.createdAt),
    }))
    .filter((r) =>
      coincide(opciones.q ?? "", r.categoria, r.detalle, r.reportado, r.reportadoPor, r.elemento),
    );

  const pagina = paginar(lista, opciones.pagina);

  // Contenido del mensaje reportado, solo para la página visible.
  const elementos = await Promise.all(
    pagina.elementos.map(async (r) => ({ ...r, contenidoReportado: await contenidoReportado(r.mensajeId) })),
  );
  return { ...pagina, elementos };
}

async function contenidoReportado(referencia: string | null): Promise<string | null> {
  if (!referencia) return null;
  const [origen, id] = referencia.includes(":") ? referencia.split(":") : ["venta", referencia];
  if (!mongoose.isValidObjectId(id)) return null;
  if (origen === "venta") {
    const m: any = await Mensaje.findById(id).select("contenido").lean();
    return m?.contenido ?? null;
  }
  if (origen === "consulta") {
    const m: any = await ConsultaPromocional.findById(id).select("contenido").lean();
    return m?.contenido ?? null;
  }
  const c: any = await Comentario.findById(id).select("texto respuesta").lean();
  if (!c) return null;
  return origen === "respuesta" ? c.respuesta?.texto ?? null : c.texto;
}
