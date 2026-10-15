import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  abrirDisputaDeCompra,
  fetchEvidenciaDisputa,
  fetchMisCompras,
  fetchMisDisputas,
  fetchVentasDelVendedor,
  type CompraDelComprador,
  type DisputaDeVenta,
  type VentaDelVendedor,
} from "../../services/pagoService";
import EtiquetaEstadoVenta from "../../components/EtiquetaEstadoVenta/EtiquetaEstadoVenta";
import { fechaLimiteTexto } from "../../utils/estadoVenta";
import { mensajeDeError } from "../../utils/errores";
import { URL_BACKEND } from "../../services/api";
import "./MisPedidos.css";

/** RQF40: estado legible de una disputa para el comprador. */
function textoEstadoDisputa(estado: string): string {
  const textos: Record<string, string> = {
    abierta:
      "Disputa abierta: la administración la está revisando y tu pago sigue retenido",
    reembolsada: "Disputa resuelta a tu favor: se te reembolsó el monto",
    rechazada: "Disputa rechazada: la venta continúa su curso normal",
  };
  return textos[estado] ?? estado;
}

/**
 * RQF40: las evidencias solo las ven las partes y la administración, así que
 * se descargan con la sesión y se muestran como blob.
 */
function EvidenciasDeDisputa({
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
    <div className="mis-pedidos__evidencias">
      {urls.map((url) => (
        <a key={url} href={url} target="_blank" rel="noreferrer">
          <img src={url} alt={`Evidencia del ${lado}`} />
        </a>
      ))}
    </div>
  );
}

/**
 * Seguimiento del escrow (RQNF4) para ambas partes:
 *  - el comprador ve su palabra clave (RQNF20), su código de entrega
 *    (RQNF24.4), los plazos y los motivos de cancelación/reembolso;
 *  - el vendedor ve el estado de sus ventas y los plazos por cumplir.
 */
