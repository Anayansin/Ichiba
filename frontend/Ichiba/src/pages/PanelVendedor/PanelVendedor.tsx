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
  iniciarVinculacionPayPal,
  estadoVinculacionPayPal,
} from "../../services/pagoService";
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
import { URL_BACKEND } from "../../services/api";
import { mensajeDeError } from "../../utils/errores";
import "./PanelVendedor.css";

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

  // RQF4/RQNF4: vinculación OAuth 2.0 de la cuenta de PayPal.
  const [vinculacionPaypal, setVinculacionPaypal] = useState<{
    vinculado: boolean;
    correoPayPal: string | null;
    merchantId: string | null;
    metodoPago: string;
  } | null>(null);
  const [vinculandoPaypal, setVinculandoPaypal] = useState(false);
  const [avisoPaypal, setAvisoPaypal] = useState("");
  const [parametros, setParametros] = useSearchParams();

  function cargarVinculacionPaypal() {
    estadoVinculacionPayPal()
      .then(setVinculacionPaypal)
      .catch((err) => console.error("Error al consultar PayPal:", err));
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
    ])
      .then(([datosPerfil, productos, promocionales]) => {
        setPerfil(datosPerfil);
        setMisProductos(productos);
        setMisPromocionales(promocionales);
      })
      .catch((error) => {
        console.error("Error al cargar el panel:", error);
      })
      .finally(() => setCargando(false));
  }

  useEffect(() => {
    if (!usuario) return;
    cargarDatos();
    cargarVinculacionPaypal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario]);

  // Mensaje según lo que PayPal devolvió al volver del flujo de vinculación.
  useEffect(() => {
    const resultado = parametros.get("paypal");
    if (!resultado) return;

    const mensajes: Record<string, string> = {
      vinculado:
        "¡Cuenta de PayPal vinculada! Tus cobros se enviarán a esa cuenta.",
      denegado: "No se autorizó la vinculación con PayPal.",
      "state-invalido":
        "La vinculación expiró. Intenta de nuevo desde el panel.",
      "sin-identidad":
        "PayPal no devolvió los datos de tu cuenta. Intenta de nuevo.",
      "sin-state": "La vinculación no se completó. Intenta de nuevo.",
      error:
        "No se pudo completar la vinculación con PayPal. Intenta de nuevo.",
    };
    setAvisoPaypal(mensajes[resultado] ?? "Resultado de PayPal desconocido.");
    if (resultado === "vinculado") cargarVinculacionPaypal();
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

  // RQF4: el navegador del vendedor sale hacia la pasarela oficial de
  // PayPal; al autorizar, PayPal lo regresa al backend y este al panel.
  async function vincularPaypal() {
    setVinculandoPaypal(true);
    setAvisoPaypal("");
    try {
      const { url } = await iniciarVinculacionPayPal();
      window.location.href = url;
    } catch (err) {
      setAvisoPaypal(
        mensajeDeError(err) || "No se pudo iniciar la vinculación con PayPal",
      );
      setVinculandoPaypal(false);
    }
  }

  function renderProducto(producto: Producto) {
    return (
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
      </div>
    );
  }

  return (
    <div className="panel-vendedor">
      <h1>Hola, {perfil.nombreCompleto}</h1>
      <p className="panel-vendedor__correo">{perfil.correo}</p>
      {error && <p className="panel-vendedor__error">{error}</p>}

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
        <div className="panel-vendedor__stat-card panel-vendedor__stat-card--reportes">
          <span className="panel-vendedor__stat-numero">{perfil.totalReportes}</span>
          <span className="panel-vendedor__stat-label">Reportes recibidos</span>
        </div>
      </div>

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

      {vinculacionPaypal?.metodoPago === "paypal" && (
        <div className="panel-vendedor__paypal">
          <h2>Cuenta de PayPal</h2>
          <p className="panel-vendedor__paypal-nota">
            Vincula tu cuenta oficial de PayPal con Ichiba mediante la página
            segura de PayPal: los cobros de tus ventas se enviarán a esa cuenta
            (Merchant ID{" "}
            <strong>
              {vinculacionPaypal.vinculado
                ? vinculacionPaypal.merchantId
                : "—"}
            </strong>
            ).
          </p>

          {vinculacionPaypal.vinculado ? (
            <p className="panel-vendedor__paypal-estado">
              Cuenta vinculada:{" "}
              <strong>{vinculacionPaypal.correoPayPal}</strong>
            </p>
          ) : (
            <p className="panel-vendedor__paypal-estado panel-vendedor__paypal-estado--pendiente">
              Aún no vinculas tu cuenta de PayPal.
            </p>
          )}

          {avisoPaypal && (
            <p className="panel-vendedor__paypal-aviso">{avisoPaypal}</p>
          )}

          <button
            type="button"
            className="panel-vendedor__paypal-boton"
            onClick={vincularPaypal}
            disabled={vinculandoPaypal}
          >
            {vinculandoPaypal
              ? "Abriendo PayPal..."
              : vinculacionPaypal.vinculado
                ? "Vincular otra cuenta"
                : "Vincular cuenta de PayPal"}
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
