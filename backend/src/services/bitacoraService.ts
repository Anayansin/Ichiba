import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { BitacoraAccion } from "../models/BitacoraAccion.js";

type Regla = {
  metodo: string;
  patron: RegExp;
  accion: string;
  descripcion: string;
};

const REGLAS: Regla[] = [
  { metodo: "POST", patron: /^\/api\/usuarios\/login$/, accion: "inicio_sesion", descripcion: "Inició sesión" },
  { metodo: "POST", patron: /^\/api\/usuarios\/registro$/, accion: "registro", descripcion: "Registró una cuenta de vendedor" },
  { metodo: "POST", patron: /^\/api\/productos$/, accion: "publicacion", descripcion: "Publicó un producto" },
  { metodo: "PUT", patron: /^\/api\/productos\/[^/]+$/, accion: "publicacion", descripcion: "Editó un producto" },
  { metodo: "DELETE", patron: /^\/api\/productos\/[^/]+$/, accion: "publicacion", descripcion: "Dio de baja un producto" },
  { metodo: "POST", patron: /^\/api\/promocionales$/, accion: "publicacion", descripcion: "Publicó un promocional" },
  { metodo: "PUT", patron: /^\/api\/promocionales\/[^/]+$/, accion: "publicacion", descripcion: "Editó un promocional" },
  { metodo: "POST", patron: /^\/api\/colas\/entrar$/, accion: "fila", descripcion: "Entró a una fila virtual" },
  { metodo: "PATCH", patron: /^\/api\/colas\/[^/]+\/salir$/, accion: "fila", descripcion: "Abandonó una fila virtual" },
  { metodo: "PATCH", patron: /^\/api\/colas\/[^/]+\/esperar-apertura$/, accion: "fila", descripcion: "Eligió esperar al siguiente bloque" },
  { metodo: "POST", patron: /^\/api\/pagos\/capturar-orden\/[^/]+$/, accion: "pago", descripcion: "Pagó con PayPal" },
  { metodo: "POST", patron: /^\/api\/pagos\/[^/]+\/comprobante$/, accion: "pago", descripcion: "Envió su comprobante de pago" },
  { metodo: "POST", patron: /^\/api\/pagos\/[^/]+\/confirmar-comprobante$/, accion: "pago", descripcion: "Confirmó un comprobante de pago" },
  { metodo: "POST", patron: /^\/api\/pagos\/[^/]+\/rechazar-comprobante$/, accion: "pago", descripcion: "Rechazó un comprobante de pago" },
  { metodo: "POST", patron: /^\/api\/pagos\/[^/]+\/confirmar-entrega$/, accion: "pago", descripcion: "Registró el código de entrega" },
  { metodo: "POST", patron: /^\/api\/reportes(\/comprador)?$/, accion: "reporte", descripcion: "Envió un reporte" },
  { metodo: "PATCH", patron: /^\/api\/admin\/reportes\/[^/]+\/resolver$/, accion: "reporte", descripcion: "Resolvió un reporte" },
  { metodo: "PATCH", patron: /^\/api\/admin\/usuarios\/([^/]+)\/suspender$/, accion: "sancion", descripcion: "Suspendió la cuenta" },
  { metodo: "PATCH", patron: /^\/api\/admin\/usuarios\/([^/]+)\/reactivar$/, accion: "sancion", descripcion: "Reactivó la cuenta" },
  { metodo: "POST", patron: /^\/api\/admin\/usuarios\/([^/]+)\/lista-negra$/, accion: "sancion", descripcion: "Envió la cuenta a la lista negra" },
];

function actorDeLaPeticion(req: Request): {
  actorTipo: "usuario" | "comprador" | "visitante";
  actorId: string | null;
} {
  const cabecera = req.headers.authorization;
  if (cabecera?.startsWith("Bearer ")) {
    try {
      const datos = jwt.verify(
        cabecera.slice(7),
        process.env.JWT_SECRET as string,
      ) as { id?: string | number };
      if (datos.id !== undefined) {
        return { actorTipo: "usuario", actorId: String(datos.id) };
      }
    } catch {
      return { actorTipo: "visitante", actorId: null };
    }
  }
  const comprador = req.headers["x-comprador-id"];
  if (typeof comprador === "string" && comprador) {
    return { actorTipo: "comprador", actorId: comprador };
  }
  return { actorTipo: "visitante", actorId: null };
}

export async function registrarAccion(datos: {
  actorTipo: "usuario" | "comprador" | "visitante" | "sistema";
  actorId?: string | null;
  actorNombre?: string | null;
  accion: string;
  descripcion: string;
  ruta?: string | null;
}): Promise<void> {
  try {
    await BitacoraAccion.create(datos);
  } catch (error) {
    console.error(
      "[bitacora] No se pudo registrar la acción:",
      error instanceof Error ? error.message : error,
    );
  }
}

export function bitacoraDeAcciones(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const ruta = req.originalUrl.split("?")[0];
  const regla = REGLAS.find(
    (candidata) => candidata.metodo === req.method && candidata.patron.test(ruta),
  );
  if (!regla) return next();

  const actor = actorDeLaPeticion(req);
  const correo =
    regla.accion === "inicio_sesion" || regla.accion === "registro"
      ? String(req.body?.correo ?? "").trim().toLowerCase() || null
      : null;
  const usuarioAfectado =
    regla.accion === "sancion" ? ruta.match(regla.patron)?.[1] : undefined;

  res.on("finish", () => {
    if (res.statusCode >= 400) return;
    void registrarAccion({
      actorTipo: correo ? "usuario" : actor.actorTipo,
      actorId: actor.actorId,
      actorNombre: correo,
      accion: regla.accion,
      descripcion: usuarioAfectado
        ? `${regla.descripcion} del usuario ${usuarioAfectado}`
        : regla.descripcion,
      ruta,
    });
  });
  next();
}

export async function consultarBitacora(filtros: {
  accion?: string;
  actor?: string;
  limite?: number;
}) {
  const condicion: Record<string, unknown> = {};
  if (filtros.accion) condicion.accion = filtros.accion;
  if (filtros.actor) {
    const texto = filtros.actor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    condicion.$or = [
      { actorId: filtros.actor },
      { actorNombre: new RegExp(texto, "i") },
    ];
  }
  const limite = Math.min(Math.max(Number(filtros.limite) || 200, 1), 500);
  return BitacoraAccion.find(condicion)
    .sort({ createdAt: -1 })
    .limit(limite)
    .lean();
}
