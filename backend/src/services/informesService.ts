import clientePrisma from "../configuracion/prisma.js";
import { CATEGORIAS_PRODUCTO } from "../configuracion/categorias.js";
import { Producto } from "../models/producto.js";
import { InformeVendedor } from "../models/InformeVendedor.js";
import { InformeGlobal } from "../models/InformeGlobal.js";

/**
 * RQF13 / RQF14: informes mensuales.
 *
 * - RQNF13.1 / RQNF13.2: cada 1° de mes se genera el informe del mes recién
 *   concluido para cada vendedor con actividad: total de ventas del período,
 *   productos vendidos, tiempo promedio por fila (todos sus productos) y tasa
 *   de concertación (ventas concluidas / filas iniciadas, KO6.1).
 * - RQNF13.3: los informes quedan en el historial y se descargan en PDF.
 * - RQF14 / RQNF14 / RQNF14.2 (KO9.1): informe global con la categoría más
 *   vendida (con desempate por el mes anterior) y la tasa de abandono de fila
 *   por categoría (salieron de la fila o no pagaron a tiempo).
 * - RQNF14.1: el día 1° del mes en que un reporte o informe cumple 13 meses se
 *   elimina de forma permanente (solo ese registro).
 */

/** RQNF14.2 (KO9.1): causas que cuentan como abandono de fila. */
export const MOTIVOS_ABANDONO = ["salio_voluntariamente", "turno_vencido"];

type Fila = Record<string, any>;

function redondear(valor: number, decimales = 1): number {
  const factor = 10 ** decimales;
  return Math.round(valor * factor) / factor;
}

// ---------------------------------------------------------------------------
// Períodos mensuales ("YYYY-MM")
// ---------------------------------------------------------------------------

export function esPeriodoValido(periodo: unknown): periodo is string {
  return typeof periodo === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(periodo);
}

export function periodoDeFecha(fecha: Date): string {
  const anio = fecha.getUTCFullYear();
  const mes = String(fecha.getUTCMonth() + 1).padStart(2, "0");
  return `${anio}-${mes}`;
}

export function rangoDePeriodo(periodo: string): { inicio: Date; fin: Date } {
  const [anio, mes] = periodo.split("-").map(Number);
  return {
    inicio: new Date(Date.UTC(anio, mes - 1, 1)),
    fin: new Date(Date.UTC(anio, mes, 1)),
  };
}

export function sumarPeriodos(periodo: string, meses: number): string {
  const [anio, mes] = periodo.split("-").map(Number);
  return periodoDeFecha(new Date(Date.UTC(anio, mes - 1 + meses, 1)));
}

export function periodoAnterior(periodo: string): string {
  return sumarPeriodos(periodo, -1);
}

/**
 * Normaliza las fechas que devuelve PostgreSQL. Los `DateTime` llegan como
 * `Date`, pero las columnas `temporal.updatedAtString()` llegan como texto
 * `"2026-10-05 19:27:42.809-06"`; se convierten aquí para poder compararlas.
 */
export function fechaDeValor(valor: unknown): Date | null {
  if (valor instanceof Date) {
    return Number.isNaN(valor.getTime()) ? null : valor;
  }
  if (typeof valor !== "string") return null;

  const conT = /^\d{4}-\d{2}-\d{2}T/.test(valor);
  if (conT) {
    const fecha = new Date(valor);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
  }

  const partes = valor.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?([+-])(\d{2})(?::?(\d{2}))?$/,
  );
  if (!partes) return null;

  const [
    ,
    anio,
    mes,
    dia,
    hora,
    minuto,
    segundo,
    fraccion,
    signo,
    horasZona,
    minutosZona,
  ] = partes;
  const milisegundos = Number(`0.${fraccion ?? "0"}`) * 1000;
  const desplazamiento =
    (signo === "-" ? -1 : 1) *
    (Number(horasZona ?? "0") * 60 + Number(minutosZona ?? "0")) *
    60 *
    1000;
  const base = Date.UTC(
    Number(anio),
    Number(mes) - 1,
    Number(dia),
    Number(hora),
    Number(minuto),
    Number(segundo),
    milisegundos,
  );
  return new Date(base - desplazamiento);
}

