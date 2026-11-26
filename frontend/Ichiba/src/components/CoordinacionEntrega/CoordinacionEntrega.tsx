import { useCallback, useEffect, useState } from "react";
import {
  enviarDatosEnvio,
  enviarDireccion,
  enviarPropuesta,
  fetchEntrega,
  responderPropuesta,
  type DireccionEntrega,
  type EstadoEntrega,
} from "../../services/entregaService";
import { mensajeDeError } from "../../utils/errores";
import "./CoordinacionEntrega.css";

type Props = {
  ventaId: string;
  esVendedor: boolean;
};

const DIRECCION_VACIA: DireccionEntrega = {
  nombreRecibe: "",
  calleNumero: "",
  colonia: "",
  codigoPostal: "",
  ciudad: "",
  estado: "",
  telefono: "",
  referencias: "",
};

const CAMPOS_DIRECCION: {
  campo: keyof DireccionEntrega;
  etiqueta: string;
  obligatorio: boolean;
  numerico?: number;
}[] = [
  { campo: "nombreRecibe", etiqueta: "Nombre de quien recibe", obligatorio: true },
  { campo: "calleNumero", etiqueta: "Calle y número", obligatorio: true },
  { campo: "colonia", etiqueta: "Colonia", obligatorio: true },
  { campo: "codigoPostal", etiqueta: "Código postal", obligatorio: true, numerico: 5 },
  { campo: "ciudad", etiqueta: "Ciudad", obligatorio: true },
  { campo: "estado", etiqueta: "Estado", obligatorio: true },
  { campo: "telefono", etiqueta: "Teléfono de contacto", obligatorio: true, numerico: 10 },
  { campo: "referencias", etiqueta: "Referencias", obligatorio: false },
];

