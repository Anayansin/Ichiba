import PDFDocument from "pdfkit";

/**
 * RQF13 / RQNF13.3 / RQF14: los informes mensuales se descargan en PDF.
 * El PDF se arma al momento de la descarga a partir del informe guardado, por
 * lo que el historial completo puede descargarse en cualquier momento.
 */

const MARGEN = 50;
const ANCHO_UTIL = 595.28 - MARGEN * 2;
const COLOR_ROJO = "#d90429";
const COLOR_TEXTO = "#1a1a1a";
const COLOR_GRIS = "#666666";

const formatoMoneda = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

function moneda(valor: number): string {
  return formatoMoneda.format(Number(valor) || 0);
}

function numero(valor: number): string {
  return new Intl.NumberFormat("es-MX").format(Number(valor) || 0);
}

function porcentaje(valor: number): string {
  return `${(Number(valor) || 0).toFixed(1)}%`;
}

function recolectar(documento: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolver, rechazar) => {
    const partes: Buffer[] = [];
    documento.on("data", (parte: Buffer) => partes.push(parte));
    documento.on("end", () => resolver(Buffer.concat(partes)));
    documento.on("error", rechazar);
    documento.end();
  });
}

function encabezado(documento: PDFKit.PDFDocument, titulo: string, subtitulo: string) {
  documento
    .fillColor(COLOR_ROJO)
    .fontSize(22)
    .font("Helvetica-Bold")
    .text("ICHBA", MARGEN, MARGEN);
  documento
    .fillColor(COLOR_TEXTO)
    .fontSize(15)
    .font("Helvetica-Bold")
    .text(titulo, MARGEN, MARGEN + 30);
  documento
    .fillColor(COLOR_GRIS)
    .fontSize(10)
    .font("Helvetica")
    .text(subtitulo, MARGEN, MARGEN + 50);
  documento
    .moveTo(MARGEN, MARGEN + 70)
    .lineTo(MARGEN + ANCHO_UTIL, MARGEN + 70)
    .strokeColor(COLOR_ROJO)
    .stroke();
}

function tituloSeccion(documento: PDFKit.PDFDocument, texto: string) {
  documento
    .fillColor(COLOR_TEXTO)
    .fontSize(13)
    .font("Helvetica-Bold")
    .text(texto, MARGEN, documento.y + 12);
}

type Columna = { titulo: string; ancho: number; alineacion?: "left" | "right" };

function tabla(
  documento: PDFKit.PDFDocument,
  columnas: Columna[],
  filas: string[][],
) {
  const yInicial = documento.y + 8;
  let x = MARGEN;

  documento.fontSize(9).font("Helvetica-Bold").fillColor(COLOR_GRIS);
  for (const columna of columnas) {
    documento.text(columna.titulo, x, yInicial, {
      width: columna.ancho,
      align: columna.alineacion ?? "left",
    });
    x += columna.ancho;
  }

  documento
    .moveTo(MARGEN, yInicial + 14)
    .lineTo(MARGEN + ANCHO_UTIL, yInicial + 14)
    .strokeColor("#cccccc")
    .stroke();

  let y = yInicial + 20;
  documento.font("Helvetica").fillColor(COLOR_TEXTO);
  for (const fila of filas) {
    x = MARGEN;
    for (let indice = 0; indice < columnas.length; indice += 1) {
      documento.fontSize(10).text(fila[indice] ?? "", x, y, {
        width: columnas[indice].ancho,
        align: columnas[indice].alineacion ?? "left",
      });
      x += columnas[indice].ancho;
    }
    y += 18;
    if (y > 700) {
      documento.addPage();
      y = MARGEN;
    }
  }
  documento.y = y;
}

export type InformeVendedorPdf = {
  periodo: string;
  generadoEn?: Date | string | null;
  totalVentas: number;
  ingresos: number;
  productosVendidos: {
    nombre: string;
    cantidad: number;
    monto: number;
  }[];
  filasIniciadas: number;
  ventasConcluidas: number;
  tasaConcertacion: number;
  tiempoPromedioFilaMinutos: number | null;
};

