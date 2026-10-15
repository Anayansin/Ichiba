import { Response } from "express";
import clientePrisma from "../configuracion/prisma.js";
import { InformeVendedor } from "../models/InformeVendedor.js";
import { InformeGlobal } from "../models/InformeGlobal.js";
import {
  esPeriodoValido,
  generarInformesMensuales,
  listarInformesGlobales as listarInformesGlobalesServicio,
  periodoAnterior,
  periodoDeFecha,
  resumirInformeGlobal,
} from "../services/informesService.js";
import {
  pdfDeInformeVendedor,
  pdfDeInformeGlobal,
} from "../services/pdfInformes.js";
import { RequestConUsuario } from "../middleware/auth.js";

/**
 * RQF13 / RQNF13.3: el vendedor consulta y descarga en PDF el historial de
 * sus informes mensuales de ventas.
 * RQF14: el administrador consulta y descarga los informes globales.
 */

function resumirInformeVendedor(informe: Record<string, any>) {
  return {
    periodo: informe.periodo,
    generadoEn: informe.generadoEn ?? null,
    totalVentas: Number(informe.totalVentas ?? 0),
    ingresos: Number(informe.ingresos ?? 0),
    productosVendidos: (informe.productosVendidos ?? []).map(
      (producto: Record<string, any>) => ({
        productoId: String(producto.productoId ?? ""),
        nombre: String(producto.nombre ?? ""),
        cantidad: Number(producto.cantidad ?? 0),
        monto: Number(producto.monto ?? 0),
      }),
    ),
    filasIniciadas: Number(informe.filasIniciadas ?? 0),
    ventasConcluidas: Number(informe.ventasConcluidas ?? 0),
    tasaConcertacion: Number(informe.tasaConcertacion ?? 0),
    tiempoPromedioFilaMinutos:
      informe.tiempoPromedioFilaMinutos === null ||
      informe.tiempoPromedioFilaMinutos === undefined
        ? null
        : Number(informe.tiempoPromedioFilaMinutos),
  };
}

export async function listarInformesDelVendedor(
  req: RequestConUsuario,
  res: Response,
) {
  try {
    const vendedorId = String(req.usuarioId);
    const informes = await InformeVendedor.find({ vendedorId })
      .sort({ periodo: -1 })
      .lean();

    res.json({
      informes: informes.map(resumirInformeVendedor),
    });
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al obtener tus informes de ventas" });
  }
}

export async function descargarInformeDelVendedor(
  req: RequestConUsuario,
  res: Response,
) {
  try {
    const vendedorId = String(req.usuarioId);
    const { periodo } = req.params;

    if (!esPeriodoValido(periodo)) {
      return res
        .status(400)
        .json({ message: "El período debe tener el formato YYYY-MM" });
    }

    const informe = await InformeVendedor.findOne({
      vendedorId,
      periodo,
    }).lean();

    if (!informe) {
      return res.status(404).json({ message: "Informe no encontrado" });
    }

    const vendedor = await clientePrisma.usuario.findUnique({
      where: { id: Number(req.usuarioId) },
      select: { nombreCompleto: true, correo: true },
    });

    const pdf = await pdfDeInformeVendedor(
      resumirInformeVendedor(informe),
      vendedor ?? { nombreCompleto: "Vendedor", correo: "" },
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="informe-ventas-${periodo}.pdf"`,
    );
    res.send(pdf);
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al generar el PDF del informe" });
  }
}

export async function listarInformesGlobales(
  _req: RequestConUsuario,
  res: Response,
) {
  try {
    res.json({ informes: await listarInformesGlobalesServicio() });
  } catch (error) {
    console.error("Error real:", error);
    res
      .status(500)
      .json({ message: "Error al obtener los informes globales" });
  }
}

export async function descargarInformeGlobal(
  req: RequestConUsuario,
  res: Response,
) {
  try {
    const { periodo } = req.params;

    if (!esPeriodoValido(periodo)) {
      return res
        .status(400)
        .json({ message: "El período debe tener el formato YYYY-MM" });
    }

    const informe = await InformeGlobal.findOne({ periodo }).lean();
    if (!informe) {
      return res.status(404).json({ message: "Informe no encontrado" });
    }

    const pdf = await pdfDeInformeGlobal(resumirInformeGlobal(informe));

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="informe-global-${periodo}.pdf"`,
    );
    res.send(pdf);
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al generar el PDF del informe" });
  }
}

/**
 * RQNF13.2 / RQNF14: permite generar (o regenerar) manualmente los informes
 * de un mes. El sistema lo hace solo cada día 1°; este endpoint sirve para
 * recuperar meses que quedaron pendientes o para pruebas controladas.
 */
export async function generarInformesAdmin(
  req: RequestConUsuario,
  res: Response,
) {
  try {
    const solicitado =
      typeof req.body?.periodo === "string" ? req.body.periodo : "";
    const periodo = solicitado || periodoAnterior(periodoDeFecha(new Date()));

    if (!esPeriodoValido(periodo)) {
      return res
        .status(400)
        .json({ message: "El período debe tener el formato YYYY-MM" });
    }

    const resultado = await generarInformesMensuales(periodo);
    res.json({
      message: `Informes de ${periodo} generados`,
      ...resultado,
    });
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al generar los informes" });
  }
}
