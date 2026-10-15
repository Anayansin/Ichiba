import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import VerificacionModal from "../../components/VerificacionModal/VerificacionModal";
import {
  fetchPerfil,
  guardarPreferenciasNotificacion,
  type PerfilUsuario,
  type PreferenciasNotificacion,
} from "../../services/usuarioServices";
import {
  fetchMisProductos,
  cambiarEstadoProducto,
  eliminarProducto,
  type Producto,
} from "../../services/productoService";
import {
  fetchMisPromocionales,
  cambiarEstadoPromocional,
  eliminarPromocional,
  type Promocional,
} from "../../services/promocionalService";
import {
  confirmarComprobanteDeVenta,
  fetchDisputasDelVendedor,
  fetchEvidenciaDisputa,
  fetchImagenComprobante,
  fetchVentasDelVendedor,
  rechazarComprobanteDeVenta,
  registrarEntregaDeVenta,
  responderDisputaDeVenta,
  type DisputaDeVenta,
  type ResumenVentasDelVendedor,
  type VentaDelVendedor,
} from "../../services/pagoService";
import EtiquetaEstadoVenta from "../../components/EtiquetaEstadoVenta/EtiquetaEstadoVenta";
import {
  descargarInformeVendedorPdf,
  fetchInformesDelVendedor,
  type InformeVendedor,
} from "../../services/informeService";
import { fechaLimiteTexto } from "../../utils/estadoVenta";
import { URL_BACKEND } from "../../services/api";
import { mensajeDeError } from "../../utils/errores";
import "./PanelVendedor.css";

/** RQF40: estado legible de una disputa para el vendedor. */
function textoEstadoDisputaVendedor(estado: string): string {
  const textos: Record<string, string> = {
    abierta:
      "Disputa abierta: la administración la está revisando y el pago sigue retenido",
    reembolsada:
      "Disputa resuelta a favor del comprador: se le reembolsó el monto",
    rechazada:
      "Disputa rechazada: la venta continúa su curso normal y el pago se libera",
  };
  return textos[estado] ?? estado;
}

/**
 * RQF40: las evidencias solo las ven las partes y la administración, así que
 * se descargan con la sesión y se muestran como blob.
 */
function EvidenciasDeDisputaVendedor({
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
    <div className="panel-vendedor__evidencias">
      {urls.map((url) => (
        <a key={url} href={url} target="_blank" rel="noreferrer">
          <img src={url} alt={`Evidencia del ${lado}`} />
        </a>
      ))}
    </div>
  );
}