function MisPedidos() {
  const { usuario } = useAuth();
  const esVendedor = !!usuario;

  const [compras, setCompras] = useState<CompraDelComprador[]>([]);
  const [ventas, setVentas] = useState<VentaDelVendedor[]>([]);
  const [disputas, setDisputas] = useState<DisputaDeVenta[]>([]);
  const [cargando, setCargando] = useState(true);

  // RQF40: formulario para abrir una disputa de reembolso.
  const [disputaAbiertaPara, setDisputaAbiertaPara] = useState<number | null>(
    null,
  );
  const [motivoDisputa, setMotivoDisputa] = useState("");
  const [descripcionDisputa, setDescripcionDisputa] = useState("");
  const [evidenciasDisputa, setEvidenciasDisputa] = useState<File[]>([]);
  const [enviandoDisputa, setEnviandoDisputa] = useState(false);
  const [errorDisputa, setErrorDisputa] = useState("");
  const [avisoDisputa, setAvisoDisputa] = useState("");

  useEffect(() => {
    setCargando(true);

    if (esVendedor) {
      fetchVentasDelVendedor()
        .then((data) => setVentas(data.ventas))
        .catch(() => setVentas([]))
        .finally(() => setCargando(false));
    } else {
      fetchMisCompras()
        .then((data) => setCompras(data.compras))
        .catch(() => setCompras([]))
        .finally(() => setCargando(false));
      fetchMisDisputas()
        .then((data) => setDisputas(data.disputas))
        .catch(() => setDisputas([]));
    }
  }, [esVendedor]);

  async function enviarDisputa(ventaId: number) {
    if (!motivoDisputa.trim()) {
      setErrorDisputa("Escribe el motivo de tu disputa.");
      return;
    }

    setEnviandoDisputa(true);
    setErrorDisputa("");

    try {
      const respuesta = await abrirDisputaDeCompra(ventaId, {
        motivo: motivoDisputa,
        descripcion: descripcionDisputa,
        imagenes: evidenciasDisputa,
      });
      setDisputas((anteriores) => [...anteriores, respuesta.disputa]);
      setDisputaAbiertaPara(null);
      setMotivoDisputa("");
      setDescripcionDisputa("");
      setEvidenciasDisputa([]);
      setAvisoDisputa(respuesta.message);
    } catch (err) {
      setErrorDisputa(mensajeDeError(err) || "No pudimos abrir la disputa");
    } finally {
      setEnviandoDisputa(false);
    }
  }

  if (cargando) return <p>Cargando tus pedidos...</p>;

  if (esVendedor) {
    return (
      <div className="mis-pedidos">
        <h1>Ventas realizadas</h1>

        {ventas.length === 0 ? (
          <p className="mis-pedidos__vacio">
            Aún no tienes ventas registradas.
          </p>
        ) : (
          ventas.map((venta) => (
            <div key={venta.ventaId} className="mis-pedidos__item">
              <img
                src={`${URL_BACKEND}${venta.producto?.imagenes[0] ?? ""}`}
                alt={venta.producto?.nombre ?? "Producto"}
              />
              <div className="mis-pedidos__info">
                <p className="mis-pedidos__nombre">
                  {venta.producto?.nombre ?? "Producto"}
                </p>
                {venta.fechas.creada && (
                  <p className="mis-pedidos__fecha">
                    {new Date(venta.fechas.creada).toLocaleDateString()}
                  </p>
                )}
                <p className="mis-pedidos__monto">${venta.monto.toFixed(2)}</p>
                <EtiquetaEstadoVenta estado={venta.estado} rol="vendedor" />
                {venta.fechas.confirmacionLimite &&
                  venta.estado === "pendiente_confirmacion" && (
                    <p className="mis-pedidos__plazo">
                      Revisa el comprobante antes de:{" "}
                      {fechaLimiteTexto(venta.fechas.confirmacionLimite)}
                    </p>
                  )}
                {venta.fechas.entregaLimite &&
                  venta.estado === "en_entrega" && (
                    <p className="mis-pedidos__plazo">
                      Registra la entrega antes de:{" "}
                      {fechaLimiteTexto(venta.fechas.entregaLimite)}
                    </p>
                  )}
                {venta.canceladoMotivo && (
                  <p className="mis-pedidos__motivo">
                    Motivo: {venta.canceladoMotivo}
                  </p>
                )}
              </div>
              <Link to="/panel-vendedor" className="mis-pedidos__chat">
                Gestionar en mi panel
              </Link>
            </div>
          ))
        )}
      </div>
    );
  }

  return (
    <div className="mis-pedidos">
      <h1>Mis pedidos</h1>

      {avisoDisputa && <p className="mis-pedidos__aviso">{avisoDisputa}</p>}

      {compras.length === 0 ? (
        <p className="mis-pedidos__vacio">
          Aún no has completado ninguna compra.
        </p>
      ) : (
        compras.map((compra) => {
          const disputa = disputas.find(
            (candidata) => candidata.ventaIdPg === compra.ventaId,
          );
          const puedeDisputar =
            compra.estado === "en_entrega" || compra.estado === "completada";

          return (
            <div key={compra.ventaId} className="mis-pedidos__item">
              <img
                src={`${URL_BACKEND}${compra.producto?.imagenes[0] ?? ""}`}
                alt={compra.producto?.nombre ?? "Producto"}
              />
              <div className="mis-pedidos__info">
                <p className="mis-pedidos__nombre">
                  {compra.producto?.nombre ?? "Producto"}
                </p>
                {compra.creada && (
                  <p className="mis-pedidos__fecha">
                    {new Date(compra.creada).toLocaleDateString()}
                  </p>
                )}
                <p className="mis-pedidos__monto">
                  ${compra.monto.toFixed(2)}
                </p>
                <EtiquetaEstadoVenta estado={compra.estado} rol="comprador" />

                {compra.codigoPago && (
                  <p className="mis-pedidos__codigo">
                    Palabra clave: <strong>{compra.codigoPago}</strong>
                  </p>
                )}

                {compra.estado === "en_entrega" && compra.codigoEntrega && (
                  <div className="mis-pedidos__entrega">
                    <p className="mis-pedidos__entrega-titulo">
                      Código de confirmación de entrega
                    </p>
                    <p className="mis-pedidos__entrega-codigo">
                      {compra.codigoEntrega}
                    </p>
                    <p className="mis-pedidos__entrega-nota">
                      Dáselo al vendedor únicamente cuando recibas el producto:
                      con él se libera el dinero retenido.
                    </p>
                  </div>
                )}

                {compra.confirmacionLimite &&
                  compra.estado === "pendiente_confirmacion" && (
                    <p className="mis-pedidos__plazo">
                      El vendedor revisará tu comprobante antes de:{" "}
                      {fechaLimiteTexto(compra.confirmacionLimite)}
                    </p>
                  )}

                {compra.entregaLimite && compra.estado === "en_entrega" && (
                  <p className="mis-pedidos__plazo">
                    El vendedor debe entregar antes de:{" "}
                    {fechaLimiteTexto(compra.entregaLimite)}
                  </p>
                )}

                {compra.canceladoMotivo && (
                  <p className="mis-pedidos__motivo">
                    Motivo: {compra.canceladoMotivo}
                  </p>
                )}

                {/* RQF40: estado de la disputa de reembolso de esta compra. */}
                {disputa && (
                  <div className="mis-pedidos__disputa">
                    <p className="mis-pedidos__disputa-estado">
                      {textoEstadoDisputa(disputa.estado)}
                    </p>
                    <p className="mis-pedidos__disputa-motivo">
                      Motivo: {disputa.motivo}
                    </p>
                    {disputa.evidenciasComprador.length > 0 && (
                      <EvidenciasDeDisputa
                        disputaId={disputa.id}
                        lado="comprador"
                        cantidad={disputa.evidenciasComprador.length}
                      />
                    )}
                    {disputa.respuestaVendedor && (
                      <p className="mis-pedidos__disputa-respuesta">
                        Respuesta del vendedor: {disputa.respuestaVendedor}
                      </p>
                    )}
                    {disputa.evidenciasVendedor.length > 0 && (
                      <EvidenciasDeDisputa
                        disputaId={disputa.id}
                        lado="vendedor"
                        cantidad={disputa.evidenciasVendedor.length}
                      />
                    )}
                  </div>
                )}
              </div>

              <div className="mis-pedidos__acciones">
                {compra.estado === "pendiente_comprobante" && (
                  <Link
                    to={`/pago-exitoso?venta=${compra.ventaId}`}
                    className="mis-pedidos__chat"
                  >
                    Registrar comprobante
                  </Link>
                )}
                {compra.ventaMongoId &&
                  (compra.estado === "en_entrega" ||
                    compra.estado === "completada") && (
                    <Link to="/chats" className="mis-pedidos__chat">
                      Ver chat
                    </Link>
                  )}
                {!disputa && puedeDisputar && (
                  <button
                    type="button"
                    className="mis-pedidos__disputa-boton"
                    onClick={() => {
                      setDisputaAbiertaPara(
                        disputaAbiertaPara === compra.ventaId
                          ? null
                          : compra.ventaId,
                      );
                      setErrorDisputa("");
                    }}
                  >
                    {disputaAbiertaPara === compra.ventaId
                      ? "Cerrar formulario"
                      : "Abrir disputa"}
                  </button>
                )}
              </div>

              {disputaAbiertaPara === compra.ventaId && !disputa && (
                <div className="mis-pedidos__formulario-disputa">
                  <p className="mis-pedidos__formulario-titulo">
                    Disputa de reembolso (RQF40)
                  </p>
                  <p className="mis-pedidos__formulario-nota">
                    Cuéntanos qué pasó. Mientras la administración revisa tu
                    caso, el pago queda retenido. Solo se admite una disputa
                    por compra.
                  </p>
                  <input
                    type="text"
                    className="mis-pedidos__campo"
                    placeholder="Motivo (por ejemplo: no recibí el producto)"
                    maxLength={200}
                    value={motivoDisputa}
                    onChange={(evento) => setMotivoDisputa(evento.target.value)}
                  />
                  <textarea
                    className="mis-pedidos__campo mis-pedidos__campo--area"
                    placeholder="Describe lo sucedido (opcional)"
                    maxLength={2000}
                    value={descripcionDisputa}
                    onChange={(evento) =>
                      setDescripcionDisputa(evento.target.value)
                    }
                  />
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="mis-pedidos__archivo"
                    onChange={(evento) =>
                      setEvidenciasDisputa(
                        Array.from(evento.target.files ?? []).slice(0, 5),
                      )
                    }
                  />
                  <p className="mis-pedidos__formulario-nota">
                    Puedes adjuntar hasta 5 imágenes como evidencia.
                  </p>
                  {errorDisputa && (
                    <p className="mis-pedidos__error">{errorDisputa}</p>
                  )}
                  <div className="mis-pedidos__formulario-acciones">
                    <button
                      type="button"
                      className="mis-pedidos__disputa-boton"
                      disabled={enviandoDisputa}
                      onClick={() => enviarDisputa(compra.ventaId)}
                    >
                      {enviandoDisputa ? "Enviando..." : "Enviar disputa"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

export default MisPedidos;
