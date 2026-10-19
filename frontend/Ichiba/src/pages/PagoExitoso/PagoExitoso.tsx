import { useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import {
  capturarOrdenPago,
  confirmarPagoMercadoPago,
  fetchDetalleDeVenta,
  registrarComprobantePago,
} from "../../services/pagoService";
import AdvertenciaEncuentroModal from "../../components/AdvertenciaEncuentroModal/AdvertenciaEncuentroModal";
import { mensajeDeError } from "../../utils/errores";
import "./PagoExitoso.css";

const LLAVE_ADVERTENCIA_ENCUENTRO_VISTA = "advertenciaEncuentroVista";

const TAMANIO_MAXIMO_IMAGEN = 5 * 1024 * 1024; // 5 MB (límite del backend)
const TIPOS_IMAGEN_PERMITIDOS = ["image/jpeg", "image/png", "image/webp"];

type Etapa = "confirmando" | "formulario" | "enviado" | "error";

/**
 * Pantalla de vuelta del pago (PayPal/MercadoPago) y de registro del
 * comprobante:
 *
 *  1. Al volver de la pasarela se confirma el pago: el dinero queda retenido
 *     en escrow (RQNF4) y se muestra la palabra clave de 4 dígitos (RQNF20).
 *  2. El comprador registra su comprobante con la palabra clave, la
 *     referencia y una fotografía (RQF22, moderada en RQNF18).
 *  3. Se avisa que la atención del vendedor es solo en su bloque de horario
 *     vigente (RQNF24.1) y que la fila queda en reposo hasta la confirmación
 *     (RQNF24.4).
 *
 * También acepta `?venta=<id>` para volver a registrar el comprobante desde
 * "Mis pedidos" sin pasar otra vez por la pasarela.
 */
function PagoExitoso() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [etapa, setEtapa] = useState<Etapa>("confirmando");
  const [mensaje, setMensaje] = useState("");
  const [ventaId, setVentaId] = useState<number | null>(null);
  const [codigoPago, setCodigoPago] = useState("");
  const [codigoEntrega, setCodigoEntrega] = useState("");
  const [estadoVenta, setEstadoVenta] = useState<string>("");
  const [mostrarAdvertencia, setMostrarAdvertencia] = useState(false);

  // Formulario del comprobante (RQF22)
  const [palabraClave, setPalabraClave] = useState("");
  const [referencia, setReferencia] = useState("");
  const [imagen, setImagen] = useState<File | null>(null);
  const [enviandoComprobante, setEnviandoComprobante] = useState(false);
  const [errorComprobante, setErrorComprobante] = useState("");

  // En desarrollo React ejecuta el efecto dos veces; la confirmación solo
  // debe dispararse una vez por regreso de la pasarela.
  const capturaIniciada = useRef(false);

  useEffect(() => {
    if (capturaIniciada.current) return;
    capturaIniciada.current = true;

    // PayPal vuelve con ?token=<orderId>; MercadoPago con
    // ?fuente=mercadopago&payment_id=<id> (a veces llega como collection_id).
    const fuente = searchParams.get("fuente");
    const paymentIdMercadoPago =
      searchParams.get("payment_id") || searchParams.get("collection_id");
    const orderId = searchParams.get("token");
    const ventaDirecta = Number(searchParams.get("venta"));

    let confirmacion: Promise<{
      ventaId?: number | null;
      codigoPago?: string | null;
      estado?: string;
    }>;

    if (Number.isInteger(ventaDirecta) && ventaDirecta > 0) {
      // Sin pasar por la pasarela: retomar el comprobante de una compra ya
      // autorizada (por ejemplo, desde "Mis pedidos").
      confirmacion = fetchDetalleDeVenta(ventaDirecta).then((detalle) => {
        if (detalle.rol !== "comprador") {
          throw new Error("Esta compra no es tuya");
        }
        return {
          ventaId: detalle.ventaId,
          codigoPago: detalle.codigoPago,
          estado: detalle.estado,
        };
      });
    } else if (fuente === "mercadopago") {
      if (!paymentIdMercadoPago) {
        setEtapa("error");
        setMensaje("No se encontró la información del pago");
        return;
      }
      confirmacion = confirmarPagoMercadoPago(paymentIdMercadoPago);
    } else {
      if (!orderId) {
        setEtapa("error");
        setMensaje(
          "No encontramos la información del pago. Si ya pagaste, revisa «Mis pedidos» en la sección de Ayuda.",
        );
        return;
      }
      confirmacion = capturarOrdenPago(orderId);
    }

    confirmacion
      .then((datos) => {
        const id = Number(datos?.ventaId);
        if (!Number.isInteger(id) || id <= 0) {
          throw new Error("El pago no devolvió una compra válida");
        }

        setVentaId(id);
        setCodigoPago(String(datos?.codigoPago ?? ""));
        setPalabraClave(String(datos?.codigoPago ?? ""));
        setEstadoVenta(String(datos?.estado ?? ""));

        if (datos?.estado === "pendiente_comprobante") {
          setEtapa("formulario");
        } else {
          // El comprobante ya estaba registrado (u otro estado posterior).
          setEtapa("enviado");
        }

        // RQNF24.4: en la etapa de entrega se muestra aquí mismo el código
        // de confirmación del comprador, para que no tenga que buscarlo.
        if (datos?.estado === "en_entrega") {
          fetchDetalleDeVenta(id)
            .then((detalle) => {
              if (detalle.rol === "comprador" && detalle.codigoEntrega) {
                setCodigoEntrega(detalle.codigoEntrega);
              }
            })
            .catch(() => {
              // El código también aparece en «Mis pedidos» y en el chat.
            });
        }
      })
      .catch((err) => {
        setEtapa("error");
        setMensaje(
          err?.response?.data?.message ||
            err?.message ||
            "Error al confirmar el pago",
        );
      });
  }, [searchParams, navigate]);

  function handleSeleccionImagen(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;

    if (!TIPOS_IMAGEN_PERMITIDOS.includes(archivo.type)) {
      setErrorComprobante("Solo puedes subir imágenes (jpg, png o webp)");
      setImagen(null);
      return;
    }

    if (archivo.size > TAMANIO_MAXIMO_IMAGEN) {
      setErrorComprobante("La imagen no puede superar los 5 MB");
      setImagen(null);
      return;
    }

    setErrorComprobante("");
    setImagen(archivo);
  }

  async function handleSubirComprobante(e: React.FormEvent) {
    e.preventDefault();
    if (!ventaId || enviandoComprobante) return;

    if (!/^\d{4}$/.test(palabraClave.trim())) {
      setErrorComprobante("La palabra clave son los 4 dígitos que te dio Ichiba");
      return;
    }

    const referenciaLimpia = referencia.trim();
    if (referenciaLimpia.length < 4 || referenciaLimpia.length > 64) {
      setErrorComprobante(
        "El número de referencia debe tener entre 4 y 64 caracteres",
      );
      return;
    }

    if (!imagen) {
      setErrorComprobante(
        "Adjunta la fotografía o captura de pantalla del comprobante",
      );
      return;
    }

    setEnviandoComprobante(true);
    setErrorComprobante("");
    try {
      await registrarComprobantePago(ventaId, {
        palabraClave: palabraClave.trim(),
        referencia: referenciaLimpia,
        imagen,
      });
      setEtapa("enviado");
    } catch (err) {
      setErrorComprobante(
        mensajeDeError(err) || "No se pudo registrar el comprobante",
      );
    } finally {
      setEnviandoComprobante(false);
    }
  }

  function handleIrAlChat() {
    const advertenciaYaVista =
      localStorage.getItem(LLAVE_ADVERTENCIA_ENCUENTRO_VISTA) === "true";

    if (advertenciaYaVista) {
      navigate("/chats");
    } else {
      setMostrarAdvertencia(true);
    }
  }

  function handleEntendido() {
    localStorage.setItem(LLAVE_ADVERTENCIA_ENCUENTRO_VISTA, "true");
    setMostrarAdvertencia(false);
    navigate("/chats");
  }

  return (
    <div className="pago-exitoso">
      {etapa === "confirmando" && <p>Confirmando tu pago...</p>}

      {etapa === "error" && (
        <>
          <h2>Hubo un problema</h2>
          <p>{mensaje}</p>
          <p>
            También puedes revisar el estado de tus compras en{" "}
            <Link to="/ayuda?seccion=mis-pedidos">Mis pedidos</Link>.
          </p>
        </>
      )}

      {(etapa === "formulario" || etapa === "enviado") && (
        <>
          <h2>
            {etapa === "formulario"
              ? "¡Pago autorizado! 🎉"
              : estadoVenta === "en_entrega"
                ? "Tu comprobante ya fue confirmado ✅"
                : estadoVenta === "completada"
                  ? "Compra completada ✅"
                  : estadoVenta === "cancelada" ||
                      estadoVenta === "reembolsada"
                    ? "Compra cancelada"
                    : "¡Comprobante enviado! 📄"}
          </h2>
          <p className="pago-exitoso__intro">
            Tu dinero quedó <strong>retenido en la plataforma</strong> y solo
            se le entregará al vendedor cuando confirmes la recepción del
            producto con tu código de entrega (escrow).
          </p>

          {codigoPago && !codigoEntrega && (
            <div className="pago-exitoso__clave">
              <p className="pago-exitoso__clave-titulo">
                Tu palabra clave del pago es
              </p>
              <p className="pago-exitoso__clave-digitos">{codigoPago}</p>
              <p className="pago-exitoso__clave-nota">
                La usarás en tu comprobante. No la compartas con nadie más que
                con el vendedor a través de Ichiba.
              </p>
            </div>
          )}

          {/* RQNF24.4 / RQNF26: el código de entrega es del comprador; con él
              el vendedor libera el dinero retenido. */}
          {codigoEntrega && (
            <div className="pago-exitoso__entrega">
              <p className="pago-exitoso__clave-titulo">
                Tu código de confirmación de entrega es
              </p>
              <p className="pago-exitoso__entrega-digitos">{codigoEntrega}</p>
              <p className="pago-exitoso__clave-nota">
                Dáselo al vendedor únicamente cuando recibas el producto. El
                vendedor no lo conoce: solo se lo mostrarás tú.
              </p>
            </div>
          )}

          <div className="pago-exitoso__aviso">
            <p>
              ⏰ <strong>Ten en cuenta:</strong> el vendedor te atenderá
              únicamente dentro de su bloque de horario de atención vigente, y
              tu turno en la fila permanecerá en reposo hasta que revise y
              confirme tu comprobante.
            </p>
          </div>

          {etapa === "formulario" && ventaId && (
            <form
              className="pago-exitoso__formulario"
              onSubmit={handleSubirComprobante}
            >
              <h3>Registra tu comprobante de pago</h3>
              <p className="pago-exitoso__formulario-nota">
                Ingresa la palabra clave, el número de referencia de tu pago y
                una foto o captura de pantalla del comprobante. La imagen pasa
                por una revisión automática antes de mostrársela al vendedor.
              </p>

              <label>
                Palabra clave (4 dígitos)
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={palabraClave}
                  onChange={(e) =>
                    setPalabraClave(e.target.value.replace(/\D/g, ""))
                  }
                  placeholder="0000"
                />
              </label>

              <label>
                Número de referencia
                <input
                  type="text"
                  maxLength={64}
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                  placeholder="Ej. 1234567890"
                />
              </label>

              <label>
                Fotografía del comprobante
                <input
                  type="file"
                  accept="image/jpeg, image/png, image/webp"
                  onChange={handleSeleccionImagen}
                />
              </label>

              {imagen && (
                <p className="pago-exitoso__archivo">
                  Archivo elegido: {imagen.name}
                </p>
              )}

              {errorComprobante && (
                <p className="pago-exitoso__error">{errorComprobante}</p>
              )}

              <button
                type="submit"
                className="pago-exitoso__boton"
                disabled={enviandoComprobante}
              >
                {enviandoComprobante
                  ? "Enviando comprobante..."
                  : "Enviar comprobante"}
              </button>
            </form>
          )}

          {etapa === "enviado" && (
            <>
              <p className="pago-exitoso__exito">
                {estadoVenta === "en_entrega"
                  ? "El chat de coordinación está abierto. Tu código de confirmación de entrega aparece aquí arriba y también en «Mis pedidos»: dáselo al vendedor solo cuando recibas el producto."
                  : estadoVenta === "completada"
                    ? "La entrega quedó registrada y el dinero fue liberado al vendedor. ¡Gracias por usar Ichiba!"
                    : estadoVenta === "cancelada" ||
                        estadoVenta === "reembolsada"
                      ? "Esta compra fue cancelada y tu dinero fue reembolsado. Puedes ver el detalle en «Mis pedidos»."
                      : "El vendedor revisará tu comprobante dentro de su horario de atención. Cuando lo confirme, se abrirá el chat de coordinación y recibirás tu código de entrega."}
              </p>
              <div className="pago-exitoso__acciones">
                <button
                  type="button"
                  className="pago-exitoso__boton"
                  onClick={handleIrAlChat}
                >
                  Ir a mis chats
                </button>
                <Link
                  to="/ayuda?seccion=mis-pedidos"
                  className="pago-exitoso__enlace"
                >
                  Ver mis pedidos
                </Link>
              </div>
            </>
          )}
        </>
      )}

      {mostrarAdvertencia && (
        <AdvertenciaEncuentroModal onEntendido={handleEntendido} />
      )}
    </div>
  );
}

export default PagoExitoso;
