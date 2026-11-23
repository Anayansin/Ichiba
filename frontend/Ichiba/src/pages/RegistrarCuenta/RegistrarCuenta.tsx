import { useRef, useState } from "react";
import "./RegistrarCuenta.css";
import Boton from "../../components/Boton/Boton";
import VerificacionModal from "../../components/VerificacionModal/VerificacionModal";
import { registrarUsuario, solicitarRevisionRegistro } from "../../services/usuarioServices";
import { iniciarVinculacionPayPal } from "../../services/pagoService";
import {
  validarDimensionesImagen,
  validarFormatoImagen,
  validarPesoImagen,
} from "../../utils/validarImagen";
import { useAuth } from "../../context/AuthContext";
import { codigoDeError, mensajeDeError, motivoDeError } from "../../utils/errores";
import {
  REQUISITOS_PASSWORD,
  cumpleRequisitosPassword,
} from "../../utils/requisitosPassword";
import { useNavigate } from "react-router-dom";
import SelectorHorario, {
  type BloqueHorario,
} from "../../components/SelectorHorario/SelectorHorario";

const FORMATO_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Campo =
  | "nombreCompleto"
  | "direccion"
  | "telefono"
  | "correo"
  | "rfc"
  | "ineFrente"
  | "ineReverso"
  | "password"
  | "datosMetodoPago"
  | "horario"
  | "aceptaTerminos"
  | "recibirNotificaciones";

const ORDEN_CAMPOS: Campo[] = [
  "nombreCompleto",
  "direccion",
  "telefono",
  "correo",
  "rfc",
  "ineFrente",
  "ineReverso",
  "password",
  "datosMetodoPago",
  "horario",
  "aceptaTerminos",
  "recibirNotificaciones",
];