export function enPeriodo(fecha: unknown, periodo: string): boolean {
  const valor = fechaDeValor(fecha);
  if (!valor) return false;
  const { inicio, fin } = rangoDePeriodo(periodo);
  return valor.getTime() >= inicio.getTime() && valor.getTime() < fin.getTime();
}

// ---------------------------------------------------------------------------
// Generación de informes
// ---------------------------------------------------------------------------

type DatosProducto = {
  productoId: string;
  nombre: string;
  categoria: string | null;
  vendedorId: string | null;
};

async function cargarProductos(ids: Iterable<string>): Promise<Map<string, DatosProducto>> {
  const validos = [...new Set(ids)].filter((id) =>
    /^[0-9a-fA-F]{24}$/.test(id),
  );
  if (validos.length === 0) return new Map();

  const productos = await Producto.find({ _id: { $in: validos } }).select(
    "nombre categoria vendedorId",
  );

  return new Map(
    productos.map((producto) => [
      String(producto._id),
      {
        productoId: String(producto._id),
        nombre: producto.nombre ?? "",
        categoria: producto.categoria ?? null,
        vendedorId:
          producto.vendedorId === undefined || producto.vendedorId === null
            ? null
            : String(producto.vendedorId),
      },
    ]),
  );
}

function categoriaDeVenta(
  venta: Fila,
  productos: Map<string, DatosProducto>,
): string | null {
  return (
    (typeof venta.productoCategoria === "string" && venta.productoCategoria) ||
    productos.get(String(venta.productoId))?.categoria ||
    null
  );
}

/**
 * RQNF13.1 / RQNF13.2: genera (o regenera) los informes de todos los
 * vendedores con actividad en `periodo` y el informe global de la plataforma.
 */
