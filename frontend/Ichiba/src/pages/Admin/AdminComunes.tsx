import { useEffect, useState } from "react";
import {
  fetchConversacionAdmin,
  type DetalleConversacionAdmin,
  type TipoConversacion,
} from "../../services/adminTotalService";
import { URL_BACKEND } from "../../services/api";
import { mensajeDeError } from "../../utils/errores";
import "./AdminTotal.css";

export const dinero = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

export function formatearFecha(valor: string | null | undefined): string {
  if (!valor) return "Sin fecha";
  return new Date(valor).toLocaleString("es-MX", {
    timeZone: "America/Mexico_City",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function Paginacion({
  pagina,
  totalPaginas,
  onCambiar,
}: {
  pagina: number;
  totalPaginas: number;
  onCambiar: (pagina: number) => void;
}) {
  if (totalPaginas <= 1) return null;
  return (
    <div className="admin-t__paginacion">
      <button
        type="button"
        disabled={pagina <= 1}
        onClick={() => onCambiar(pagina - 1)}
      >
        Anterior
      </button>
      <span>
        Página {pagina} de {totalPaginas}
      </span>
      <button
        type="button"
        disabled={pagina >= totalPaginas}
        onClick={() => onCambiar(pagina + 1)}
      >
        Siguiente
      </button>
    </div>
  );
}

const TEXTO_ROL: Record<string, string> = {
  vendedor: "Vendedor",
  comprador: "Comprador",
  visitante: "Visitante",
};

// Conversación completa de una venta, una consulta o los comentarios de un
// promocional, con los mensajes reportados resaltados.
export function ModalConversacionAdmin({
  tipo,
  id,
  onCerrar,
}: {
  tipo: TipoConversacion;
  id: string;
  onCerrar: () => void;
}) {
  const [detalle, setDetalle] = useState<DetalleConversacionAdmin | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchConversacionAdmin(tipo, id)
      .then(setDetalle)
      .catch((err) =>
        setError(mensajeDeError(err) || "No se pudo cargar la conversación"),
      );
  }, [tipo, id]);

  const venta = detalle?.venta;

  return (
    <div className="admin-t__fondo" onClick={onCerrar}>
      <div
        className="admin-t__modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="admin-t__modal-cabecera">
          <div>
            <h3>{detalle?.titulo ?? "Conversación"}</h3>
            <p>
              {venta
                ? `${venta.vendedorNombre} (vendedor) y ${venta.compradorNombre}`
                : detalle?.participantes}
            </p>
          </div>
          <button
            type="button"
            className="admin-t__cerrar"
            onClick={onCerrar}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="admin-t__modal-cuerpo">
          {error && <p className="admin-t__error">{error}</p>}
          {!detalle && !error && (
            <p className="admin-t__cargando">Cargando conversación...</p>
          )}

          {venta && (
            <div className="admin-t__resumen">
              <p>
                <strong>Venta:</strong> {venta.ventaIdPg ?? venta._id} ·{" "}
                {dinero.format(venta.monto)} · {venta.estadoTexto}
              </p>
              <p>
                <strong>Motivo:</strong> {venta.motivo}
              </p>
              {venta.disputa && (
                <>
                  <p>
                    <strong>Disputa ({venta.disputa.estado}):</strong>{" "}
                    {venta.disputa.motivo}
                    {venta.disputa.descripcion &&
                      ` — ${venta.disputa.descripcion}`}
                  </p>
                  {venta.disputa.respuestaVendedor && (
                    <p>
                      <strong>Respuesta del vendedor:</strong>{" "}
                      {venta.disputa.respuestaVendedor}
                    </p>
                  )}
                </>
              )}
              {detalle?.reportesDeLaVenta?.map((reporte, i) => (
                <p key={i}>
                  <strong>Reporte ({reporte.estado}):</strong>{" "}
                  {reporte.categoria}
                  {reporte.detalle && ` — ${reporte.detalle}`}
                </p>
              ))}
            </div>
          )}

          {detalle && detalle.mensajes.length === 0 && (
            <p className="admin-t__vacio">Esta conversación no tiene mensajes.</p>
          )}

          <div className="admin-t__mensajes">
            {detalle?.mensajes.map((mensaje) => (
              <div
                key={mensaje._id}
                className={`admin-t__mensaje admin-t__mensaje--${mensaje.rol} ${
                  mensaje.reportes.length ? "admin-t__mensaje--reportado" : ""
                }`}
              >
                <div className="admin-t__mensaje-autor">
                  <span>
                    {mensaje.autor} · {TEXTO_ROL[mensaje.rol] ?? mensaje.rol}
                  </span>
                  <span>{formatearFecha(mensaje.fecha)}</span>
                </div>
                {mensaje.contenido && <p>{mensaje.contenido}</p>}
                {mensaje.imagen && (
                  <img src={`${URL_BACKEND}${mensaje.imagen}`} alt="Imagen enviada" />
                )}
                {mensaje.reportes.map((reporte, i) => (
                  <div key={i} className="admin-t__mensaje-reporte">
                    Reportado: {reporte.categoria}
                    {reporte.detalle && ` — ${reporte.detalle}`}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