function PanelVendedor() {
  const { usuario } = useAuth();
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null);
  const [misProductos, setMisProductos] = useState<Producto[]>([]);
  const [misPromocionales, setMisPromocionales] = useState<Promocional[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const [preferencias, setPreferencias] = useState<PreferenciasNotificacion>({
    recibirNotificacionesCriticas: true,
    recibirNotificacionesPublicitarias: false,
  });
  const [guardandoPreferencias, setGuardandoPreferencias] = useState(false);
  const [avisoPreferencias, setAvisoPreferencias] = useState("");

  // RQF4: la vinculación con PayPal se inicia desde el registro del vendedor;
  // aquí solo se muestra el resultado que PayPal devolvió en el callback.
  const [avisoPaypal, setAvisoPaypal] = useState("");
  const [parametros, setParametros] = useSearchParams();

  // RQF30/RQF31/RQF33: ventas del escrow (comprobantes por revisar, entregas
  // en curso e historial).
  const [ventasData, setVentasData] = useState<ResumenVentasDelVendedor | null>(
    null,
  );
  const [imagenesComprobantes, setImagenesComprobantes] = useState<
    Record<number, string>
  >({});
  const [motivosRechazo, setMotivosRechazo] = useState<Record<number, string>>(
    {},
  );
  const [codigosEntrega, setCodigosEntrega] = useState<Record<number, string>>(
    {},
  );
  const [accionVentaEnCurso, setAccionVentaEnCurso] = useState<number | null>(
    null,
  );
  const [errorVentas, setErrorVentas] = useState("");

  // RQF13 / RQNF13.3: informes mensuales de ventas (consulta y descarga PDF).
  const [informes, setInformes] = useState<InformeVendedor[]>([]);
  const [descargandoInforme, setDescargandoInforme] = useState<string | null>(
    null,
  );
  const [errorInformes, setErrorInformes] = useState("");

  // RQF40: disputas de reembolso abiertas por los compradores en sus compras.
  const [disputasVendedor, setDisputasVendedor] = useState<DisputaDeVenta[]>(
    [],
  );
  const [respuestasDisputa, setRespuestasDisputa] = useState<
    Record<string, string>
  >({});
  const [imagenesRespuesta, setImagenesRespuesta] = useState<
    Record<string, File[]>
  >({});
  const [enviandoRespuesta, setEnviandoRespuesta] = useState<string | null>(
    null,
  );
  const [errorDisputas, setErrorDisputas] = useState("");
  const [avisoDisputas, setAvisoDisputas] = useState("");

  function cargarImagenesDeComprobantes(data: ResumenVentasDelVendedor | null) {
    if (!data) return;
    for (const venta of data.ventas) {
      if (!venta.comprobante) continue;
      fetchImagenComprobante(venta.ventaId)
        .then((url) =>
          setImagenesComprobantes((anteriores) => ({
            ...anteriores,
            [venta.ventaId]: url,
          })),
        )
        .catch(() => {
          // La imagen se muestra como "no disponible"; no rompe el panel.
        });
    }
  }

  function cargarDatos() {
    setCargando(true);

    Promise.all([
      fetchPerfil(),
      fetchMisProductos(),
      // Un fallo en promocionales no debe impedir cargar el panel
      fetchMisPromocionales().catch((error) => {
        console.error("Error al cargar promocionales:", error);
        return [];
      }),
      // Un fallo en ventas tampoco debe impedir cargar el panel
      fetchVentasDelVendedor().catch((error) => {
        console.error("Error al cargar las ventas:", error);
        return null;
      }),
      // Los informes de ventas tampoco deben impedir cargar el panel
      fetchInformesDelVendedor().catch((error) => {
        console.error("Error al cargar los informes:", error);
        return [] as InformeVendedor[];
      }),
      // Las disputas tampoco deben impedir cargar el panel
      fetchDisputasDelVendedor().catch((error) => {
        console.error("Error al cargar las disputas:", error);
        return { disputas: [] as DisputaDeVenta[] };
      }),
    ])
      .then(([datosPerfil, productos, promocionales, datosVentas, datosInformes, datosDisputas]) => {
        setPerfil(datosPerfil);
        setMisProductos(productos);
        setMisPromocionales(promocionales);
        setVentasData(datosVentas);
        setInformes(datosInformes);
        setDisputasVendedor(datosDisputas.disputas);
        cargarImagenesDeComprobantes(datosVentas);
      })
      .catch((error) => {
        console.error("Error al cargar el panel:", error);
      })
      .finally(() => setCargando(false));
  }

  useEffect(() => {
    if (!usuario) return;
    cargarDatos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario]);

  // Mensaje según lo que PayPal devolvió al volver del flujo de vinculación.
  useEffect(() => {
    const resultado = parametros.get("paypal");
    if (!resultado) return;

    const mensajes: Record<string, string> = {
      vinculado:
        "¡Cuenta de PayPal vinculada! Tus cobros se enviarán a esa cuenta.",
      denegado:
        "No autorizaste la vinculación con PayPal: tu cuenta quedó sin vincular.",
      "state-invalido": "La vinculación con PayPal expiró.",
      "sin-identidad": "PayPal no devolvió los datos de tu cuenta.",
      "sin-state": "La vinculación no se completó.",
      error: "No se pudo completar la vinculación con PayPal.",
    };
    setAvisoPaypal(mensajes[resultado] ?? "Resultado de PayPal desconocido.");
    // Quitar el parámetro de la URL para que el mensaje no se repita al recargar.
    parametros.delete("paypal");
    setParametros(parametros, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parametros]);

  // Rellena las preferencias con lo que ya tiene guardado el vendedor.
  useEffect(() => {
    if (!perfil) return;
    setPreferencias({
      recibirNotificacionesCriticas:
        perfil.recibirNotificacionesCriticas ?? true,
      recibirNotificacionesPublicitarias:
        perfil.recibirNotificacionesPublicitarias ?? false,
    });
  }, [perfil]);

  if (!usuario) return <Navigate to="/" replace />;
  if (cargando) return <p className="panel-vendedor__cargando">Cargando tu panel...</p>;

  if (!perfil) {
    return (
      <p className="panel-vendedor__cargando">
        No pudimos cargar tu panel.{" "}
        <button
          type="button"
          className="panel-vendedor__reintentar"
          onClick={cargarDatos}
        >
          Reintentar
        </button>
      </p>
    );
  }

  const necesitaVerificar = !perfil.correoVerificado;
  const productosActivos = misProductos.filter((p) => p.activo);
  const productosInactivos = misProductos.filter((p) => !p.activo);
  const promocionalesActivos = misPromocionales.filter((p) => p.activo);
  const promocionalesInactivos = misPromocionales.filter((p) => !p.activo);
  // RQNF10.3 / RQF12: cuenta cancelada de forma permanente por 8 puntos.
  const cuentaCancelada =
    ventasData?.cuenta.estadoCuenta === "cancelada" ||
    perfil.estadoCuenta === "cancelada";
  const puntosReputacion =
    ventasData?.cuenta.puntosReputacion ?? perfil.puntosReputacion ?? 0;
  const puntosCancelacion =
    ventasData?.cuenta.puntosCancelacion ?? perfil.puntosCancelacion ?? 8;
  // RQNF10.1: promedio de calificaciones recibidas en ventas completadas.
  const reputacion = ventasData?.reputacion ?? perfil.reputacion ?? null;
  const ventasPorRevisar =
    ventasData?.ventas.filter((v) => v.estado === "pendiente_confirmacion") ??
    [];
  const ventasEnEntrega =
    ventasData?.ventas.filter((v) => v.estado === "en_entrega") ?? [];
  const ventasHistorial =
    ventasData?.ventas
      .filter(
        (v) =>
          v.estado === "completada" ||
          v.estado === "cancelada" ||
          v.estado === "reembolsada",
      )
      .slice(0, 10) ?? [];

  async function ejecutar(accion: () => Promise<unknown>) {
    try {
      await accion();
      setError("");
      cargarDatos();
    } catch (err) {
      setError(mensajeDeError(err) || "No se pudo completar la acción");
    }
  }

  async function handleCambiarEstado(id: string) {
    await ejecutar(() => cambiarEstadoProducto(id));
  }

  async function handleEliminar(id: string) {
    const confirmado = window.confirm(
      "¿Seguro que quieres eliminar este producto? Esta acción no se puede deshacer.",
    );
    if (!confirmado) return;
    await ejecutar(() => eliminarProducto(id));
  }

  async function handleCambiarEstadoPromocional(id: string) {
    await ejecutar(() => cambiarEstadoPromocional(id));
  }

  async function handleEliminarPromocional(id: string) {
    const confirmado = window.confirm(
      "¿Seguro que quieres eliminar este promocional? Esta acción no se puede deshacer.",
    );
    if (!confirmado) return;
    await ejecutar(() => eliminarPromocional(id));
  }

  async function guardarPreferencias() {
    setGuardandoPreferencias(true);
    setError("");
    setAvisoPreferencias("");

    try {
      const respuesta = await guardarPreferenciasNotificacion(preferencias);
      setAvisoPreferencias(respuesta.message || "Preferencias guardadas");
    } catch (err) {
      setError(
        mensajeDeError(err) || "No se pudieron guardar las preferencias",
      );
    } finally {
      setGuardandoPreferencias(false);
    }
  }

  // --- RQF31/RQF33: acciones sobre las ventas del escrow -------------------

  async function handleConfirmarComprobante(ventaId: number) {
    setAccionVentaEnCurso(ventaId);
    setErrorVentas("");
    try {
      await confirmarComprobanteDeVenta(ventaId);
      cargarDatos();
    } catch (err) {
      setErrorVentas(
        mensajeDeError(err) || "No se pudo confirmar el comprobante",
      );
    } finally {
      setAccionVentaEnCurso(null);
    }
  }

  async function handleRechazarComprobante(ventaId: number) {
    const motivo = (motivosRechazo[ventaId] ?? "").trim();
    if (motivo.length < 4) {
      setErrorVentas(
        "Escribe el motivo del rechazo (mínimo 4 caracteres): se le mostrará al comprador.",
      );
      return;
    }

    const confirmado = window.confirm(
      "¿Rechazar este comprobante? Se reembolsará al comprador y el turno pasará al siguiente en la fila.",
    );
    if (!confirmado) return;

    setAccionVentaEnCurso(ventaId);
    setErrorVentas("");
    try {
      await rechazarComprobanteDeVenta(ventaId, motivo);
      setMotivosRechazo((anteriores) => ({ ...anteriores, [ventaId]: "" }));
      cargarDatos();
    } catch (err) {
      setErrorVentas(
        mensajeDeError(err) || "No se pudo rechazar el comprobante",
      );
    } finally {
      setAccionVentaEnCurso(null);
    }
  }

  async function handleRegistrarEntrega(ventaId: number) {
    const codigo = (codigosEntrega[ventaId] ?? "").trim();
    if (!/^\d{4}$/.test(codigo)) {
      setErrorVentas(
        "El código de confirmación de entrega tiene 4 dígitos; pídelo al comprador.",
      );
      return;
    }

    setAccionVentaEnCurso(ventaId);
    setErrorVentas("");
    try {
      await registrarEntregaDeVenta(ventaId, codigo);
      setCodigosEntrega((anteriores) => ({ ...anteriores, [ventaId]: "" }));
      cargarDatos();
    } catch (err) {
      setErrorVentas(
        mensajeDeError(err) || "No se pudo registrar la entrega",
      );
    } finally {
      setAccionVentaEnCurso(null);
    }
  }

  // --- RQF40: disputas de reembolso abiertas por los compradores -----------

  async function handleResponderDisputa(disputaId: string) {
    const respuesta = (respuestasDisputa[disputaId] ?? "").trim();
    if (!respuesta) {
      setErrorDisputas(
        "Escribe tu versión de lo sucedido antes de enviarla.",
      );
      return;
    }

    setEnviandoRespuesta(disputaId);
    setErrorDisputas("");
    setAvisoDisputas("");
    try {
      const datos = await responderDisputaDeVenta(disputaId, {
        respuesta,
        imagenes: imagenesRespuesta[disputaId] ?? [],
      });
      setDisputasVendedor((anteriores) =>
        anteriores.map((disputa) =>
          disputa.id === disputaId ? datos.disputa : disputa,
        ),
      );
      setRespuestasDisputa((anteriores) => ({ ...anteriores, [disputaId]: "" }));
      setImagenesRespuesta((anteriores) => ({ ...anteriores, [disputaId]: [] }));
      setAvisoDisputas(datos.message);
    } catch (err) {
      setErrorDisputas(
        mensajeDeError(err) || "No se pudo enviar tu respuesta",
      );
    } finally {
      setEnviandoRespuesta(null);
    }
  }

  // --- RQF13 / RQNF13.3: informes mensuales de ventas ----------------------

  async function handleDescargarInforme(periodo: string) {
    setDescargandoInforme(periodo);
    setErrorInformes("");
    try {
      await descargarInformeVendedorPdf(periodo);
    } catch (err) {
      setErrorInformes(
        mensajeDeError(err) || "No se pudo descargar el informe en PDF",
      );
    } finally {
      setDescargandoInforme(null);
    }
  }

  function renderVentaPorRevisar(venta: VentaDelVendedor) {
    const imagen = imagenesComprobantes[venta.ventaId];
    return (
      <div key={venta.ventaId} className="panel-vendedor__venta">
        <div className="panel-vendedor__venta-info">
          <p className="panel-vendedor__venta-nombre">
            {venta.producto?.nombre ?? "Producto"}
          </p>
          <p className="panel-vendedor__venta-detalle">
            ${venta.monto.toFixed(2)} · Comprador:{" "}
            {venta.compradorId.slice(0, 8)}…
          </p>
          <p className="panel-vendedor__venta-detalle">
            Referencia del pago: {venta.comprobante?.referencia ?? "—"}
          </p>
          {venta.fechas.confirmacionLimite && (
            <p className="panel-vendedor__venta-plazo">
              ⏰ Confírmalo o recházalo antes de:{" "}
              {fechaLimiteTexto(venta.fechas.confirmacionLimite)}
            </p>
          )}
          {venta.comprobante &&
            (imagen ? (
              <img
                className="panel-vendedor__comprobante"
                src={imagen}
                alt="Comprobante de pago del comprador"
              />
            ) : (
              <p className="panel-vendedor__venta-detalle">
                Cargando la imagen del comprobante…
              </p>
            ))}
        </div>

        <div className="panel-vendedor__venta-acciones">
          <button
            type="button"
            className="panel-vendedor__confirmar-btn"
            onClick={() => handleConfirmarComprobante(venta.ventaId)}
            disabled={accionVentaEnCurso === venta.ventaId}
          >
            {accionVentaEnCurso === venta.ventaId
              ? "Procesando..."
              : "✓ Confirmar comprobante"}
          </button>

          <textarea
            className="panel-vendedor__motivo-rechazo"
            rows={2}
            maxLength={300}
            placeholder="Motivo del rechazo (se lo mostramos al comprador)"
            value={motivosRechazo[venta.ventaId] ?? ""}
            onChange={(e) =>
              setMotivosRechazo((anteriores) => ({
                ...anteriores,
                [venta.ventaId]: e.target.value,
              }))
            }
          />
          <button
            type="button"
            className="panel-vendedor__rechazar-btn"
            onClick={() => handleRechazarComprobante(venta.ventaId)}
            disabled={accionVentaEnCurso === venta.ventaId}
          >
            ✕ Rechazar y reembolsar
          </button>
          <p className="panel-vendedor__venta-nota">
            Si rechazas, el comprador recibe su reembolso de inmediato y el
            turno pasa al siguiente en la fila.
          </p>
        </div>
      </div>
    );
  }

  function renderVentaEnEntrega(venta: VentaDelVendedor) {
    return (
      <div key={venta.ventaId} className="panel-vendedor__venta">
        <div className="panel-vendedor__venta-info">
          <p className="panel-vendedor__venta-nombre">
            {venta.producto?.nombre ?? "Producto"}
          </p>
          <p className="panel-vendedor__venta-detalle">
            ${venta.monto.toFixed(2)} · Comprador:{" "}
            {venta.compradorId.slice(0, 8)}…
          </p>
          {venta.fechas.entregaLimite && (
            <p className="panel-vendedor__venta-plazo">
              ⏰ Registra la entrega antes de:{" "}
              {fechaLimiteTexto(venta.fechas.entregaLimite)}
            </p>
          )}
        </div>

        <div className="panel-vendedor__venta-acciones">
          <input
            type="text"
            inputMode="numeric"
            maxLength={4}
            className="panel-vendedor__codigo-entrega"
            placeholder="Código de 4 dígitos"
            value={codigosEntrega[venta.ventaId] ?? ""}
            onChange={(e) =>
              setCodigosEntrega((anteriores) => ({
                ...anteriores,
                [venta.ventaId]: e.target.value.replace(/\D/g, ""),
              }))
            }
          />
          <button
            type="button"
            className="panel-vendedor__confirmar-btn"
            onClick={() => handleRegistrarEntrega(venta.ventaId)}
            disabled={accionVentaEnCurso === venta.ventaId}
          >
            {accionVentaEnCurso === venta.ventaId
              ? "Procesando..."
              : "📦 Registrar entrega y liberar el dinero"}
          </button>
          <p className="panel-vendedor__venta-nota">
            Al entregar el producto, pídele al comprador su código de
            confirmación. Con el código correcto se libera el dinero retenido.
          </p>
        </div>
      </div>
    );
  }

  function renderHistorial(venta: VentaDelVendedor) {
    return (
      <div key={venta.ventaId} className="panel-vendedor__historial-fila">
        <div>
          <p className="panel-vendedor__venta-nombre">
            {venta.producto?.nombre ?? "Producto"}
          </p>
          <p className="panel-vendedor__venta-detalle">
            ${venta.monto.toFixed(2)}
            {venta.fechas.entregadoEn
              ? ` · Entregada el ${fechaLimiteTexto(venta.fechas.entregadoEn)}`
              : ""}
          </p>
          {venta.canceladoMotivo && (
            <p className="panel-vendedor__venta-detalle">
              Motivo: {venta.canceladoMotivo}
            </p>
          )}
        </div>
        <EtiquetaEstadoVenta estado={venta.estado} rol="vendedor" />
      </div>
    );
  }

  // RQF40: una disputa de reembolso del comprador y su formulario de respuesta.
  function renderDisputa(disputa: DisputaDeVenta) {
    const pendienteDeRespuesta =
      disputa.estado === "abierta" && !disputa.respuestaVendedor;

    return (
      <div key={disputa.id} className="panel-vendedor__disputa">
        <div className="panel-vendedor__disputa-info">
          <p className="panel-vendedor__venta-nombre">
            {disputa.productoNombre}
          </p>
          <p className="panel-vendedor__venta-detalle">
            ${disputa.monto.toFixed(2)} · Comprador:{" "}
            {disputa.compradorId.slice(0, 8)}… ·{" "}
            {new Date(disputa.fecha).toLocaleDateString()}
          </p>
          <p className="panel-vendedor__disputa-estado">
            {textoEstadoDisputaVendedor(disputa.estado)}
          </p>
          <p className="panel-vendedor__venta-detalle">
            Motivo: {disputa.motivo}
          </p>
          {disputa.descripcion && (
            <p className="panel-vendedor__venta-detalle">
              {disputa.descripcion}
            </p>
          )}
          {disputa.evidenciasComprador.length > 0 && (
            <EvidenciasDeDisputaVendedor
              disputaId={disputa.id}
              lado="comprador"
              cantidad={disputa.evidenciasComprador.length}
            />
          )}
          {disputa.respuestaVendedor && (
            <p className="panel-vendedor__disputa-respuesta">
              Tu respuesta: {disputa.respuestaVendedor}
            </p>
          )}
          {disputa.evidenciasVendedor.length > 0 && (
            <EvidenciasDeDisputaVendedor
              disputaId={disputa.id}
              lado="vendedor"
              cantidad={disputa.evidenciasVendedor.length}
            />
          )}
          {disputa.notaAdmin && (
            <p className="panel-vendedor__venta-detalle">
              Nota de la administración: {disputa.notaAdmin}
            </p>
          )}
        </div>

        {pendienteDeRespuesta && (
          <div className="panel-vendedor__disputa-acciones">
            <textarea
              className="panel-vendedor__motivo-rechazo"
              rows={3}
              maxLength={2000}
              placeholder="Tu versión de lo sucedido (la verán la administración y el comprador)"
              value={respuestasDisputa[disputa.id] ?? ""}
              onChange={(e) =>
                setRespuestasDisputa((anteriores) => ({
                  ...anteriores,
                  [disputa.id]: e.target.value,
                }))
              }
            />
            <input
              type="file"
              accept="image/*"
              multiple
              className="panel-vendedor__archivo-disputa"
              onChange={(e) =>
                setImagenesRespuesta((anteriores) => ({
                  ...anteriores,
                  [disputa.id]: Array.from(e.target.files ?? []).slice(0, 5),
                }))
              }
            />
            <p className="panel-vendedor__venta-nota">
              Puedes adjuntar hasta 5 imágenes como evidencia. Solo se admite
              una respuesta por disputa.
            </p>
            <button
              type="button"
              className="panel-vendedor__confirmar-btn"
              onClick={() => handleResponderDisputa(disputa.id)}
              disabled={enviandoRespuesta === disputa.id}
            >
              {enviandoRespuesta === disputa.id
                ? "Enviando..."
                : "Enviar mi respuesta"}
            </button>
          </div>
        )}
      </div>
    );
  }

  function renderProducto(producto: Producto) {    return (
      <div key={producto._id} className="panel-vendedor__producto-fila">
        <Link
          to={`/producto/${producto._id}`}
          className="panel-vendedor__producto-item"
        >
          <img
            src={`${URL_BACKEND}${producto.imagenes[0]}`}
            alt={producto.nombre}
          />
          <div>
            <p className="panel-vendedor__producto-nombre">{producto.nombre}</p>
            <p className="panel-vendedor__producto-precio">
              ${producto.precio}
            </p>
          </div>
        </Link>
        {cuentaCancelada ? (
          <p className="panel-vendedor__venta-nota">
            Desactivado por la cancelación de tu cuenta (RQNF10.6).
          </p>
        ) : (
          <div className="panel-vendedor__acciones">
            <Link
              to={`/panel-vendedor/editar/${producto._id}`}
              className="panel-vendedor__editar-btn"
            >
              Editar
            </Link>
            <button
              className="panel-vendedor__estado-btn"
              onClick={() => handleCambiarEstado(producto._id)}
            >
              {producto.activo ? "Desactivar" : "Activar"}
            </button>
            <button
              className="panel-vendedor__eliminar-btn"
              onClick={() => handleEliminar(producto._id)}
            >
              Eliminar
            </button>
          </div>
        )}
      </div>
    );
  }

  function renderPromocional(promocional: Promocional) {
    return (
      <div key={promocional._id} className="panel-vendedor__producto-fila">
        <Link
          to={`/promocional/${promocional._id}`}
          className="panel-vendedor__producto-item"
        >
          <img
            src={`${URL_BACKEND}${promocional.imagenes[0]}`}
            alt={promocional.nombre}
          />
          <div>
            <p className="panel-vendedor__producto-nombre">
              {promocional.nombre}
            </p>
            <p className="panel-vendedor__producto-precio">
              ${promocional.precio}
            </p>
          </div>
        </Link>
        {cuentaCancelada ? (
          <p className="panel-vendedor__venta-nota">
            Desactivado por la cancelación de tu cuenta (RQNF10.6).
          </p>
        ) : (
          <div className="panel-vendedor__acciones">
            <button
              className="panel-vendedor__estado-btn"
              onClick={() => handleCambiarEstadoPromocional(promocional._id)}
            >
              {promocional.activo ? "Desactivar" : "Activar"}
            </button>
            <button
              className="panel-vendedor__eliminar-btn"
              onClick={() => handleEliminarPromocional(promocional._id)}
            >
              Eliminar
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="panel-vendedor">
      <h1>Hola, {perfil.nombreCompleto}</h1>
      <p className="panel-vendedor__correo">{perfil.correo}</p>
      {error && <p className="panel-vendedor__error">{error}</p>}
      {avisoPaypal && (
        <p className="panel-vendedor__paypal-aviso">{avisoPaypal}</p>
      )}

      {cuentaCancelada && (
        <div className="panel-vendedor__cancelada">
          <h2>Tu cuenta fue cancelada de forma permanente</h2>
          <p>
            Acumulaste {puntosReputacion}/{puntosCancelacion} puntos de
            infracción (RQNF10.1), por lo que tu cuenta fue cancelada de forma
            definitiva: ya no puedes publicar ni vender, y tus datos de
            identificación (RFC, CURP e INE) quedaron en la lista negra de
            Ichiba (RQNF10.3 / RQNF10.6).
          </p>
          <p>
            Conservas el acceso únicamente para completar las entregas cuyo pago
            ya está confirmado (RQF12). Cuando termines la última entrega
            pendiente, tus datos personales se eliminarán y ya no podrás iniciar
            sesión.
          </p>
        </div>
      )}

      <div className="panel-vendedor__stats">
        <div className="panel-vendedor__stat-card">
          <span className="panel-vendedor__stat-numero">
            {productosActivos.length}
          </span>
          <span className="panel-vendedor__stat-label">Productos activos</span>
        </div>
        <div className="panel-vendedor__stat-card">
          <span className="panel-vendedor__stat-numero">
            {promocionalesActivos.length}
          </span>
          <span className="panel-vendedor__stat-label">
            Promocionales activos
          </span>
        </div>
        <div className="panel-vendedor__stat-card">
          <span className="panel-vendedor__stat-numero">
            {perfil.ventasExitosas}
          </span>
          <span className="panel-vendedor__stat-label">
            Ventas concluidas sin problemas
          </span>
        </div>
        {/* RQNF10.1: promedio de calificaciones de las ventas completadas. */}
        <div className="panel-vendedor__stat-card">
          <span className="panel-vendedor__stat-numero">
            {reputacion === null ? "—" : reputacion.toFixed(1)}
          </span>
          <span className="panel-vendedor__stat-label">
            Calificación promedio de compradores
          </span>
        </div>
        {/* RQNF10.1 / RQNF10.3: puntos de infracción (8 = cancelación). */}
        <div className="panel-vendedor__stat-card panel-vendedor__stat-card--puntos">
          <span className="panel-vendedor__stat-numero">
            {puntosReputacion}/{puntosCancelacion}
          </span>
          <span className="panel-vendedor__stat-label">
            Puntos de infracción (cancelación al llegar a {puntosCancelacion})
          </span>
        </div>
        <div className="panel-vendedor__stat-card panel-vendedor__stat-card--reportes">
          <span className="panel-vendedor__stat-numero">{perfil.totalReportes}</span>
          <span className="panel-vendedor__stat-label">Reportes recibidos</span>
        </div>
      </div>

      {/* RQF12: la cuenta cancelada ya no puede publicar ni configurar horario;
          solo conserva acceso a sus entregas pendientes. */}
      {!cuentaCancelada && (
        <div className="panel-vendedor__publicar">
          <Link
            to="/panel-vendedor/publicar"
            className="panel-vendedor__boton-publicar"
          >
            + Publicar nuevo producto
          </Link>
          <Link
            to="/panel-vendedor/promocionar"
            className="panel-vendedor__boton-publicar panel-vendedor__boton-publicar--promocional"
          >
            + Publicar promocional
          </Link>
          <Link
            to="/panel-vendedor/horario"
            className="panel-vendedor__boton-publicar"
          >
            Configurar horario
          </Link>
          <Link
            to="/panel-vendedor/reportar-comprador"
            className="panel-vendedor__boton-publicar"
          >
            Reportar a un comprador
          </Link>
        </div>
      )}

      <div className="panel-vendedor__ventas">
        <h2>Ventas y entregas</h2>

        {ventasData && (
          <div className="panel-vendedor__stats">
            <div className="panel-vendedor__stat-card">
              <span className="panel-vendedor__stat-numero">
                {ventasData.resumen.porRevisar}
              </span>
              <span className="panel-vendedor__stat-label">
                Comprobantes por revisar
              </span>
            </div>
            <div className="panel-vendedor__stat-card">
              <span className="panel-vendedor__stat-numero">
                {ventasData.resumen.enEntrega}
              </span>
              <span className="panel-vendedor__stat-label">
                Entregas en curso
              </span>
            </div>
            <div className="panel-vendedor__stat-card">
              <span className="panel-vendedor__stat-numero">
                {ventasData.resumen.completadas}
              </span>
              <span className="panel-vendedor__stat-label">Completadas</span>
            </div>
          </div>
        )}

        {errorVentas && <p className="panel-vendedor__error">{errorVentas}</p>}

        <h3 className="panel-vendedor__subtitulo">
          Comprobantes por revisar
        </h3>
        {ventasPorRevisar.length === 0 ? (
          <p className="panel-vendedor__sin-productos">
            No tienes comprobantes esperando revisión.
          </p>
        ) : (
          <div className="panel-vendedor__lista-ventas">
            {ventasPorRevisar.map(renderVentaPorRevisar)}
          </div>
        )}

        <h3 className="panel-vendedor__subtitulo">Entregas en curso</h3>
        {ventasEnEntrega.length === 0 ? (
          <p className="panel-vendedor__sin-productos">
            No tienes entregas en curso.
          </p>
        ) : (
          <div className="panel-vendedor__lista-ventas">
            {ventasEnEntrega.map(renderVentaEnEntrega)}
          </div>
        )}

        <h3 className="panel-vendedor__subtitulo">Historial reciente</h3>
        {ventasHistorial.length === 0 ? (
          <p className="panel-vendedor__sin-productos">
            Aún no tienes ventas concluidas.
          </p>
        ) : (
          <div className="panel-vendedor__lista-ventas">
            {ventasHistorial.map(renderHistorial)}
          </div>
        )}
      </div>

      {/* RQF40: disputas de reembolso abiertas por los compradores. */}
      <div className="panel-vendedor__disputas">
        <h2>Disputas de reembolso</h2>
        <p className="panel-vendedor__informes-nota">
          Cuando un comprador abre una disputa, el pago de esa venta queda
          retenido (RQNF32) hasta que la administración resuelva el caso. Aquí
          puedes presentar tu versión y adjuntar tus evidencias.
        </p>

        {errorDisputas && (
          <p className="panel-vendedor__error">{errorDisputas}</p>
        )}
        {avisoDisputas && (
          <p className="panel-vendedor__disputas-aviso">{avisoDisputas}</p>
        )}

        {disputasVendedor.length === 0 ? (
          <p className="panel-vendedor__sin-productos">
            No tienes disputas de reembolso.
          </p>
        ) : (
          <div className="panel-vendedor__lista-disputas">
            {disputasVendedor.map(renderDisputa)}
          </div>
        )}
      </div>

      {/* RQF13 / RQNF13.3: informes mensuales de ventas y descarga en PDF. */}
      <div className="panel-vendedor__informes">
        <h2>Informes de ventas</h2>
        <p className="panel-vendedor__informes-nota">
          Cada mes el sistema genera tu informe de ventas con los productos
          vendidos, tus ingresos, la tasa de concertación y el tiempo promedio
          por fila. Puedes consultarlo aquí y descargarlo en PDF.
        </p>

        {errorInformes && (
          <p className="panel-vendedor__error">{errorInformes}</p>
        )}

        {informes.length === 0 ? (
          <p className="panel-vendedor__sin-productos">
            Todavía no tienes informes: el primero se genera automáticamente el
            día 1° del próximo mes.
          </p>
        ) : (
          <div className="panel-vendedor__lista-informes">
            {informes.map((informe) => (
              <div key={informe.periodo} className="panel-vendedor__informe">
                <div className="panel-vendedor__informe-info">
                  <p className="panel-vendedor__venta-nombre">
                    Período {informe.periodo}
                  </p>
                  <p className="panel-vendedor__venta-detalle">
                    {informe.totalVentas} venta(s) · $
                    {informe.ingresos.toFixed(2)} de ingresos
                  </p>
                  <p className="panel-vendedor__venta-detalle">
                    Filas iniciadas: {informe.filasIniciadas} · Ventas
                    concluidas: {informe.ventasConcluidas} · Tasa de
                    concertación: {informe.tasaConcertacion.toFixed(1)}%
                  </p>
                  <p className="panel-vendedor__venta-detalle">
                    Tiempo promedio por fila:{" "}
                    {informe.tiempoPromedioFilaMinutos === null
                      ? "—"
                      : `${informe.tiempoPromedioFilaMinutos.toFixed(1)} min`}
                  </p>
                  {informe.productosVendidos.length > 0 && (
                    <p className="panel-vendedor__venta-detalle">
                      Productos:{" "}
                      {informe.productosVendidos
                        .slice(0, 3)
                        .map((p) => `${p.nombre} ×${p.cantidad}`)
                        .join(" · ")}
                      {informe.productosVendidos.length > 3
                        ? ` y ${informe.productosVendidos.length - 3} más`
                        : ""}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  className="panel-vendedor__descargar-informe"
                  onClick={() => handleDescargarInforme(informe.periodo)}
                  disabled={descargandoInforme === informe.periodo}
                >
                  {descargandoInforme === informe.periodo
                    ? "Descargando..."
                    : "⬇ Descargar PDF"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* RQF12: la cuenta cancelada tampoco puede cambiar sus preferencias. */}
      {!cuentaCancelada && (
        <div className="panel-vendedor__preferencias">
          <h2>Preferencias de notificaciones</h2>
        <p className="panel-vendedor__preferencias-nota">
          Elige qué correos quieres recibir de Ichiba. Puedes cambiarlas cuando
          quieras.
        </p>

        <label className="panel-vendedor__preferencia">
          <input
            type="checkbox"
            checked={preferencias.recibirNotificacionesCriticas}
            onChange={(e) =>
              setPreferencias((anteriores) => ({
                ...anteriores,
                recibirNotificacionesCriticas: e.target.checked,
              }))
            }
          />
          Notificaciones críticas: el estado de mi cuenta, la fila virtual y
          mis pagos.
        </label>

        <label className="panel-vendedor__preferencia">
          <input
            type="checkbox"
            checked={preferencias.recibirNotificacionesPublicitarias}
            onChange={(e) =>
              setPreferencias((anteriores) => ({
                ...anteriores,
                recibirNotificacionesPublicitarias: e.target.checked,
              }))
            }
          />
          Comentarios de los visitantes en mis publicaciones publicitarias.
        </label>

        {avisoPreferencias && (
          <p className="panel-vendedor__preferencias-aviso">
            {avisoPreferencias}
          </p>
        )}

          <button
            type="button"
            className="panel-vendedor__preferencias-boton"
            onClick={guardarPreferencias}
            disabled={guardandoPreferencias}
          >
            {guardandoPreferencias ? "Guardando..." : "Guardar preferencias"}
          </button>
        </div>
      )}

      <div className="panel-vendedor__productos">
        <h2>Activos</h2>
        {productosActivos.length === 0 ? (
          <p className="panel-vendedor__sin-productos">
            No tienes productos activos.
          </p>
        ) : (
          <div className="panel-vendedor__lista-productos">
            {productosActivos.map(renderProducto)}
          </div>
        )}

        <h2>Inactivos</h2>
        {productosInactivos.length === 0 ? (
          <p className="panel-vendedor__sin-productos">
            No tienes productos inactivos.
          </p>
        ) : (
          <div className="panel-vendedor__lista-productos">
            {productosInactivos.map(renderProducto)}
          </div>
        )}
      </div>

      <div className="panel-vendedor__productos">
        <h2>Promocionales</h2>
        <p className="panel-vendedor__nota-promocional">
          Los promocionales solo se anuncian aquí: no se venden ni se pagan
          dentro de la plataforma.
        </p>

        <h3 className="panel-vendedor__subtitulo">Activos</h3>
        {promocionalesActivos.length === 0 ? (
          <p className="panel-vendedor__sin-productos">
            No tienes promocionales activos.
          </p>
        ) : (
          <div className="panel-vendedor__lista-productos">
            {promocionalesActivos.map(renderPromocional)}
          </div>
        )}

        <h3 className="panel-vendedor__subtitulo">Inactivos</h3>
        {promocionalesInactivos.length === 0 ? (
          <p className="panel-vendedor__sin-productos">
            No tienes promocionales inactivos.
          </p>
        ) : (
          <div className="panel-vendedor__lista-productos">
            {promocionalesInactivos.map(renderPromocional)}
          </div>
        )}
      </div>

      {necesitaVerificar && <VerificacionModal onCompletado={cargarDatos} />}
    </div>
  );
}

export default PanelVendedor;