export async function generarInformesMensuales(periodo: string): Promise<{
  periodo: string;
  vendedores: number;
  ventasConsideradas: number;
  filasConsideradas: number;
  global: { categoriaMasVendida: string | null; empate: boolean };
}> {
  if (!esPeriodoValido(periodo)) {
    throw new Error("El período debe tener el formato YYYY-MM");
  }

  const ventas = (await clientePrisma.venta.findMany({ where: {} })) as Fila[];
  const colas = (await clientePrisma.cola.findMany({ where: {} })) as Fila[];

  // Transacciones concluidas dentro del período (RQNF13.1).
  const ventasDelMes = ventas.filter(
    (venta) =>
      venta.estado === "completada" &&
      enPeriodo(venta.entregadoEn ?? venta.createdAt, periodo),
  );

  // Filas iniciadas dentro del período y filas cerradas dentro del período.
  const colasDelMes = colas.filter((cola) => enPeriodo(cola.createdAt, periodo));
  const colasCerradasDelMes = colas.filter(
    (cola) => cola.estado === "finalizada" && enPeriodo(cola.updatedAt, periodo),
  );

  const productos = await cargarProductos([
    ...ventasDelMes.map((venta) => String(venta.productoId)),
    ...colasDelMes.map((cola) => String(cola.productoId)),
    ...colasCerradasDelMes.map((cola) => String(cola.productoId)),
  ]);

  // --- Informes por vendedor -------------------------------------------------
  const actividad = new Map<
    string,
    {
      ventas: Fila[];
      filasIniciadas: number;
      filasCerradas: Fila[];
    }
  >();

  const actividadDe = (vendedorId: string) => {
    let datos = actividad.get(vendedorId);
    if (!datos) {
      datos = { ventas: [], filasIniciadas: 0, filasCerradas: [] };
      actividad.set(vendedorId, datos);
    }
    return datos;
  };

  for (const venta of ventasDelMes) {
    actividadDe(String(venta.vendedorId)).ventas.push(venta);
  }

  for (const cola of colasDelMes) {
    const vendedorId = productos.get(String(cola.productoId))?.vendedorId;
    if (!vendedorId) continue;
    actividadDe(vendedorId).filasIniciadas += 1;
  }

  for (const cola of colasCerradasDelMes) {
    const vendedorId = productos.get(String(cola.productoId))?.vendedorId;
    if (!vendedorId) continue;
    actividadDe(vendedorId).filasCerradas.push(cola);
  }

  for (const [vendedorId, datos] of actividad) {
    const porProducto = new Map<
      string,
      { productoId: string; nombre: string; cantidad: number; monto: number }
    >();

    for (const venta of datos.ventas) {
      const productoId = String(venta.productoId);
      const entrada = porProducto.get(productoId) ?? {
        productoId,
        nombre:
          (typeof venta.productoNombre === "string" && venta.productoNombre) ||
          productos.get(productoId)?.nombre ||
          "Producto",
        cantidad: 0,
        monto: 0,
      };
      entrada.cantidad += 1;
      entrada.monto += Number(venta.monto ?? 0);
      porProducto.set(productoId, entrada);
    }

    const ingresos = datos.ventas.reduce(
      (total, venta) => total + Number(venta.monto ?? 0),
      0,
    );
    const totalVentas = datos.ventas.length;

    // RQNF13.2 (KO6.1): ventas concluidas / filas iniciadas, en porcentaje.
    const tasaConcertacion =
      datos.filasIniciadas > 0
        ? redondear((totalVentas / datos.filasIniciadas) * 100)
        : 0;

    // RQNF13.1: tiempo promedio por fila (todos sus productos), en minutos.
    const tiempos = datos.filasCerradas
      .map((cola) => {
        const inicio = fechaDeValor(cola.createdAt);
        const fin = fechaDeValor(cola.updatedAt);
        if (!inicio || !fin) return null;
        return Math.max(0, (fin.getTime() - inicio.getTime()) / 60000);
      })
      .filter((minutos): minutos is number => minutos !== null);
    const tiempoPromedioFilaMinutos = tiempos.length
      ? redondear(tiempos.reduce((total, minutos) => total + minutos, 0) / tiempos.length)
      : null;

    await InformeVendedor.findOneAndUpdate(
      { vendedorId, periodo },
      {
        $set: {
          generadoEn: new Date(),
          totalVentas,
          ingresos: redondear(ingresos, 2),
          productosVendidos: [...porProducto.values()].map((entrada) => ({
            ...entrada,
            monto: redondear(entrada.monto, 2),
          })),
          filasIniciadas: datos.filasIniciadas,
          ventasConcluidas: totalVentas,
          tasaConcertacion,
          tiempoPromedioFilaMinutos,
        },
      },
      { upsert: true },
    );
  }

  // --- Informe global (RQF14) ------------------------------------------------
  const global = await generarInformeGlobalDelMes(periodo, {
    ventasDelMes,
    colasDelMes,
    colasCerradasDelMes,
    productos,
  });

  return {
    periodo,
    vendedores: actividad.size,
    ventasConsideradas: ventasDelMes.length,
    filasConsideradas: colasDelMes.length,
    global: {
      categoriaMasVendida: global.categoriaMasVendida?.categoria ?? null,
      empate: global.empate,
    },
  };
}

type DatosGlobales = {
  ventasDelMes: Fila[];
  colasDelMes: Fila[];
  colasCerradasDelMes: Fila[];
  productos: Map<string, DatosProducto>;
};

