import { useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import {
  capturarOrdenPago,
  fetchDetalleDeVenta,
  registrarComprobantePago,
} from "../../services/pagoService";
import AdvertenciaEncuentroModal from "../../components/AdvertenciaEncuentroModal/AdvertenciaEncuentroModal";
import { mensajeDeError } from "../../utils/errores";
import { validarDimensionesEnRango } from "../../utils/validarImagen";
import "./PagoExitoso.css";

const LLAVE_ADVERTENCIA_ENCUENTRO_VISTA = "advertenciaEncuentroVista";

const TAMANIO_MAXIMO_IMAGEN = 5 * 1024 * 1024;
const TIPOS_IMAGEN_PERMITIDOS = ["image/jpeg", "image/jpg", "image/png"];

type Etapa = "confirmando" | "formulario" | "enviado" | "error";

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

  const [palabraClave, setPalabraClave] = useState("");
  const [referencia, setReferencia] = useState("");
  const [avisoAceptado, setAvisoAceptado] = useState(false);
  const [imagen, setImagen] = useState<File | null>(null);
  const [enviandoComprobante, setEnviandoComprobante] = useState(false);
  const [errorComprobante, setErrorComprobante] = useState("");

  const capturaIniciada = useRef(false);

  useEffect(() => {
    if (capturaIniciada.current) return;
    capturaIniciada.current = true;

    const orderId = searchParams.get("token");
    const ventaDirecta = Number(searchParams.get("venta"));

    let confirmacion: Promise<{
      ventaId?: number | null;
      codigoPago?: string | null;
      estado?: string;
    }>;

    if (Number.isInteger(ventaDirecta) && ventaDirecta > 0) {
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
          setEtapa("enviado");
        }

        if (datos?.estado === "en_entrega") {
          fetchDetalleDeVenta(id)
            .then((detalle) => {
              if (detalle.rol === "comprador" && detalle.codigoEntrega) {
                setCodigoEntrega(detalle.codigoEntrega);
              }
            })
            .catch(() => {
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

  async function handleSeleccionImagen(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;

    if (!TIPOS_IMAGEN_PERMITIDOS.includes(archivo.type)) {
      setErrorComprobante("Solo puedes subir imágenes .png, .jpeg o .jpg");
      setImagen(null);
      return;
    }

    if (archivo.size > TAMANIO_MAXIMO_IMAGEN) {
      setErrorComprobante("La imagen no puede superar los 5 MB");
      setImagen(null);
      return;
    }

    if (!(await validarDimensionesEnRango(archivo))) {
      setErrorComprobante(
        "La imagen del comprobante debe medir entre 420x540 y 2560x2560 píxeles",
      );
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
    if (!/^\d{6,8}$/.test(referenciaLimpia)) {
      setErrorComprobante(
        "El número de referencia debe ser numérico y tener entre 6 y 8 dígitos",
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
              ? "¡Pago autorizado!"
              : estadoVenta === "en_entrega"
                ? "Tu comprobante ya fue confirmado"
                : estadoVenta === "completada"
                  ? "Compra completada"
                  : estadoVenta === "cancelada" ||
                      estadoVenta === "reembolsada"
                    ? "Compra cancelada"
                    : "¡Comprobante enviado!"}
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
              <strong>Ten en cuenta:</strong> el vendedor te atenderá
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
                Ingresa la palabra clave, el número de referencia y una foto
                del comprobante.
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
                  inputMode="numeric"
                  maxLength={8}
                  value={referencia}
                  onChange={(e) =>
                    setReferencia(e.target.value.replace(/\D/g, ""))
                  }
                  placeholder="Ej. 12345678"
                />
              </label>

              <label>
                Fotografía del comprobante
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                  onChange={handleSeleccionImagen}
                />
              </label>

              {imagen && (
                <p className="pago-exitoso__archivo">
                  Archivo elegido: {imagen.name}
                </p>
              )}

              <label className="pago-exitoso__casilla">
                <input
                  type="checkbox"
                  checked={avisoAceptado}
                  onChange={(e) => setAvisoAceptado(e.target.checked)}
                />
                Leí el aviso: el vendedor me atenderá únicamente dentro de su
                bloque de horario de atención vigente.
              </label>

              {errorComprobante && (
                <p className="pago-exitoso__error">{errorComprobante}</p>
              )}

              <button
                type="submit"
                className="pago-exitoso__boton"
                disabled={enviandoComprobante || !avisoAceptado}
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
