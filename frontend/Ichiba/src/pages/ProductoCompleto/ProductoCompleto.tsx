import { useParams, useNavigate, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import Boton from "../../components/Boton/Boton";
import Carrusel from "../../components/Carrusel/Carrusel";
import TerminosModal, {
  type PreferenciasNotificacion,
} from "../../components/TerminosModal/TerminosModal";
import {
  fetchProductoPorId,
  type Producto,
} from "../../services/productoService";
import {
  entrarEnFila,
  esperarProximaApertura,
  fetchEstadoDeMiFila,
  type EstadoFila,
} from "../../services/colaService";
import { useColas } from "../../context/ColasContext";
import { useAuth } from "../../context/AuthContext";
import { mensajeDeError } from "../../utils/errores";
import { textoCategoria } from "../../configuracion/categorias";
import {
  textoCondicion,
  textoMetodoEntrega,
  textoTiempoPago,
} from "../../utils/opcionesProducto";
import "./ProductoCompleto.css";
import {
  confirmarPagoMercadoPago,
  crearOrdenPago,
  procesarPagoMercadoPago,
  type OrdenDePagoMercadoPago,
} from "../../services/pagoService";
import { crearPaymentBrick } from "../../utils/mercadoPagoSdk";
import { guardarSuscripcion } from "../../services/notificacionService";

function ProductoCompleto() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { recargarFilas } = useColas();
  const { usuario } = useAuth();

  const [producto, setProducto] = useState<Producto | null>(null);
  const [cargando, setCargando] = useState(true);
  const [mostrarTerminos, setMostrarTerminos] = useState(false);
  const [mensajeFila, setMensajeFila] = useState("");
  const [estadoFila, setEstadoFila] = useState<EstadoFila | null>(null);
  const [segundosRestantes, setSegundosRestantes] = useState<number | null>(
    null,
  );
  // RQNF24.1: aviso de atención y enlace a la pasarela tras confirmar el pago.
  const [avisoAtencion, setAvisoAtencion] = useState("");
  const [enlacePago, setEnlacePago] = useState("");
  // Checkout API: datos para montar el Payment Brick embebido y su resultado.
  const [datosPagoMP, setDatosPagoMP] = useState<OrdenDePagoMercadoPago | null>(
    null,
  );
  const [brickListo, setBrickListo] = useState(false);
  const [errorPagoMP, setErrorPagoMP] = useState("");
  const [pagoPendienteMP, setPagoPendienteMP] = useState<{
    pagoId: number | null;
    mensaje: string;
    urlVoucher: string | null;
  } | null>(null);
  // RQF18: espera a la próxima apertura del vendedor.
  const [guardandoEspera, setGuardandoEspera] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchProductoPorId(id)
      .then((data) => setProducto(data))
      .catch((error) => {
        if (error?.response?.status !== 404) {
          console.error("Error al cargar producto:", error);
        }
      })
      .finally(() => setCargando(false));
  }, [id]);

  useEffect(() => {
    if (!producto) return;

    const productoActual = producto;

    function actualizar() {
      fetchEstadoDeMiFila(productoActual._id)
        .then((data) => {
          if (data.expiro) {
            setEstadoFila(null);
            setMensajeFila(
              data.mensaje || "Se agotó tu tiempo de pago, vuelve a intentarlo",
            );
            recargarFilas();
            return;
          }
          // RQNF15: aunque no esté en la fila, se conserva el estado del
          // horario del vendedor (próximo bloque disponible).
          setEstadoFila(data);
        })
        .catch(() => setEstadoFila(null));
    }

    actualizar();
    const intervalo = setInterval(actualizar, 5000);
    return () => clearInterval(intervalo);
  }, [producto, recargarFilas]);

  // Cuenta regresiva del tiempo de pago (empieza en la posición 1)
  useEffect(() => {
    const puedePagar = estadoFila?.puedePagar;
    const expira = estadoFila?.pagoExpiraEn;

    if (!puedePagar || !expira) {
      setSegundosRestantes(null);
      return;
    }

    function calcular() {
      const restante = Math.max(
        0,
        Math.floor((new Date(expira as string).getTime() - Date.now()) / 1000),
      );
      setSegundosRestantes(restante);
    }

    calcular();
    const intervalo = setInterval(calcular, 1000);
    return () => clearInterval(intervalo);
  }, [estadoFila?.puedePagar, estadoFila?.pagoExpiraEn]);

  // Checkout API: monta el Payment Brick en cuanto llegan los datos del pago
  // y lo desmonta al cancelar o al salir de la página.
  useEffect(() => {
    if (!datosPagoMP || !producto) return;

    let activo = true;
    let controlador: { unmount: () => void } | null = null;

    setBrickListo(false);
    setErrorPagoMP("");

    crearPaymentBrick(datosPagoMP.llavePublica, "contenedor-pago-mp", {
      initialization: {
        amount: datosPagoMP.monto,
        payer: datosPagoMP.correoComprador
          ? { email: datosPagoMP.correoComprador }
          : undefined,
      },
      // Personalización de Ichiba: el rojo de la marca en botones y focos.
      customization: {
        paymentMethods: {
          // El saldo de MercadoPago exige una preferencia (Checkout Pro):
          // no se ofrece en el formulario embebido.
          mercadoPago: "none",
          ticket: "all", // OXXO
          bankTransfer: "all", // SPEI
          creditCard: "all",
          debitCard: "all",
          prepaidCard: "all",
        },
        visual: {
          style: {
            theme: "default",
            customVariables: {
              baseColor: "#d90429",
              baseColorFirstVariant: "#b8031f",
              baseColorSecondVariant: "#a00219",
              buttonTextColor: "#ffffff",
              borderRadiusMedium: "6px",
              borderRadiusLarge: "8px",
              fontSizeMedium: "14px",
            },
          },
        },
      },
      callbacks: {
        onReady: () => {
          if (activo) setBrickListo(true);
        },
        onSubmit: async ({ formData }) => {
          try {
            const resultado = await procesarPagoMercadoPago({
              productoId: producto._id,
              payment_method_id: String(formData.payment_method_id ?? ""),
              token: formData.token,
              issuer_id: formData.issuer_id,
              installments: formData.installments,
              payer: formData.payer,
            });

            if (resultado.estado === "aprobado" && resultado.ventaId) {
              // La venta ya quedó registrada: se retoma el comprobante.
              navigate(`/pago-exitoso?venta=${resultado.ventaId}`);
              return;
            }

            if (resultado.estado === "pendiente") {
              setDatosPagoMP(null);
              setPagoPendienteMP({
                pagoId: resultado.pagoId ?? null,
                mensaje: String(resultado.mensaje ?? ""),
                urlVoucher: resultado.urlVoucher ?? null,
              });
            }
          } catch (err) {
            if (activo) {
              setErrorPagoMP(
                mensajeDeError(err) ||
                  "No se pudo procesar el pago. Revisa los datos e intenta de nuevo.",
              );
            }
          }
        },
        onError: (error) => {
          console.error("Error del Payment Brick:", error);
          if (activo) {
            setErrorPagoMP(
              "El formulario de pago tuvo un problema. Intenta de nuevo.",
            );
          }
        },
      },
    })
      .then((creado) => {
        if (!activo) {
          creado.unmount();
          return;
        }
        controlador = creado;
      })
      .catch((error) => {
        console.error("No se pudo montar el Payment Brick:", error);
        if (activo) {
          setErrorPagoMP(
            "No se pudo cargar el formulario de pago. Revisa tu conexión e intenta de nuevo.",
          );
        }
      });

    return () => {
      activo = false;
      controlador?.unmount();
    };
  }, [datosPagoMP, producto, navigate]);

  async function handleEntrarFila() {
    const yaAceptoTerminos =
      localStorage.getItem("terminosAceptados") === "true";

    if (!yaAceptoTerminos) {
      setMostrarTerminos(true);
      return;
    }

    await procesarEntradaFila();
  }

  async function procesarEntradaFila() {
    if (!producto) return;
    setMensajeFila("");

    try {
      await entrarEnFila(producto._id);
      recargarFilas();
      setMensajeFila("¡Entraste a la fila!");
    } catch (err) {
      setMensajeFila(
        mensajeDeError(err) || "Error al entrar en la fila",
      );
    }
  }
  async function handlePagar() {
    if (!producto) return;
    setMensajeFila("");
    setErrorPagoMP("");
    setPagoPendienteMP(null);
    try {
      const orden = await crearOrdenPago(producto._id);

      if (orden.metodo === "mercadopago") {
        // Checkout API: el formulario se monta aquí mismo (Payment Brick).
        setAvisoAtencion(String(orden.avisoAtencion ?? ""));
        setDatosPagoMP(orden);
        return;
      }

      if (!orden.linkAprobacion) {
        setMensajeFila(
          "La pasarela de pago no devolvió el enlace. Intenta de nuevo en unos segundos.",
        );
        return;
      }
      // RQNF24.1: antes de salir a la pasarela se advierte que la atención
      // del vendedor será únicamente dentro de su bloque de horario vigente.
      setAvisoAtencion(String(orden.avisoAtencion ?? ""));
      setEnlacePago(String(orden.linkAprobacion));
    } catch (err) {
      setMensajeFila(mensajeDeError(err) || "Error al iniciar el pago");
    }
  }

  /** Checkout API: el comprador dice que ya pagó un OXXO/SPEI pendiente. */
  async function handleVerificarPagoPendiente() {
    if (!pagoPendienteMP?.pagoId) return;
    setErrorPagoMP("");
    try {
      const datos = await confirmarPagoMercadoPago(
        String(pagoPendienteMP.pagoId),
      );
      const ventaId = Number(datos?.ventaId);
      if (Number.isInteger(ventaId) && ventaId > 0) {
        navigate(`/pago-exitoso?venta=${ventaId}`);
        return;
      }
      setPagoPendienteMP({
        ...pagoPendienteMP,
        mensaje: String(datos?.message ?? "El pago aún no se acredita."),
      });
    } catch (err) {
      setErrorPagoMP(
        mensajeDeError(err) || "El pago aún no se ha acreditado",
      );
    }
  }

  function cancelarPagoMP() {
    setDatosPagoMP(null);
    setPagoPendienteMP(null);
    setErrorPagoMP("");
  }

  /**
   * RQF18: el comprador decide esperar a la próxima apertura: se guarda su
   * lugar en la fila (RQNF18) y su reloj de pago queda en pausa.
   */
  async function handleEsperarApertura() {
    if (!producto || !estadoFila?.colaId) return;
    setGuardandoEspera(true);
    setMensajeFila("");
    try {
      const respuesta = await esperarProximaApertura(estadoFila.colaId);
      setMensajeFila(respuesta.message);
      recargarFilas();
      const datos = await fetchEstadoDeMiFila(producto._id);
      setEstadoFila(datos);
    } catch (err) {
      setMensajeFila(
        mensajeDeError(err) || "No pudimos guardar tu lugar en la fila",
      );
    } finally {
      setGuardandoEspera(false);
    }
  }

  async function handleAceptarTerminos(preferencias: PreferenciasNotificacion) {
    localStorage.setItem("terminosAceptados", "true");
    localStorage.setItem(
      "recibirCorreos",
      String(preferencias.categorias.length > 0),
    );
    localStorage.setItem("correoNotificaciones", preferencias.correo);
    localStorage.setItem(
      "categoriasCorreos",
      JSON.stringify(preferencias.categorias),
    );

    setMostrarTerminos(false);
    setMensajeFila("");

    try {
      await guardarSuscripcion(preferencias.correo, preferencias.categorias);
    } catch (err) {
      setMensajeFila(
        mensajeDeError(err) ||
          "No se pudieron guardar tus preferencias de notificación, intenta de nuevo",
      );
      return;
    }

    await procesarEntradaFila();
  }

  if (cargando) return <p>Cargando producto...</p>;
  if (!producto)
    return <p className="producto-no-encontrado">Producto no encontrado</p>;

  const esDueño = String(usuario?.id) === String(producto.vendedorId);
  const esAdmin = usuario?.tipo === "admin";

  if (!producto.activo && !esDueño) {
    return (
      <p className="producto-no-encontrado">
        Este producto ya no está disponible
      </p>
    );
  }

  return (
    <div className="producto-completo">
      <button
        className="producto-completo__volver"
        onClick={() => navigate(-1)}
      >
        ← Volver
      </button>

      <div className="producto-completo__imagen-wrapper">
        <Carrusel imagenes={producto.imagenes} alt={producto.nombre} />
      </div>

      <div className="producto-completo__info">
        <span className="producto-completo__categoria">
          {textoCategoria(producto.categoria)}
        </span>
        <h1 className="producto-completo__nombre">{producto.nombre}</h1>
        <p className="producto-completo__precio">${producto.precio}</p>

        {!producto.activo && esDueño && (
          <p className="producto-completo__aviso-inactivo">
            Este producto está desactivado — solo tú puedes verlo así
          </p>
        )}

        <Link
          to={`/vendedor/${producto.vendedorId}`}
          className="producto-completo__vendedor"
        >
          <div className="producto-completo__avatar" />
          <div>
            <p className="producto-completo__vendedor-label">Vendido por</p>
            <p className="producto-completo__vendedor-nombre">
              {producto.vendedor}
            </p>
          </div>
        </Link>

        <div className="producto-completo__descripcion">
          <h3>Descripción</h3>
          <p>{producto.descripcion}</p>
        </div>

        <div className="producto-completo__envio">
          <h3>Entrega y condiciones</h3>
          <p>
            <strong>Condición:</strong> {textoCondicion(producto.condicion)}
          </p>
          <p>
            <strong>Método de entrega:</strong>{" "}
            {textoMetodoEntrega(producto.metodoEntrega)}
          </p>
          {producto.horarioEntregaInicio && producto.horarioEntregaFin && (
            <p>
              <strong>Horario de coordinación de entrega:</strong>{" "}
              {producto.horarioEntregaInicio} a {producto.horarioEntregaFin}
            </p>
          )}
          <p>
            <strong>Tiempo límite de pago:</strong>{" "}
            {textoTiempoPago(producto.tiempoLimitePago ?? 60)}
          </p>
          {producto.datosDeEnvio && <p>{producto.datosDeEnvio}</p>}
        </div>

        {esAdmin ? (
          <p className="producto-completo__aviso-inactivo">
            Tu cuenta es de administración: supervisa la plataforma, no
            realiza compras.
          </p>
        ) : estadoFila?.esperandoApertura ? (
          /* RQF18: lugar guardado; el reloj sigue en pausa hasta la apertura. */
          <div className="producto-completo__esperando producto-completo__esperando--apertura">
            <p>Guardamos tu lugar — posición {estadoFila.posicion}</p>
            <span>
              El vendedor no está atendiendo en este momento.
              {estadoFila.proximoBloque
                ? ` Su próxima apertura es ${estadoFila.proximoBloque}.`
                : ""}{" "}
              Tu reloj de pago está en pausa y se reanudará cuando abra su
              bloque de atención; te avisaremos por correo.
            </span>
            {mensajeFila && (
              <p className="producto-completo__mensaje-fila">{mensajeFila}</p>
            )}
          </div>
        ) : estadoFila &&
          estadoFila.enFila !== false &&
          estadoFila.posicion !== null ? (
          estadoFila.puedePagar ? (
            <div className="producto-completo__pago-listo">
              <p>¡Es tu turno! Estás en la posición 1.</p>
              {segundosRestantes !== null && (
                <p className="producto-completo__temporizador">
                  Tiempo restante para pagar:{" "}
                  <strong>
                    {Math.floor(segundosRestantes / 60)}:
                    {String(segundosRestantes % 60).padStart(2, "0")}
                  </strong>
                </p>
              )}
              {/* RQNF16: advertencia cuando el bloque del vendedor termina
                  antes del tiempo límite de pago. */}
              {estadoFila.puedeElegirEspera && estadoFila.avisoAtencion && (
                <p className="producto-completo__aviso-atencion">
                  {estadoFila.avisoAtencion}
                </p>
              )}
              {pagoPendienteMP ? (
                <div className="producto-completo__aviso-pago producto-completo__pago-mp-pendiente">
                  <p className="producto-completo__aviso-pago-titulo">
                    Pago pendiente de acreditación
                  </p>
                  <p className="producto-completo__aviso-pago-texto">
                    {pagoPendienteMP.mensaje}
                  </p>
                  {pagoPendienteMP.urlVoucher && (
                    <a
                      className="producto-completo__voucher"
                      href={pagoPendienteMP.urlVoucher}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Ver el comprobante de pago
                    </a>
                  )}
                  {errorPagoMP && (
                    <p className="producto-completo__mensaje-fila">
                      {errorPagoMP}
                    </p>
                  )}
                  <div className="producto-completo__aviso-pago-acciones">
                    <Boton
                      texto="Ya pagué, verificar"
                      onClick={handleVerificarPagoPendiente}
                    />
                    <button
                      type="button"
                      className="producto-completo__cancelar-pago"
                      onClick={cancelarPagoMP}
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              ) : datosPagoMP ? (
                <div className="producto-completo__aviso-pago producto-completo__pago-mp">
                  <p className="producto-completo__aviso-pago-titulo">
                    Paga con Mercado Pago
                  </p>
                  <p className="producto-completo__aviso-pago-texto">
                    {avisoAtencion ||
                      "La atención del vendedor será únicamente dentro de su bloque de horario de atención vigente."}
                  </p>
                  {errorPagoMP && (
                    <p className="producto-completo__mensaje-fila">
                      {errorPagoMP}
                    </p>
                  )}
                  {!brickListo && !errorPagoMP && (
                    <p className="producto-completo__aviso-pago-texto">
                      Cargando el formulario de pago...
                    </p>
                  )}
                  <div
                    id="contenedor-pago-mp"
                    className="producto-completo__brick-mp"
                  />
                  <div className="producto-completo__aviso-pago-acciones">
                    <button
                      type="button"
                      className="producto-completo__cancelar-pago"
                      onClick={cancelarPagoMP}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : enlacePago ? (
                <div className="producto-completo__aviso-pago">
                  <p className="producto-completo__aviso-pago-titulo">
                    Antes de pagar, ten en cuenta:
                  </p>
                  <p className="producto-completo__aviso-pago-texto">
                    {avisoAtencion ||
                      "La atención del vendedor será únicamente dentro de su bloque de horario de atención vigente."}
                  </p>
                  <div className="producto-completo__aviso-pago-acciones">
                    <Boton
                      texto="Continuar a PayPal"
                      onClick={() => {
                        window.location.href = enlacePago;
                      }}
                    />
                    <button
                      type="button"
                      className="producto-completo__cancelar-pago"
                      onClick={() => {
                        setEnlacePago("");
                        setAvisoAtencion("");
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : estadoFila.puedeElegirEspera ? (
                /* RQF18: el comprador elige pagar ahora o esperar la apertura. */
                <div className="producto-completo__eleccion-espera">
                  <Boton texto="Pagar ahora" onClick={handlePagar} />
                  <button
                    type="button"
                    className="producto-completo__esperar-boton"
                    onClick={handleEsperarApertura}
                    disabled={guardandoEspera}
                  >
                    {guardandoEspera
                      ? "Guardando tu lugar..."
                      : "Esperar a la próxima apertura"}
                  </button>
                </div>
              ) : (
                <Boton
                  texto={
                    producto.metodoPagoVendedor === "mercadopago"
                      ? "Pagar con Mercado Pago"
                      : "Pagar con PayPal"
                  }
                  onClick={handlePagar}
                />
              )}
            </div>
          ) : (
            <div className="producto-completo__esperando">
              <p>Estás en la fila — posición {estadoFila.posicion}</p>
              <span>Debes esperar tu turno para poder pagar</span>
            </div>
          )
        ) : (
          <>
            {mensajeFila && (
              <p className="producto-completo__mensaje-fila">{mensajeFila}</p>
            )}
            {/* RQNF15: fuera del bloque de atención no se puede entrar a la
                fila; se muestra la fecha y hora del próximo bloque. */}
            {estadoFila?.horarioActivo === false ? (
              <div className="producto-completo__fuera-horario">
                <p className="producto-completo__fuera-horario-titulo">
                  El vendedor no está en horario de atención
                </p>
                <p className="producto-completo__fuera-horario-texto">
                  {estadoFila.proximoBloque
                    ? `Su próxima apertura es ${estadoFila.proximoBloque}. Podrás entrar a la fila cuando abra su bloque de atención.`
                    : "El vendedor no tiene bloques de atención programados por ahora."}
                </p>
              </div>
            ) : (
              <Boton texto="Entrar en la fila" onClick={handleEntrarFila} />
            )}
          </>
        )}
      </div>

      {mostrarTerminos && (
        <TerminosModal
          onAceptar={handleAceptarTerminos}
          onCerrar={() => setMostrarTerminos(false)}
        />
      )}
    </div>
  );
}

export default ProductoCompleto;
