import api from "./api";

/**
 * RQF13 / RQF14: informes mensuales.
 * El vendedor consulta y descarga sus informes de ventas en PDF; el
 * administrador consulta y descarga los informes globales de la plataforma.
 */

export type ProductoVendido = {
  productoId: string;
  nombre: string;
  cantidad: number;
  monto: number;
};

export type InformeVendedor = {
  periodo: string;
  generadoEn: string | null;
  totalVentas: number;
  ingresos: number;
  productosVendidos: ProductoVendido[];
  filasIniciadas: number;
  ventasConcluidas: number;
  tasaConcertacion: number;
  tiempoPromedioFilaMinutos: number | null;
};

export type CategoriaGlobal = {
  categoria: string;
  ventas: number;
  filasIniciadas: number;
  filasAbandonadas: number;
  tasaAbandono: number;
};

export type InformeGlobal = {
  periodo: string;
  generadoEn: string | null;
  categoriaMasVendida: { categoria: string; ventas: number } | null;
  empate: boolean;
  porCategoria: CategoriaGlobal[];
};

async function descargarPdf(ruta: string, nombreArchivo: string) {
  const response = await api.get(ruta, { responseType: "blob" });
  const blobUrl = URL.createObjectURL(response.data);
  const enlace = document.createElement("a");
  enlace.href = blobUrl;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(blobUrl);
}

export async function fetchInformesDelVendedor(): Promise<
  InformeVendedor[]
> {
  const response = await api.get("/informes");
  return response.data.informes;
}

export async function descargarInformeVendedorPdf(periodo: string) {
  await descargarPdf(
    `/informes/${periodo}/pdf`,
    `informe-ventas-${periodo}.pdf`,
  );
}

export async function fetchInformesGlobales(): Promise<InformeGlobal[]> {
  const response = await api.get("/admin/informes");
  return response.data.informes;
}

export async function descargarInformeGlobalPdf(periodo: string) {
  await descargarPdf(
    `/admin/informes/${periodo}/pdf`,
    `informe-global-${periodo}.pdf`,
  );
}

export async function generarInformesDelPeriodo(periodo: string) {
  const response = await api.post("/admin/informes/generar", { periodo });
  return response.data as {
    message: string;
    periodo: string;
    vendedores: number;
    ventasConsideradas: number;
    filasConsideradas: number;
    global: { categoriaMasVendida: string | null; empate: boolean };
  };
}