async function ventasPorCategoriaDePeriodo(
  periodo: string,
  productos: Map<string, DatosProducto>,
): Promise<Map<string, number>> {
  const ventas = (await clientePrisma.venta.findMany({ where: {} })) as Fila[];
  const totales = new Map<string, number>();
  for (const venta of ventas) {
    if (
      venta.estado !== "completada" ||
      !enPeriodo(venta.entregadoEn ?? venta.createdAt, periodo)
    ) {
      continue;
    }
    const categoria = categoriaDeVenta(venta, productos);
    if (!categoria) continue;
    totales.set(categoria, (totales.get(categoria) ?? 0) + 1);
  }
  return totales;
}

async function generarInformeGlobalDelMes(
  periodo: string,
  datos?: DatosGlobales,
): Promise<{
  periodo: string;
  categoriaMasVendida: { categoria: string; ventas: number } | null;
  empate: boolean;
}> {
  let contexto = datos;
  if (!contexto) {
    const ventas = (await clientePrisma.venta.findMany({ where: {} })) as Fila[];
    const colas = (await clientePrisma.cola.findMany({ where: {} })) as Fila[];
    const ventasDelMes = ventas.filter(
      (venta) =>
        venta.estado === "completada" &&
        enPeriodo(venta.entregadoEn ?? venta.createdAt, periodo),
    );
    const colasDelMes = colas.filter((cola) => enPeriodo(cola.createdAt, periodo));
    const colasCerradasDelMes = colas.filter(
      (cola) =>
        cola.estado === "finalizada" && enPeriodo(cola.updatedAt, periodo),
    );
    contexto = {
      ventasDelMes,
      colasDelMes,
      colasCerradasDelMes,
      productos: await cargarProductos([
        ...ventasDelMes.map((venta) => String(venta.productoId)),
        ...colasDelMes.map((cola) => String(cola.productoId)),
        ...colasCerradasDelMes.map((cola) => String(cola.productoId)),
      ]),
    };
  }

  // RQNF14: categoría más vendida = transacciones concluidas por categoría.
  const ventasPorCategoria = new Map<string, number>();
  for (const venta of contexto.ventasDelMes) {
    const categoria = categoriaDeVenta(venta, contexto.productos);
    if (!categoria) continue;
    ventasPorCategoria.set(categoria, (ventasPorCategoria.get(categoria) ?? 0) + 1);
  }

  let categoriaMasVendida: { categoria: string; ventas: number } | null = null;
  let empate = false;

  const candidatas = [...ventasPorCategoria.entries()].sort(
    (a, b) => b[1] - a[1],
  );
  if (candidatas.length > 0) {
    const maximo = candidatas[0][1];
    const empatadas = candidatas.filter(([, ventas]) => ventas === maximo);

    if (empatadas.length === 1) {
      categoriaMasVendida = { categoria: empatadas[0][0], ventas: maximo };
    } else {
      // RQNF14.2: desempate con las ventas de la categoría en el mes anterior.
      const previas = await ventasPorCategoriaDePeriodo(
        periodoAnterior(periodo),
        contexto.productos,
      );
      const ordenadas = [...empatadas].sort(
        (a, b) => (previas.get(b[0]) ?? 0) - (previas.get(a[0]) ?? 0),
      );
      const mejorPrevia = previas.get(ordenadas[0][0]) ?? 0;
      const empatePersistente = ordenadas.filter(
        ([categoria]) => (previas.get(categoria) ?? 0) === mejorPrevia,
      );
      if (empatePersistente.length === 1) {
        categoriaMasVendida = {
          categoria: empatePersistente[0][0],
          ventas: maximo,
        };
      } else {
        // RQNF14.2: si vuelve a haber empate, no se muestra.
        categoriaMasVendida = null;
        empate = true;
      }
    }
  }

  // RQNF14.2 (KO9.1): tasa de abandono de fila por categoría.
  const porCategoria = CATEGORIAS_PRODUCTO.map((categoria) => {
    const filasIniciadas = contexto.colasDelMes.filter(
      (cola) => contexto.productos.get(String(cola.productoId))?.categoria === categoria,
    ).length;
    const filasAbandonadas = contexto.colasCerradasDelMes.filter(
      (cola) =>
        contexto.productos.get(String(cola.productoId))?.categoria ===
          categoria && MOTIVOS_ABANDONO.includes(String(cola.motivoCierre)),
    ).length;

    return {
      categoria,
      ventas: ventasPorCategoria.get(categoria) ?? 0,
      filasIniciadas,
      filasAbandonadas,
      tasaAbandono:
        filasIniciadas > 0 ? redondear((filasAbandonadas / filasIniciadas) * 100) : 0,
    };
  });

  await InformeGlobal.findOneAndUpdate(
    { periodo },
    {
      $set: {
        generadoEn: new Date(),
        categoriaMasVendida,
        empate,
        porCategoria,
      },
    },
    { upsert: true },
  );

  return { periodo, categoriaMasVendida, empate };
}