function hoyZonaCentro(): string {
  return new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function CoordinacionEntrega({ ventaId, esVendedor }: Props) {
  const [entrega, setEntrega] = useState<EstadoEntrega | null>(null);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [propuesta, setPropuesta] = useState({ lugar: "", fecha: "", hora: "" });
  const [direccion, setDireccion] = useState<DireccionEntrega>(DIRECCION_VACIA);
  const [envio, setEnvio] = useState({
    paqueteria: "",
    numeroGuia: "",
    fechaEstimada: "",
  });

  const cargar = useCallback(() => {
    fetchEntrega(ventaId, esVendedor)
      .then(setEntrega)
      .catch(() => setEntrega(null));
  }, [ventaId, esVendedor]);

  useEffect(() => {
    setError("");
    cargar();
    const intervalo = setInterval(cargar, 5000);
    return () => clearInterval(intervalo);
  }, [cargar]);

  async function ejecutar(accion: () => Promise<EstadoEntrega>) {
    setEnviando(true);
    setError("");
    try {
      setEntrega(await accion());
    } catch (err) {
      setError(mensajeDeError(err) || "No se pudo guardar la información");
    } finally {
      setEnviando(false);
    }
  }

  if (!entrega || entrega.estadoVenta !== "en_entrega" || !entrega.metodoEntrega) {
    return null;
  }

  const coordinada =
    entrega.metodoEntrega === "tienda" ||
    entrega.metodoEntrega === "punto-encuentro";

  if (coordinada) {
    const actual = entrega.propuesta;
    const ultimaRechazada =
      actual?.estado === "rechazada" ? actual : null;
    const puedeProponer = esVendedor && (!actual || actual.estado === "rechazada");
    const propuestaCompleta =
      propuesta.lugar.trim() && propuesta.fecha && propuesta.hora;

    return (
      <div className="coordinacion">
        <p className="coordinacion__recordatorio">
          El acuerdo de entrega se guarda cuando el comprador acepta la
          propuesta del vendedor.
        </p>

        {actual?.estado === "aceptada" && (
          <p className="coordinacion__acordado">
            Entrega acordada: <strong>{actual.lugar}</strong>, el{" "}
            <strong>{actual.fecha}</strong> a las <strong>{actual.hora}</strong>.
          </p>
        )}

        {actual?.estado === "pendiente" &&
          (esVendedor ? (
            <p className="coordinacion__pendiente">
              Enviaste la propuesta: {actual.lugar}, el {actual.fecha} a las{" "}
              {actual.hora}. Esperando la respuesta del comprador.
            </p>
          ) : (
            <div className="coordinacion__respuesta">
              <p>
                El vendedor propone entregar en <strong>{actual.lugar}</strong>,
                el <strong>{actual.fecha}</strong> a las{" "}
                <strong>{actual.hora}</strong>.
              </p>
              <div className="coordinacion__acciones">
                <button
                  type="button"
                  className="coordinacion__boton"
                  disabled={enviando}
                  onClick={() => ejecutar(() => responderPropuesta(ventaId, true))}
                >
                  Aceptar
                </button>
                <button
                  type="button"
                  className="coordinacion__boton coordinacion__boton--secundario"
                  disabled={enviando}
                  onClick={() => ejecutar(() => responderPropuesta(ventaId, false))}
                >
                  Rechazar
                </button>
              </div>
            </div>
          ))}

        {!esVendedor && !actual && (
          <p className="coordinacion__pendiente">
            El vendedor registrará una propuesta de lugar, fecha y hora de
            entrega.
          </p>
        )}

        {!esVendedor && ultimaRechazada && (
          <p className="coordinacion__pendiente">
            Rechazaste la propuesta anterior. El vendedor enviará una nueva.
          </p>
        )}

        {puedeProponer && (
          <form
            className="coordinacion__formulario"
            onSubmit={(e) => {
              e.preventDefault();
              if (!propuestaCompleta) {
                setError("Completa el lugar, la fecha y la hora de entrega");
                return;
              }
              ejecutar(() => enviarPropuesta(ventaId, propuesta));
            }}
          >
            {ultimaRechazada && (
              <p className="coordinacion__rechazo">
                El comprador rechazó tu propuesta ({ultimaRechazada.lugar},{" "}
                {ultimaRechazada.fecha} {ultimaRechazada.hora}). Registra una
                nueva propuesta.
              </p>
            )}
            <h4>Propuesta de entrega</h4>
            <label>
              Lugar
              <input
                type="text"
                value={propuesta.lugar}
                maxLength={150}
                onChange={(e) =>
                  setPropuesta({ ...propuesta, lugar: e.target.value })
                }
              />
            </label>
            <div className="coordinacion__fila">
              <label>
                Fecha
                <input
                  type="date"
                  min={hoyZonaCentro()}
                  value={propuesta.fecha}
                  onChange={(e) =>
                    setPropuesta({ ...propuesta, fecha: e.target.value })
                  }
                />
              </label>
              <label>
                Hora
                <input
                  type="time"
                  min={entrega.horarioEntregaInicio ?? undefined}
                  max={entrega.horarioEntregaFin ?? undefined}
                  value={propuesta.hora}
                  onChange={(e) =>
                    setPropuesta({ ...propuesta, hora: e.target.value })
                  }
                />
              </label>
            </div>
            {entrega.horarioEntregaInicio && entrega.horarioEntregaFin && (
              <p className="coordinacion__nota">
                Horario de coordinación de la publicación:{" "}
                {entrega.horarioEntregaInicio} a {entrega.horarioEntregaFin}
              </p>
            )}
            <button
              type="submit"
              className="coordinacion__boton"
              disabled={enviando || !propuestaCompleta}
            >
              Enviar propuesta
            </button>
          </form>
        )}

        {error && <p className="coordinacion__error">{error}</p>}
      </div>
    );
  }

  const direccionCompleta = CAMPOS_DIRECCION.every(
    ({ campo, obligatorio, numerico }) => {
      const valor = direccion[campo].trim();
      if (obligatorio && !valor) return false;
      if (numerico && !new RegExp(`^\\d{${numerico}}$`).test(valor)) return false;
      return true;
    },
  );
  const envioCompleto =
    envio.paqueteria.trim() && envio.numeroGuia.trim() && envio.fechaEstimada;

  return (
    <div className="coordinacion">
      {entrega.direccion ? (
        <div className="coordinacion__datos">
          <h4>Dirección de entrega</h4>
          <p>
            {entrega.direccion.nombreRecibe} · {entrega.direccion.calleNumero},{" "}
            {entrega.direccion.colonia}, C.P. {entrega.direccion.codigoPostal},{" "}
            {entrega.direccion.ciudad}, {entrega.direccion.estado} · Tel.{" "}
            {entrega.direccion.telefono}
          </p>
          {entrega.direccion.referencias && (
            <p>Referencias: {entrega.direccion.referencias}</p>
          )}
        </div>
      ) : esVendedor ? (
        <p className="coordinacion__pendiente">
          Esperando que el comprador registre su dirección de entrega.
        </p>
      ) : (
        <form
          className="coordinacion__formulario"
          onSubmit={(e) => {
            e.preventDefault();
            if (!direccionCompleta) {
              setError(
                "Completa los campos obligatorios: el código postal debe tener 5 dígitos y el teléfono 10",
              );
              return;
            }
            ejecutar(() => enviarDireccion(ventaId, direccion));
          }}
        >
          <h4>Dirección de entrega</h4>
          {CAMPOS_DIRECCION.map(({ campo, etiqueta, obligatorio, numerico }) => (
            <label key={campo}>
              {etiqueta}
              {obligatorio ? " *" : ""}
              <input
                type="text"
                inputMode={numerico ? "numeric" : undefined}
                maxLength={numerico ?? 150}
                value={direccion[campo]}
                onChange={(e) =>
                  setDireccion({
                    ...direccion,
                    [campo]: numerico
                      ? e.target.value.replace(/\D/g, "")
                      : e.target.value,
                  })
                }
              />
            </label>
          ))}
          <button
            type="submit"
            className="coordinacion__boton"
            disabled={enviando || !direccionCompleta}
          >
            Guardar dirección
          </button>
        </form>
      )}

      {entrega.envio ? (
        <div className="coordinacion__datos">
          <h4>Datos del envío</h4>
          <p>
            Paquetería: {entrega.envio.paqueteria} · Guía:{" "}
            {entrega.envio.numeroGuia} · Llegada estimada:{" "}
            {entrega.envio.fechaEstimada}
          </p>
        </div>
      ) : (
        esVendedor &&
        entrega.direccion && (
          <form
            className="coordinacion__formulario"
            onSubmit={(e) => {
              e.preventDefault();
              if (!envioCompleto) {
                setError(
                  "Completa la paquetería, el número de guía y la fecha estimada de llegada",
                );
                return;
              }
              ejecutar(() => enviarDatosEnvio(ventaId, envio));
            }}
          >
            <h4>Registrar envío</h4>
            <label>
              Paquetería
              <input
                type="text"
                maxLength={60}
                value={envio.paqueteria}
                onChange={(e) => setEnvio({ ...envio, paqueteria: e.target.value })}
              />
            </label>
            <label>
              Número de guía
              <input
                type="text"
                maxLength={60}
                value={envio.numeroGuia}
                onChange={(e) => setEnvio({ ...envio, numeroGuia: e.target.value })}
              />
            </label>
            <label>
              Fecha estimada de llegada
              <input
                type="date"
                min={hoyZonaCentro()}
                value={envio.fechaEstimada}
                onChange={(e) =>
                  setEnvio({ ...envio, fechaEstimada: e.target.value })
                }
              />
            </label>
            <button
              type="submit"
              className="coordinacion__boton"
              disabled={enviando || !envioCompleto}
            >
              Registrar envío
            </button>
          </form>
        )
      )}

      {!esVendedor && entrega.direccion && !entrega.envio && (
        <p className="coordinacion__pendiente">
          El vendedor registrará la paquetería y el número de guía de tu envío.
        </p>
      )}

      {error && <p className="coordinacion__error">{error}</p>}
    </div>
  );
}

export default CoordinacionEntrega;
