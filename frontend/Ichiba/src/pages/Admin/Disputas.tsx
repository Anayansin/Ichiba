import { useCallback, useEffect, useState } from "react";
import {
  CAUSAS_ADEUDO_ADMIN,
  fetchDisputasAdmin,
  resolverDisputaAdmin,
  resolverVentaRetenidaAdmin,
  type DisputaAdmin,
  type RespuestaDisputas,
  type VentaRetenidaAdmin,
} from "../../services/adminService";
import { fetchEvidenciaDisputa } from "../../services/pagoService";
import {
  suscribirse,
  type EventoDisputa,
} from "../../services/suscripcionesService";
import { mensajeDeError } from "../../utils/errores";
import "./Disputas.css";

/** Fase 4/7b: la bandeja se refresca al instante cuando cambia una disputa. */
const CONSULTA_DISPUTAS = `
  subscription DisputasEnVivo {
    disputasActualizadas { tipo mensaje abiertas generadoEn }
  }
`;

const POR_PAGINA = 10;

const dinero = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

const fechaFormato = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function textoEstadoDisputa(estado: string): string {
  const textos: Record<string, string> = {
    abierta: "Abierta — en revisión",
    reembolsada: "Reembolsada al comprador",
    rechazada: "Rechazada",
  };
  return textos[estado] ?? estado;
}

function textoEstadoVenta(estado: string | null): string {
  const textos: Record<string, string> = {
    pendiente_comprobante: "Pendiente de comprobante",
    pendiente_confirmacion: "Comprobante por confirmar",
    en_entrega: "En entrega",
    completada: "Completada",
    reembolsada: "Reembolsada",
    cancelada: "Cancelada",
  };
  return estado ? textos[estado] ?? estado : "—";
}

/**
 * RQF40: las evidencias solo las ven las partes y la administración, así que
 * se descargan con las cabeceras de sesión y se muestran como blob.
 */
function Evidencias({
  disputaId,
  lado,
  cantidad,
}: {
  disputaId: string;
  lado: "comprador" | "vendedor";
  cantidad: number;
}) {
  const [urls, setUrls] = useState<string[]>([]);

  useEffect(() => {
    if (cantidad === 0) {
      setUrls([]);
      return;
    }

    let activo = true;
    const creadas: string[] = [];

    (async () => {
      for (let indice = 0; indice < cantidad; indice += 1) {
        try {
          const url = await fetchEvidenciaDisputa(disputaId, lado, indice);
          creadas.push(url);
          if (activo) setUrls([...creadas]);
        } catch {
          // Una evidencia ilegible no rompe la tarjeta.
        }
      }
    })();

    return () => {
      activo = false;
      for (const url of creadas) URL.revokeObjectURL(url);
    };
  }, [disputaId, lado, cantidad]);

  if (cantidad === 0) return null;

  return (
    <div className="admin-disputas__evidencias">
      {urls.map((url, indice) => (
        <a
          key={url}
          href={url}
          target="_blank"
          rel="noreferrer"
          title="Ver evidencia en tamaño completo"
        >
          <img src={url} alt={`Evidencia ${indice + 1} del ${lado}`} />
        </a>
      ))}
      {urls.length < cantidad && (
        <span className="admin-disputas__evidencias-cargando">
          Cargando evidencias…
        </span>
      )}
    </div>
  );
}