// ---------------------------------------------------------------------------
// Consulta de informes globales (RQF14 / RQNF13.3)
// ---------------------------------------------------------------------------

/** Formato de salida compartido entre el REST del BackOffice y el MCP. */
export function resumirInformeGlobal(informe: Record<string, any>) {
  return {
    periodo: informe.periodo,
    generadoEn: informe.generadoEn ?? null,
    categoriaMasVendida: informe.categoriaMasVendida
      ? {
          categoria: String(informe.categoriaMasVendida.categoria ?? ""),
          ventas: Number(informe.categoriaMasVendida.ventas ?? 0),
        }
      : null,
    empate: informe.empate === true,
    porCategoria: (informe.porCategoria ?? []).map(
      (categoria: Record<string, any>) => ({
        categoria: String(categoria.categoria ?? ""),
        ventas: Number(categoria.ventas ?? 0),
        filasIniciadas: Number(categoria.filasIniciadas ?? 0),
        filasAbandonadas: Number(categoria.filasAbandonadas ?? 0),
        tasaAbandono: Number(categoria.tasaAbandono ?? 0),
      }),
    ),
  };
}

/** RQF14: historial completo de informes globales, del más reciente al más antiguo. */
export async function listarInformesGlobales() {
  const informes = await InformeGlobal.find().sort({ periodo: -1 }).lean();
  return informes.map(resumirInformeGlobal);
}

// ---------------------------------------------------------------------------
// RQNF14.1: purga de reportes e informes con 13 meses de antigüedad
// ---------------------------------------------------------------------------

/**
 * El día 1° del mes en que un registro cumple 13 meses se elimina de forma
 * permanente únicamente ese registro:
 *
 * - los reportes (quejas) creados en el mes M-13;
 * - los informes mensuales (por vendedor y globales) del período M-13.
 */
export async function purgarReportesEInformesAntiguos(ahora = new Date()): Promise<{
  periodo: string;
  reportes: number;
  informesVendedor: number;
  informesGlobales: number;
}> {
  const periodoAPurgar = sumarPeriodos(periodoDeFecha(ahora), -13);

  // Reportes (quejas): contador individual por fecha de creación.
  const reportes = (await clientePrisma.reporte.findMany({ where: {} })) as Fila[];
  const idsAntiguos = reportes
    .filter((reporte) => enPeriodo(reporte.createdAt, periodoAPurgar))
    .map((reporte) => Number(reporte.id));
  let reportesBorrados = 0;
  if (idsAntiguos.length > 0) {
    const resultado = await clientePrisma.reporte.deleteMany({
      where: { id: { in: idsAntiguos } },
    });
    reportesBorrados = resultado.count;
  }

  const informesVendedor = await InformeVendedor.deleteMany({
    periodo: periodoAPurgar,
  });
  const informesGlobales = await InformeGlobal.deleteMany({
    periodo: periodoAPurgar,
  });

  return {
    periodo: periodoAPurgar,
    reportes: reportesBorrados,
    informesVendedor: informesVendedor.deletedCount ?? 0,
    informesGlobales: informesGlobales.deletedCount ?? 0,
  };
}