function minutosDesdeMedianoche(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

function errorDeHorario(horarios: BloqueHorario[]): string {
  let minutosTotales = 0;

  for (const bloque of horarios) {
    if (!bloque.activo) continue;

    const inicio = minutosDesdeMedianoche(bloque.horaInicio);
    const fin = minutosDesdeMedianoche(bloque.horaFin);

    if (Number.isNaN(inicio) || Number.isNaN(fin)) {
      return `Revisa las horas del ${bloque.dia}`;
    }
    if (fin <= inicio) {
      return `La hora de fin debe ser después de la hora de inicio en ${bloque.dia}`;
    }
    minutosTotales += fin - inicio;
  }

  if (minutosTotales < 60) {
    return "Debes tener al menos 1 hora de disponibilidad a la semana";
  }

  return "";
}

function RegistrarCuenta() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [nombreCompleto, setNombreCompleto] = useState("");
  const [direccion, setDireccion] = useState("");
  const [telefono, setTelefono] = useState("");
  const [correo, setCorreo] = useState("");
  const [rfc, setRfc] = useState("");
  const [password, setPassword] = useState("");
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [recibirNotificaciones, setRecibirNotificaciones] = useState(false);

  const [ineFrente, setIneFrente] = useState<File | null>(null);
  const [ineReverso, setIneReverso] = useState<File | null>(null);
  const [errorIneFrente, setErrorIneFrente] = useState("");
  const [errorIneReverso, setErrorIneReverso] = useState("");

  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [mostrarVerificacion, setMostrarVerificacion] = useState(false);
  const [bloqueo, setBloqueo] = useState<{
    mensaje: string;
    motivo: string;
  } | null>(null);
  const [mensajeRevision, setMensajeRevision] = useState("");
  const [enviandoRevision, setEnviandoRevision] = useState(false);
  const [revisionEnviada, setRevisionEnviada] = useState(false);
  const [abriendoPaypal, setAbriendoPaypal] = useState(false);
  const [recibirPublicitarias, setRecibirPublicitarias] = useState(false);
  const [datosMetodoPago, setDatosMetodoPago] = useState("");
  const DIAS_INICIALES: BloqueHorario[] = [
    "lunes",
    "martes",
    "miercoles",
    "jueves",
    "viernes",
    "sabado",
    "domingo",
  ].map((dia) => ({
    dia,
    activo: false,
    horaInicio: "09:00",
    horaFin: "18:00",
  }));
  const [horarios, setHorarios] = useState<BloqueHorario[]>(DIAS_INICIALES);

  const [tocados, setTocados] = useState<Partial<Record<Campo, boolean>>>({});
  const [enviado, setEnviado] = useState(false);

  const refsDeCampo = useRef<Partial<Record<Campo, HTMLElement | null>>>({});

  function marcarTocado(campo: Campo) {
    setTocados((anteriores) => ({ ...anteriores, [campo]: true }));
  }

  function handleTelefonoChange(valor: string) {
    const soloNumeros = valor.replace(/\D/g, "").slice(0, 10);
    setTelefono(soloNumeros);
  }

  async function handleArchivoIne(
    e: React.ChangeEvent<HTMLInputElement>,
    lado: "frente" | "reverso",
  ) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;

    const setArchivo = lado === "frente" ? setIneFrente : setIneReverso;
    const setErrorArchivo =
      lado === "frente" ? setErrorIneFrente : setErrorIneReverso;

    marcarTocado(lado === "frente" ? "ineFrente" : "ineReverso");
    setErrorArchivo("");

    if (!validarFormatoImagen(archivo)) {
      setErrorArchivo("Solo se permiten imágenes .png, .jpg o .jpeg");
      setArchivo(null);
      e.target.value = "";
      return;
    }

    if (!validarPesoImagen(archivo)) {
      setErrorArchivo("La imagen no puede pesar más de 8 MB");
      setArchivo(null);
      e.target.value = "";
      return;
    }

    const dimensionesOk = await validarDimensionesImagen(archivo);
    if (!dimensionesOk) {
      setErrorArchivo("La imagen debe medir al menos 420x540 píxeles");
      setArchivo(null);
      e.target.value = "";
      return;
    }

    setArchivo(archivo);
  }

  const passwordValida = cumpleRequisitosPassword(password);

  const errores: Partial<Record<Campo, string>> = {};
  if (!nombreCompleto.trim()) {
    errores.nombreCompleto = "Escribe tu nombre completo, tal como aparece en tu INE";
  }
  if (!direccion.trim()) {
    errores.direccion = "Escribe tu domicilio";
  }
  if (telefono.length !== 10) {
    errores.telefono = "El teléfono debe tener exactamente 10 dígitos";
  }
  if (!correo.trim()) {
    errores.correo = "Escribe tu correo electrónico";
  } else if (!FORMATO_CORREO.test(correo.trim())) {
    errores.correo = "El correo electrónico no tiene un formato válido";
  }
  if (!rfc.trim()) {
    errores.rfc = "Escribe tu RFC";
  }
  if (!ineFrente) {
    errores.ineFrente = errorIneFrente || "Sube el frente de tu INE";
  }
  if (!ineReverso) {
    errores.ineReverso = errorIneReverso || "Sube el reverso de tu INE";
  }
  if (!passwordValida) {
    errores.password = "La contraseña no cumple todavía con todos los requisitos de abajo";
  }
  if (!datosMetodoPago.trim()) {
    errores.datosMetodoPago = "Escribe el correo donde recibirás tus pagos";
  } else if (!FORMATO_CORREO.test(datosMetodoPago.trim())) {
    errores.datosMetodoPago = "El correo de pago no tiene un formato válido";
  }
  const errorHorario = errorDeHorario(horarios);
  if (errorHorario) {
    errores.horario = errorHorario;
  }
  if (!aceptaTerminos) {
    errores.aceptaTerminos = "Debes aceptar los términos y condiciones de Ichiba";
  }
  if (!recibirNotificaciones) {
    errores.recibirNotificaciones =
      "Debes aceptar recibir notificaciones críticas sobre tu cuenta, la fila virtual y tus pagos";
  }

  function mensajeDeCampo(campo: Campo): string {
    if (!enviado && !tocados[campo]) return "";
    return errores[campo] ?? "";
  }

  function claseDeCampo(campo: Campo, base: string): string {
    return `${base}${mensajeDeCampo(campo) ? " registro-input--invalido" : ""}`;
  }

  function enfocarCampo(campo: Campo) {
    const elemento = refsDeCampo.current[campo];
    if (!elemento) return;
    elemento.scrollIntoView({ behavior: "smooth", block: "center" });
    elemento.focus({ preventScroll: true });
  }

  function guardarRef(campo: Campo) {
    return (elemento: HTMLElement | null) => {
      refsDeCampo.current[campo] = elemento;
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBloqueo(null);
    setRevisionEnviada(false);
    setEnviado(true);

    const primerCampoConError = ORDEN_CAMPOS.find((campo) => errores[campo]);
    if (primerCampoConError || !ineFrente || !ineReverso) {
      setError("Revisa los campos marcados en rojo antes de continuar");
      if (primerCampoConError) enfocarCampo(primerCampoConError);
      return;
    }

    setCargando(true);

    try {
      const data = await registrarUsuario({
        nombreCompleto,
        direccion,
        telefono,
        correo,
        rfc,
        password,
        aceptaTerminos,
        recibirNotificacionesCriticas: recibirNotificaciones,
        recibirNotificacionesPublicitarias: recibirPublicitarias,
        ineFrente,
        ineReverso,
        datosMetodoPago,
        horarios,
      });

      login(data.usuario, data.token);

      try {
        const { url } = await iniciarVinculacionPayPal();
        setAbriendoPaypal(true);
        window.location.href = url;
        return;
      } catch (errVinculacion) {
        setError(
          mensajeDeError(errVinculacion) ||
            "No se pudo abrir la página de PayPal. Tu cuenta ya quedó creada: verifica tu correo para entrar.",
        );
      }

      setMostrarVerificacion(true);
    } catch (err) {
      const mensaje = mensajeDeError(err) || "Error al registrar la cuenta";

      if (codigoDeError(err) === "DATOS_NO_REGISTRABLES") {
        setBloqueo({ mensaje, motivo: motivoDeError(err) ?? "lista-negra" });
        setError("");
        return;
      }

      setError(mensaje);
    } finally {
      setCargando(false);
    }
  }

  async function enviarSolicitudDeRevision() {
    if (!bloqueo) return;

    setEnviandoRevision(true);
    setError("");

    try {
      await solicitarRevisionRegistro({
        nombreCompleto,
        correo,
        telefono,
        rfc,
        mensaje: mensajeRevision,
        motivo: bloqueo.motivo,
      });
      setRevisionEnviada(true);
    } catch (err) {
      setError(
        mensajeDeError(err) ||
          "No pudimos enviar tu solicitud, inténtalo de nuevo en un momento",
      );
    } finally {
      setEnviandoRevision(false);
    }
  }

  return (
    <div className="registro-container">
      <form className="registro-card" onSubmit={handleSubmit} noValidate>
        <h2>Crear una cuenta</h2>
        <p className="registro-nota">
          Los campos con <span className="registro-obligatorio">*</span> son
          obligatorios.
        </p>

        {error && <p className="registro-error">{error}</p>}

        {bloqueo && (
          <div className="registro-bloqueo" role="alert">
            <h3 className="registro-bloqueo__titulo">
              No pudimos registrar tu cuenta
            </h3>
            <p className="registro-bloqueo__mensaje">{bloqueo.mensaje}</p>

            {revisionEnviada ? (
              <p className="registro-bloqueo__aviso">
                Listo: enviamos tu solicitud a los administradores. Revisarán
                tus datos y te responderán al correo
                <strong> {correo}</strong>.
              </p>
            ) : (
              <>
                <p className="registro-bloqueo__nota">
                  Si consideras que se trata de un error, cuéntanos qué pasó y
                  los administradores revisarán tu caso.
                </p>
                <label
                  className="registro-bloqueo__etiqueta"
                  htmlFor="campo-mensaje-revision"
                >
                  ¿Qué ocurrió? (opcional)
                </label>
                <textarea
                  id="campo-mensaje-revision"
                  className="registro-bloqueo__area"
                  rows={3}
                  maxLength={1000}
                  placeholder="Por ejemplo: creo que ya tenía una cuenta con estos datos y perdí el acceso."
                  value={mensajeRevision}
                  onChange={(e) => setMensajeRevision(e.target.value)}
                />
                <div className="registro-bloqueo__acciones">
                  <Boton
                    texto={
                      enviandoRevision
                        ? "Enviando solicitud..."
                        : "Solicitar revisión a los administradores"
                    }
                    onClick={enviarSolicitudDeRevision}
                    disabled={enviandoRevision}
                  />
                  <button
                    type="button"
                    className="registro-bloqueo__reintentar"
                    onClick={() => setBloqueo(null)}
                  >
                    Revisar mis datos e intentar de nuevo
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        <div className="form-group">
          <label htmlFor="campo-nombre">
            Nombre completo <span className="registro-obligatorio">*</span>
          </label>
          <input
            id="campo-nombre"
            type="text"
            className={claseDeCampo("nombreCompleto", "registro-input")}
            placeholder="Tu nombre, tal como aparece en tu INE"
            value={nombreCompleto}
            onChange={(e) => setNombreCompleto(e.target.value)}
            onBlur={() => marcarTocado("nombreCompleto")}
            ref={guardarRef("nombreCompleto") as (el: HTMLInputElement | null) => void}
          />
          {mensajeDeCampo("nombreCompleto") && (
            <span className="registro-campo-error">
              {mensajeDeCampo("nombreCompleto")}
            </span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="campo-direccion">
            Dirección <span className="registro-obligatorio">*</span>
          </label>
          <input
            id="campo-direccion"
            type="text"
            className={claseDeCampo("direccion", "registro-input")}
            placeholder="Tu domicilio"
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            onBlur={() => marcarTocado("direccion")}
            ref={guardarRef("direccion") as (el: HTMLInputElement | null) => void}
          />
          {mensajeDeCampo("direccion") && (
            <span className="registro-campo-error">
              {mensajeDeCampo("direccion")}
            </span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="campo-telefono">
            Número de teléfono (10 dígitos){" "}
            <span className="registro-obligatorio">*</span>
          </label>
          <input
            id="campo-telefono"
            type="text"
            inputMode="numeric"
            className={claseDeCampo("telefono", "registro-input")}
            placeholder="3312345678"
            value={telefono}
            onChange={(e) => handleTelefonoChange(e.target.value)}
            onBlur={() => marcarTocado("telefono")}
            ref={guardarRef("telefono") as (el: HTMLInputElement | null) => void}
          />
          {mensajeDeCampo("telefono") && (
            <span className="registro-campo-error">
              {mensajeDeCampo("telefono")}
            </span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="campo-correo">
            Correo electrónico <span className="registro-obligatorio">*</span>
          </label>
          <input
            id="campo-correo"
            type="text"
            inputMode="email"
            className={claseDeCampo("correo", "registro-input")}
            placeholder="correo@ejemplo.com"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            onBlur={() => marcarTocado("correo")}
            ref={guardarRef("correo") as (el: HTMLInputElement | null) => void}
          />
          {mensajeDeCampo("correo") && (
            <span className="registro-campo-error">
              {mensajeDeCampo("correo")}
            </span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="campo-rfc">
            RFC <span className="registro-obligatorio">*</span>
          </label>
          <input
            id="campo-rfc"
            type="text"
            className={claseDeCampo("rfc", "registro-input")}
            placeholder="Tu RFC"
            value={rfc}
            onChange={(e) => setRfc(e.target.value.toUpperCase())}
            onBlur={() => marcarTocado("rfc")}
            ref={guardarRef("rfc") as (el: HTMLInputElement | null) => void}
          />
          {mensajeDeCampo("rfc") && (
            <span className="registro-campo-error">
              {mensajeDeCampo("rfc")}
            </span>
          )}
        </div>

        <div className="form-group">
          <label>
            Identificación oficial por ambos lados (INE){" "}
            <span className="registro-obligatorio">*</span>
          </label>
          <div className="file-inputs">
            <div ref={guardarRef("ineFrente") as (el: HTMLDivElement | null) => void}>
              <span className="file-label">Frente:</span>
              <input
                type="file"
                accept="image/png, image/jpeg"
                onChange={(e) => handleArchivoIne(e, "frente")}
              />
              {ineFrente ? (
                <span className="registro-campo-ok">Imagen seleccionada</span>
              ) : mensajeDeCampo("ineFrente") ? (
                <span className="registro-campo-error">
                  {mensajeDeCampo("ineFrente")}
                </span>
              ) : null}
            </div>
            <div ref={guardarRef("ineReverso") as (el: HTMLDivElement | null) => void}>
              <span className="file-label">Reverso:</span>
              <input
                type="file"
                accept="image/png, image/jpeg"
                onChange={(e) => handleArchivoIne(e, "reverso")}
              />
              {ineReverso ? (
                <span className="registro-campo-ok">Imagen seleccionada</span>
              ) : mensajeDeCampo("ineReverso") ? (
                <span className="registro-campo-error">
                  {mensajeDeCampo("ineReverso")}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="campo-password">
            Contraseña <span className="registro-obligatorio">*</span>
          </label>
          <input
            id="campo-password"
            type="password"
            className={claseDeCampo("password", "registro-input")}
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => marcarTocado("password")}
            ref={guardarRef("password") as (el: HTMLInputElement | null) => void}
          />
          {mensajeDeCampo("password") && (
            <span className="registro-campo-error">
              {mensajeDeCampo("password")}
            </span>
          )}
        </div>

        <div
          className={`requisitos-box ${
            password.length > 0 ? "requisitos-box--activo" : ""
          }`}
        >
          <p className="requisitos-titulo">Tu contraseña debe cumplir:</p>
          <ul>
            {REQUISITOS_PASSWORD.map((req) => (
              <li
                key={req.texto}
                className={req.test(password) ? "requisito-cumplido" : ""}
              >
                {req.test(password) ? "✓" : "○"} {req.texto}
              </li>
            ))}
          </ul>
        </div>
        <div className="registro-comisiones">
          <p className="registro-comisiones__titulo">
            Comisiones que debes conocer
          </p>
          <ul className="registro-comisiones__lista">
            <li>
              <strong>Ichiba:</strong> 5% + IVA (5.8% en total) de comisión
              por uso de la plataforma en cada venta.
            </li>
            <li>
              <strong>PayPal:</strong> aproximadamente 3.95% + $4.00 MXN por
              transacción, más IVA. En pagos internacionales la comisión puede
              ser mayor.
            </li>
          </ul>
          <p className="registro-comisiones__nota">
            Estas comisiones se descuentan del monto que recibes cuando se
            confirma la entrega; el comprador paga el precio que publicaste.
            Las tasas de las pasarelas son aproximadas y pueden cambiar según
            sus propias políticas.
          </p>
        </div>

        <div className="form-group">
          <label htmlFor="campo-datos-pago">
            Correo de PayPal (aquí recibirás tus pagos){" "}
            <span className="registro-obligatorio">*</span>
          </label>
          <input
            id="campo-datos-pago"
            type="text"
            inputMode="email"
            className={claseDeCampo("datosMetodoPago", "registro-input")}
            placeholder="tu-correo@paypal.com"
            value={datosMetodoPago}
            onChange={(e) => setDatosMetodoPago(e.target.value)}
            onBlur={() => marcarTocado("datosMetodoPago")}
            ref={guardarRef("datosMetodoPago") as (el: HTMLInputElement | null) => void}
          />
          {mensajeDeCampo("datosMetodoPago") && (
            <span className="registro-campo-error">
              {mensajeDeCampo("datosMetodoPago")}
            </span>
          )}
        </div>

        <div className="form-group">
          <label>
            Horario de disponibilidad (mínimo 1 hora a la semana){" "}
            <span className="registro-obligatorio">*</span>
          </label>
          <div
            className="selector-horario-envoltorio"
            ref={guardarRef("horario") as (el: HTMLDivElement | null) => void}
          >
            <SelectorHorario horarios={horarios} onChange={setHorarios} />
          </div>
          {mensajeDeCampo("horario") && (
            <span className="registro-campo-error">
              {mensajeDeCampo("horario")}
            </span>
          )}
        </div>

        <div className="form-group">
          <label className="registro-checkbox">
            <input
              type="checkbox"
              checked={aceptaTerminos}
              onChange={(e) => {
                setAceptaTerminos(e.target.checked);
                marcarTocado("aceptaTerminos");
              }}
            />
            Acepto los términos y condiciones de Ichiba{" "}
            <span className="registro-obligatorio">*</span>
          </label>
          {mensajeDeCampo("aceptaTerminos") && (
            <span className="registro-campo-error">
              {mensajeDeCampo("aceptaTerminos")}
            </span>
          )}
        </div>

        <div className="form-group">
          <label className="registro-checkbox">
            <input
              type="checkbox"
              checked={recibirNotificaciones}
              onChange={(e) => {
                setRecibirNotificaciones(e.target.checked);
                marcarTocado("recibirNotificaciones");
              }}
            />
            Acepto recibir notificaciones críticas sobre mi cuenta, la fila
            virtual y mis pagos <span className="registro-obligatorio">*</span>
          </label>
          {mensajeDeCampo("recibirNotificaciones") && (
            <span className="registro-campo-error">
              {mensajeDeCampo("recibirNotificaciones")}
            </span>
          )}
        </div>

        <div className="form-group">
          <label className="registro-checkbox">
            <input
              type="checkbox"
              checked={recibirPublicitarias}
              onChange={(e) => setRecibirPublicitarias(e.target.checked)}
            />
            Quiero recibir notificaciones sobre comentarios en publicaciones
            publicitarias (opcional)
          </label>
        </div>

        {abriendoPaypal && (
          <p className="registro-nota">
            Tu cuenta ya fue creada. Abriendo la página segura de PayPal para
            que autorices la vinculación de tu cuenta...
          </p>
        )}

        <Boton
          texto={
            abriendoPaypal
              ? "Abriendo PayPal..."
              : cargando
                ? "Registrando..."
                : "Registrarse"
          }
          onClick={() => {}}
          type="submit"
          disabled={abriendoPaypal}
        />
      </form>

      {mostrarVerificacion && (
        <VerificacionModal onCompletado={() => navigate("/panel-vendedor")} />
      )}
    </div>
  );
}

export default RegistrarCuenta;