function Disputas() {
  const [datos, setDatos] = useState<RespuestaDisputas | null>(null);
  const [pagina, setPagina] = useState(1);
  const [estado, setEstado] = useState("abierta");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [notasRetenidas, setNotasRetenidas] = useState<Record<number, string>>(
    {},
  );
  const [causasRetenidas, setCausasRetenidas] = useState<
    Record<number, string>
  >({});
  const [accionEnCurso, setAccionEnCurso] = useState<string | null>(null);

  const cargar = useCallback(
    async (silencioso = false, paginaPedida = pagina, estadoPedido = estado) => {
      if (!silencioso) setCargando(true);
      setError("");
      try {
        setDatos(
          await fetchDisputasAdmin(
            paginaPedida,
            POR_PAGINA,
            estadoPedido || undefined,
          ),
        );
      } catch (err) {
        setError(mensajeDeError(err) || "No pudimos cargar las disputas");
      } finally {
        if (!silencioso) setCargando(false);
      }
    },
    [pagina, estado],
  );

  useEffect(() => {
    cargar(false, pagina, estado);

    // Fase 4/7b: una disputa nueva, respondida o resuelta aparece al
    // instante; el respaldo es la relectura manual.
    return suscribirse<EventoDisputa>(
      CONSULTA_DISPUTAS,
      "disputasActualizadas",
      (evento) => {
        setAviso(`${evento.mensaje} · ${evento.abiertas} disputa(s) abierta(s)`);
        cargar(true, pagina, estado);
      },
      (err) => console.warn("Suscripción de disputas no disponible:", err),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagina, estado]);

  async function dictaminarDisputa(
    disputa: DisputaAdmin,
    dictamen: "reembolsar" | "rechazar",
  ) {
    const esReembolso = dictamen === "reembolsar";
    const confirmado = window.confirm(
      esReembolso
        ? `¿Reembolsar ${dinero.format(disputa.monto)} al comprador? El vendedor quedará con un adeudo por el monto (RQNF37) y su cuenta suspendida hasta liquidarlo (RQNF38).`
        : "¿Rechazar esta disputa? La retención se retirará solo si no quedan reportes ni disputas vivas sobre la venta (RQNF32).",
    );
    if (!confirmado) return;

    setError("");
    setAviso("");
    setAccionEnCurso(disputa.id);

    try {
      const respuesta = await resolverDisputaAdmin(
        disputa.id,
        dictamen,
        notas[disputa.id],
      );
      setAviso(respuesta.message);
      await cargar(true, pagina, estado);
    } catch (err) {
      setError(mensajeDeError(err) || "No pudimos resolver la disputa");
    } finally {
      setAccionEnCurso(null);
    }
  }

  async function dictaminarVentaRetenida(
    venta: VentaRetenidaAdmin,
    dictamen: "reembolsar" | "liberar",
  ) {
    const esReembolso = dictamen === "reembolsar";
    const confirmado = window.confirm(
      esReembolso
        ? `¿Reembolsar ${dinero.format(venta.monto)} al comprador de la venta ${venta.ventaId}?`
        : `¿Retirar la retención preventiva de la venta ${venta.ventaId}? La venta continuará su flujo normal.`,
    );
    if (!confirmado) return;

    setError("");
    setAviso("");
    setAccionEnCurso(`venta-${venta.ventaId}`);

    try {
      const respuesta = await resolverVentaRetenidaAdmin(
        venta.ventaId,
        dictamen,
        {
          causaAdeudo: causasRetenidas[venta.ventaId] || undefined,
          nota: notasRetenidas[venta.ventaId],
        },
      );
      setAviso(respuesta.message);
      await cargar(true, pagina, estado);
    } catch (err) {
      setError(mensajeDeError(err) || "No pudimos resolver la venta retenida");
    } finally {
      setAccionEnCurso(null);
    }
  }

  if (cargando && !datos) {
    return <p className="admin-disputas__vacio">Cargando disputas…</p>;
  }

  const disputas = datos?.disputas ?? [];
  const retenidas = datos?.ventasRetenidas ?? [];

  return (
    <div className="admin-disputas">
      <div className="admin-disputas__cabecera">
        <h2>Disputas de reembolso</h2>
        <span>
          {datos?.abiertas ?? 0} abierta(s) · {datos?.total ?? 0} en total
        </span>
        <select
          className="admin-disputas__filtro"
          value={estado}
          onChange={(evento) => {
            setPagina(1);
            setEstado(evento.target.value);
          }}
        >
          <option value="abierta">Solo abiertas</option>
          <option value="">Todas</option>
          <option value="reembolsada">Reembolsadas</option>
          <option value="rechazada">Rechazadas</option>
        </select>
        <button
          type="button"
          className="admin-disputas__actualizar"
          onClick={() => cargar(false, pagina, estado)}
          disabled={cargando}
        >
          {cargando ? "Actualizando…" : "Actualizar"}
        </button>
      </div>

      {error && <p className="admin-disputas__error">{error}</p>}
      {aviso && <p className="admin-disputas__aviso">{aviso}</p>}

      {disputas.length === 0 ? (
        <p className="admin-disputas__vacio">
          {estado === "abierta"
            ? "No hay disputas abiertas por revisar."
            : "No hay disputas que coincidan con el filtro."}
        </p>
      ) : (
        <ul className="admin-disputas__lista">
          {disputas.map((disputa) => (
            <li key={disputa.id} className="admin-disputas__item">
              <div className="admin-disputas__titulo">
                <h3>{disputa.productoNombre || "Producto"}</h3>
                <span
                  className={`admin-disputas__estado admin-disputas__estado--${disputa.estado}`}
                >
                  {textoEstadoDisputa(disputa.estado)}
                </span>
              </div>

              <p className="admin-disputas__meta">
                Venta #{disputa.ventaIdPg} ({textoEstadoVenta(disputa.ventaEstado)}
                ) · Comprador: {disputa.compradorId} · Vendedor:{" "}
                {disputa.vendedorNombre || `#${disputa.vendedorId}`} ·{" "}
                {dinero.format(disputa.monto)} ·{" "}
                {fechaFormato.format(new Date(disputa.fecha))}
              </p>

              <p className="admin-disputas__motivo">
                Motivo: <strong>{disputa.motivo}</strong>
              </p>
              {disputa.descripcion && (
                <p className="admin-disputas__descripcion">
                  {disputa.descripcion}
                </p>
              )}

              <p className="admin-disputas__lado">Evidencias del comprador</p>
              {disputa.evidenciasComprador.length === 0 ? (
                <p className="admin-disputas__sin-evidencias">
                  El comprador no adjuntó evidencias.
                </p>
              ) : (
                <Evidencias
                  disputaId={disputa.id}
                  lado="comprador"
                  cantidad={disputa.evidenciasComprador.length}
                />
              )}

              <p className="admin-disputas__lado">Versión del vendedor</p>
              {disputa.respuestaVendedor ? (
                <>
                  <p className="admin-disputas__descripcion">
                    {disputa.respuestaVendedor}
                  </p>
                  {disputa.evidenciasVendedor.length > 0 && (
                    <Evidencias
                      disputaId={disputa.id}
                      lado="vendedor"
                      cantidad={disputa.evidenciasVendedor.length}
                    />
                  )}
                  {disputa.respondidaEn && (
                    <p className="admin-disputas__meta">
                      Respondida el{" "}
                      {fechaFormato.format(new Date(disputa.respondidaEn))}
                    </p>
                  )}
                </>
              ) : (
                <p className="admin-disputas__sin-evidencias">
                  El vendedor todavía no responde la disputa.
                </p>
              )}

              {disputa.estado !== "abierta" && (
                <div className="admin-disputas__resolucion">
                  <p>
                    Resuelta por {disputa.resueltaPor ?? "la administración"}
                    {disputa.resueltaEn
                      ? ` el ${fechaFormato.format(new Date(disputa.resueltaEn))}`
                      : ""}
                    {disputa.reembolsoId
                      ? ` · Reembolso: ${disputa.reembolsoId}`
                      : ""}
                  </p>
                  {disputa.notaAdmin && <p>Nota: {disputa.notaAdmin}</p>}
                </div>
              )}

              {disputa.estado === "abierta" && (
                <div className="admin-disputas__acciones">
                  <input
                    type="text"
                    className="admin-disputas__nota"
                    placeholder="Nota para el acta (opcional)"
                    value={notas[disputa.id] ?? ""}
                    onChange={(evento) =>
                      setNotas((anteriores) => ({
                        ...anteriores,
                        [disputa.id]: evento.target.value,
                      }))
                    }
                  />
                  <button
                    type="button"
                    className="admin-disputas__reembolsar"
                    disabled={accionEnCurso === disputa.id}
                    onClick={() => dictaminarDisputa(disputa, "reembolsar")}
                  >
                    Reembolsar al comprador
                  </button>
                  <button
                    type="button"
                    className="admin-disputas__rechazar"
                    disabled={accionEnCurso === disputa.id}
                    onClick={() => dictaminarDisputa(disputa, "rechazar")}
                  >
                    Rechazar disputa
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {(datos?.totalPaginas ?? 1) > 1 && (
        <div className="admin-disputas__paginacion">
          <button
            type="button"
            disabled={pagina <= 1}
            onClick={() => setPagina((actual) => Math.max(actual - 1, 1))}
          >
            ← Anterior
          </button>
          <span>
            Página {datos?.pagina ?? 1} de {datos?.totalPaginas ?? 1}
          </span>
          <button
            type="button"
            disabled={pagina >= (datos?.totalPaginas ?? 1)}
            onClick={() => setPagina((actual) => actual + 1)}
          >
            Siguiente →
          </button>
        </div>
      )}

      <div className="admin-disputas__retenidas">
        <h3>Ventas con retención preventiva (RQNF32)</h3>
        <p className="admin-disputas__nota-retenidas">
          Estas ventas no pudieron reembolsarse automáticamente o tienen una
          disputa o reporte en curso: el dinero sigue retenido hasta que la
          administración las resuelva. Al reembolsar puedes registrar el adeudo
          del vendedor con su causa (RQNF37).
        </p>

        {retenidas.length === 0 ? (
          <p className="admin-disputas__vacio">
            No hay ventas con retención pendiente de resolver.
          </p>
        ) : (
          <ul className="admin-disputas__lista">
            {retenidas.map((venta) => (
              <li key={venta.ventaId} className="admin-disputas__item">
                <div className="admin-disputas__titulo">
                  <h3>
                    Venta #{venta.ventaId} ·{" "}
                    {venta.productoNombre || "Producto"}
                  </h3>
                  <span className="admin-disputas__estado admin-disputas__estado--retenida">
                    Retenida
                  </span>
                </div>

                <p className="admin-disputas__meta">
                  {textoEstadoVenta(venta.estado)} · Vendedor:{" "}
                  {venta.vendedorNombre || `#${venta.vendedorId}`} ·{" "}
                  {dinero.format(venta.monto)} ·{" "}
                  {fechaFormato.format(new Date(venta.fecha))}
                </p>

                {venta.canceladoMotivo && (
                  <p className="admin-disputas__motivo">
                    {venta.canceladoMotivo}
                  </p>
                )}

                <p className="admin-disputas__meta">
                  {venta.tieneDisputaAbierta
                    ? "Tiene una disputa abierta: resuélvela arriba."
                    : "Sin disputas abiertas."}{" "}
                  · Reportes pendientes: {venta.reportesPendientes} · Reportes
                  confirmados: {venta.reportesConfirmados}
                </p>

                <div className="admin-disputas__acciones">
                  <select
                    className="admin-disputas__causa"
                    value={causasRetenidas[venta.ventaId] ?? ""}
                    onChange={(evento) =>
                      setCausasRetenidas((anteriores) => ({
                        ...anteriores,
                        [venta.ventaId]: evento.target.value,
                      }))
                    }
                  >
                    {CAUSAS_ADEUDO_ADMIN.map((causa) => (
                      <option key={causa.valor} value={causa.valor}>
                        {causa.etiqueta}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    className="admin-disputas__nota"
                    placeholder="Nota de la resolución (opcional)"
                    value={notasRetenidas[venta.ventaId] ?? ""}
                    onChange={(evento) =>
                      setNotasRetenidas((anteriores) => ({
                        ...anteriores,
                        [venta.ventaId]: evento.target.value,
                      }))
                    }
                  />
                  <button
                    type="button"
                    className="admin-disputas__liberar"
                    disabled={
                      accionEnCurso === `venta-${venta.ventaId}` ||
                      venta.tieneDisputaAbierta
                    }
                    onClick={() => dictaminarVentaRetenida(venta, "liberar")}
                  >
                    Liberar retención
                  </button>
                  <button
                    type="button"
                    className="admin-disputas__reembolsar"
                    disabled={
                      accionEnCurso === `venta-${venta.ventaId}` ||
                      venta.tieneDisputaAbierta
                    }
                    onClick={() => dictaminarVentaRetenida(venta, "reembolsar")}
                  >
                    Reembolsar al comprador
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default Disputas;