/** RQF13 / RQNF13.3: PDF del informe mensual de ventas del vendedor. */
export function pdfDeInformeVendedor(
  informe: InformeVendedorPdf,
  vendedor: { nombreCompleto: string; correo: string },
): Promise<Buffer> {
  const documento = new PDFDocument({ size: "A4", margin: MARGEN });

  encabezado(
    documento,
    `Informe de ventas de ${informe.periodo}`,
    `Vendedor: ${vendedor.nombreCompleto} (${vendedor.correo})`,
  );

  tituloSeccion(documento, "Totales del período (RQNF13.1)");
  documento.fontSize(11).font("Helvetica").fillColor(COLOR_TEXTO);
  documento.text(`• Total de ventas del período: ${numero(informe.totalVentas)}`);
  documento.text(`• Ingresos del período: ${moneda(informe.ingresos)}`);
  documento.text(
    `• Tasa de concertación (ventas concluidas / filas iniciadas): ${porcentaje(
      informe.tasaConcertacion,
    )} (${numero(informe.ventasConcluidas)} de ${numero(
      informe.filasIniciadas,
    )} filas iniciadas)`,
  );
  documento.text(
    `• Tiempo promedio por fila (todos sus productos): ${
      informe.tiempoPromedioFilaMinutos === null
        ? "sin filas cerradas en el período"
        : `${informe.tiempoPromedioFilaMinutos.toFixed(1)} minutos`
    }`,
  );

  tituloSeccion(documento, "Productos vendidos");
  if (informe.productosVendidos.length === 0) {
    documento
      .fontSize(10)
      .font("Helvetica")
      .fillColor(COLOR_GRIS)
      .text("No hubo productos vendidos en el período.");
  } else {
    tabla(
      documento,
      [
        { titulo: "Producto", ancho: ANCHO_UTIL - 200 },
        { titulo: "Vendidos", ancho: 80, alineacion: "right" },
        { titulo: "Monto", ancho: 120, alineacion: "right" },
      ],
      informe.productosVendidos.map((producto) => [
        producto.nombre,
        numero(producto.cantidad),
        moneda(producto.monto),
      ]),
    );
  }

  documento
    .fontSize(8)
    .fillColor(COLOR_GRIS)
    .text(
      `Informe generado automáticamente el día 1° de cada mes (RQNF13.2)${
        informe.generadoEn
          ? ` · Generado: ${new Date(informe.generadoEn).toLocaleString("es-MX")}`
          : ""
      }`,
      MARGEN,
      760,
    );

  return recolectar(documento);
}

export type InformeGlobalPdf = {
  periodo: string;
  generadoEn?: Date | string | null;
  categoriaMasVendida: { categoria: string; ventas: number } | null;
  empate: boolean;
  porCategoria: {
    categoria: string;
    ventas: number;
    filasIniciadas: number;
    filasAbandonadas: number;
    tasaAbandono: number;
  }[];
};

/** RQF14: PDF del informe global mensual de la plataforma (administrador). */
export function pdfDeInformeGlobal(informe: InformeGlobalPdf): Promise<Buffer> {
  const documento = new PDFDocument({ size: "A4", margin: MARGEN });

  encabezado(
    documento,
    `Informe global de la plataforma ${informe.periodo}`,
    "Categoría más vendida y tasa de abandono de fila por categoría",
  );

  tituloSeccion(documento, "Categoría más vendida (RQNF14)");
  documento.fontSize(11).font("Helvetica").fillColor(COLOR_TEXTO);
  if (informe.categoriaMasVendida) {
    documento.text(
      `• ${informe.categoriaMasVendida.categoria} con ${numero(
        informe.categoriaMasVendida.ventas,
      )} venta(s) concluida(s).`,
    );
  } else if (informe.empate) {
    documento.text(
      "• Empate persistente tras el desempate con el mes anterior: no se muestra una categoría ganadora (RQNF14.2).",
    );
  } else {
    documento.text("• Sin ventas concluidas registradas en el período.");
  }

  tituloSeccion(documento, "Tasa de abandono de fila por categoría (KO9.1)");
  tabla(
    documento,
    [
      { titulo: "Categoría", ancho: ANCHO_UTIL - 330 },
      { titulo: "Ventas", ancho: 70, alineacion: "right" },
      { titulo: "Filas iniciadas", ancho: 100, alineacion: "right" },
      { titulo: "Abandonadas", ancho: 90, alineacion: "right" },
      { titulo: "Tasa", ancho: 70, alineacion: "right" },
    ],
    informe.porCategoria.map((categoria) => [
      categoria.categoria,
      numero(categoria.ventas),
      numero(categoria.filasIniciadas),
      numero(categoria.filasAbandonadas),
      porcentaje(categoria.tasaAbandono),
    ]),
  );

  documento
    .fontSize(8)
    .fillColor(COLOR_GRIS)
    .text(
      `Abandono = filas donde el comprador salió por su cuenta o no completó el pago a tiempo · Informe generado automáticamente el día 1° de cada mes${
        informe.generadoEn
          ? ` · Generado: ${new Date(informe.generadoEn).toLocaleString("es-MX")}`
          : ""
      }`,
      MARGEN,
      760,
    );

  return recolectar(documento);
}
